# Filename: web_server.py
"""
Main Web Server (SocketIO Server)

This is the primary server that handles:
1.  Serving all HTML pages (using the upgraded template structure).
2.  Serving all REST APIs (the /api/... blueprints).
3.  Handling web client connections via Flask-SocketIO.
4.  Running a background thread to listen to Redis for updates 
    from the sock_server.py.
"""

import os
import json
import sqlite3
from flask import Flask, render_template, send_from_directory

# --- Import extensions (from Step 1.2) ---
# We import socketio (for web) and redis_client (for pubsub)
try:
    from extensions import socketio, redis_client, REDIS_SCOREBOARD_CHANNEL
except ImportError:
    print("FATAL: Could not import extensions.py. Did you create it?")
    exit(1)

# --- Import Database (from Step 1.3) ---
import database

# --- Import all API Blueprints ---
# (These are the same as the original/upgraded versions)
from api.players import players_api
from api.courts import courts_api
from api.suggestions import suggestions_api
from api.matches import matches_api
from api.sessions import sessions_api
from api.settings import settings_api 
from api.scoreboards import scoreboards_api

# --- Application Factory ---
def create_app():
    """Creates and configures the Flask application."""
    
    app = Flask(__name__,
                static_folder='static',
                template_folder='templates')
    app.config['SECRET_KEY'] = 'deoaithongminhhontao' 

    # --- Initialize Extensions ---
    database.init_app(app)     
    socketio.init_app(app)    
    
    # --- Register API Blueprints ---   
    app.register_blueprint(players_api, url_prefix='/api')
    app.register_blueprint(courts_api, url_prefix='/api')
    app.register_blueprint(suggestions_api, url_prefix='/api')
    app.register_blueprint(matches_api, url_prefix='/api')
    app.register_blueprint(settings_api, url_prefix='/api') 
    app.register_blueprint(sessions_api, url_prefix='/api') 
    app.register_blueprint(scoreboards_api, url_prefix='/api')

    return app

app = create_app()

# --- HTML Routes ---

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/')
def home():
    """Serves the main dashboard page."""

    return render_template('dashboard.html', active_page='dashboard')

@app.route('/settings')
def settings_page():
    """Serves the settings page."""
    return render_template('settings.html', active_page='settings')

@app.route('/manage-players')
def players_page():
    """Serves the player management page."""
    return render_template('players.html', active_page='players')

@app.route('/manage-courts')
def courts_page():
    """Serves the court management page."""
    return render_template('courts.html', active_page='courts')

@app.route('/history')
def history_page():
    """Serves the match history page."""
    return render_template('history.html', active_page='history')

@app.route('/create')
def create_page():
    """Serves the manual match creation page."""
    return render_template('create.html', active_page='create')


# --- SocketIO Handlers for WEB Clients ---

@socketio.on('connect')
def handle_web_connect():
    """Handles new web client connections."""
    print('✅ Web client connected')

@socketio.on('disconnect')
def handle_web_disconnect():
    """Handles web client disconnections."""
    print('❌ Web client disconnected')


# --- Redis Listener (Task 2.3) ---
def redis_listener():
    """
    Listens to Redis PubSub channel in a background thread.
    This function bridges the gap from sock_server -> Redis -> web_server.
    """
    if redis_client is None:
        print("Redis listener: Cannot start, Redis client is not connected.")
        return

    print("🎧 Redis listener started, subscribing to channel...")
    pubsub = redis_client.pubsub()
    pubsub.subscribe(REDIS_SCOREBOARD_CHANNEL)
    
    for message in pubsub.listen():
        if message['type'] == 'message':
            print(f"[Redis SUB] Received message: {message['data']}")
            try:
                # 1. Parse the data from sock_server
                data = json.loads(message['data'])
                device_id = data.get('device_id')
                score_a = data.get('score_A')
                score_b = data.get('score_B')

                if not device_id:
                    continue

                # 2. Update the database
                # IMPORTANT: This background thread is OUTSIDE the Flask app context,
                # so we CANNOT use database.get_db_connection() (which uses flask.g).
                # We must create a new, separate connection.
                try:
                    conn = sqlite3.connect(database.DATABASE_URI)
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    
                    # (This DB logic is taken from the old server.py ...6307... logic)
                    cursor.execute(
                        """
                        UPDATE scoreboards 
                        SET score_A = ?, score_B = ?, last_seen = datetime('now', 'localtime'), updated_by = 'device' 
                        WHERE device_id = ?
                        """,
                        (score_a, score_b, device_id)
                    )
                    
                    # If no row was updated, insert a new one
                    if cursor.rowcount == 0:
                        cursor.execute(
                            """
                            INSERT INTO scoreboards (device_id, score_A, score_B, last_seen, updated_by) 
                            VALUES (?, ?, ?, datetime('now', 'localtime'), 'device')
                            """,
                            (device_id, score_a, score_b)
                        )
                    
                    conn.commit()
                    
                    # 3. Get court_id to broadcast to the web
                    scoreboard = cursor.execute("SELECT court_id FROM scoreboards WHERE device_id = ?", (device_id,)).fetchone()
                    conn.close()

                    # 4. Broadcast the update to all connected WEB clients
                    if scoreboard and scoreboard['court_id'] is not None:
                        payload = {
                            'court_id': scoreboard['court_id'], 
                            'score_A': score_a, 
                            'score_B': score_b
                        }
                        # Use socketio.emit to broadcast
                        socketio.emit('score_updated', payload)
                        print(f"[SocketIO] Emitted 'score_updated' to web clients: {payload}")
                
                except sqlite3.Error as e:
                    print(f"[Redis Listener] Database error: {e}")
                
            except json.JSONDecodeError:
                print(f"[Redis Listener] Received invalid JSON: {message['data']}")
            except Exception as e:
                print(f"[Redis Listener] Error processing message: {e}")


# --- Run the Server ---
if __name__ == '__main__':
    print("--- Starting Main Web Server (SocketIO) ---")
    
    # Start the Redis listener in a background thread
    # This is the correct way to do it with flask-socketio
    socketio.start_background_task(target=redis_listener)
    
    # Run the main web server on port 5000
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')

    print(f"Listening on http://{host}:{port}")
    socketio.run(app, host=host, port=port, debug=True, allow_unsafe_werkzeug=True)
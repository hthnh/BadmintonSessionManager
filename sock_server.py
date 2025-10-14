# Filename: sock_server.py
"""
Hardware WebSocket Server (Sock Server)

This server's sole purpose is to handle raw WebSocket connections 
from ESP32/ESP8266 devices using flask-sock.

It listens on the /ws/device endpoint.
When it receives data from a device, it immediately publishes that
data to a Redis PubSub channel for the main web_server to process.

This server runs as a separate process on a different port (e.g., 5001).
"""

from flask import Flask
from flask_sock import Sock
import json
import os
import time

# Import the Redis client and channel name from our extensions
# Note: This file ONLY imports what it needs for Redis.
# It does NOT import socketio or database logic.
try:
    from extensions import redis_client, REDIS_SCOREBOARD_CHANNEL
except ImportError:
    print("Could not import extensions.py. Make sure it exists.")
    redis_client = None
    REDIS_SCOREBOARD_CHANNEL = "scoreboard_updates"

# --- App Initialization ---
app = Flask(__name__)
sock = Sock(app)

# Check if Redis connection was successful
if redis_client is None:
    print("--- FATAL ---")
    print("Redis client is not available (failed to connect in extensions.py).")
    print("This server will run, but will NOT be able to publish messages.")
    print("Please check your Redis server connection.")
    print("-------------")


# --- WebSocket Endpoint for Hardware ---

@sock.route('/ws/device')
def ws_device_endpoint(ws):
    """
    Handles WebSocket connections from ESP devices.
    (This logic is moved from the old server.py)
    """
    print(f"⚡ ESP device connected from: {ws.environ.get('REMOTE_ADDR')}")
    device_id = None
    
    try:
        while True:
            data = ws.receive(timeout=60) # Add a timeout
            if not data:
                print(f"[{device_id or 'Unknown'}] Received empty data. Closing connection.")
                break
                
            print(f"[Recv from ESP {device_id or ''}]: {data}")

            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                print(f"[Warning] Received invalid JSON data: {data}")
                continue

            # Register the device_id on first message
            if 'device_id' in msg and device_id is None:
                device_id = msg['device_id']
                print(f"Registered device: {device_id}")

            # Check for score update payload
            # We only care about messages that contain a score
            if 'score_A' in msg and 'score_B' in msg and device_id:
                
                # --- NEW LOGIC: Publish to Redis ---
                if redis_client:
                    try:
                        # We must re-serialize the data (or just pass 'data')
                        # to send it over Redis.
                        # Let's create a standardized payload.
                        redis_payload = json.dumps({
                            'device_id': device_id,
                            'score_A': msg['score_A'],
                            'score_B': msg['score_B'],
                            'source': 'sock_server'
                        })
                        
                        # Publish the payload to the channel
                        redis_client.publish(REDIS_SCOREBOARD_CHANNEL, redis_payload)
                        
                        print(f"[{device_id}] Published to Redis channel '{REDIS_SCOREBOARD_CHANNEL}'")
                    
                    except Exception as e:
                        print(f"[{device_id}] FAILED to publish to Redis: {e}")
                else:
                    print(f"[{device_id}] Cannot publish. Redis client is not connected.")
                
            # Note: We NO LONGER write to the database here.
            # The web_server will handle that.

    except TimeoutError:
        print(f"🔌 ESP device {device_id or ''} timed out.")
    except Exception as e:
        print(f"🔌 ESP device {device_id or ''} connection error: {e}")
    finally:
        print(f"🔌 ESP device {device_id or ''} disconnected.")


# --- Run the Server ---
if __name__ == '__main__':
    # We run this server on a DIFFERENT port than the main web server
    # e.g., Web server runs on 5000, Sock server runs on 5001
    port = int(os.environ.get('SOCK_PORT', 5001))
    host = os.environ.get('SOCK_HOST', '0.0.0.0')
    
    print("--- Starting Hardware Sock Server ---")
    print(f"Listening on ws://{host}:{port}")
    
    # Use a production-ready server like gevent or gunicorn in production
    # For development, 'waitress' is a good cross-platform choice
    try:
        from waitress import serve
        serve(app, host=host, port=port)
    except ImportError:
        print("Waitress not found. Falling back to Flask development server (NOT for production).")
        app.run(host=host, port=port, debug=False)
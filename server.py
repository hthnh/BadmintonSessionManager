# server.py (Phiên bản cuối cùng, rất gọn gàng)
from flask import Flask, render_template, send_from_directory
from flask_sock import Sock
import os
import json
from extensions import broadcast_to_web, broadcast_to_esp


# Import các Blueprint từ thư mục 'api'
from api.players import players_api
from api.courts import courts_api
from api.suggestions import suggestions_api
from api.matches import matches_api
from api.sessions import sessions_api
from api.settings import settings_api 
from api.scoreboards import scoreboards_api

# --- Cấu hình và Khởi tạo Ứng dụng ---
app = Flask(__name__,
            static_folder='static',
            template_folder='templates')
app.config['SECRET_KEY'] = 'deoaithongminhhontao'

sock = Sock(app)


# --- WebSocket Client Management ---
# [NEW] We now manage two separate collections of clients
web_clients = set()
# This dictionary maps a device_id to its websocket connection object
esp_clients = {} 
 

# --- Đăng ký các Blueprint ---
# Mỗi Blueprint sẽ quản lý một nhóm API với một tiền tố (prefix) riêng
app.register_blueprint(players_api, url_prefix='/api')
app.register_blueprint(courts_api, url_prefix='/api')
app.register_blueprint(suggestions_api, url_prefix='/api')
app.register_blueprint(matches_api, url_prefix='/api')
app.register_blueprint(settings_api, url_prefix='/api') 
app.register_blueprint(sessions_api, url_prefix='/api') 
app.register_blueprint(scoreboards_api, url_prefix='/api')



# --- Route chính phục vụ Frontend ---
# Route này vẫn giữ ở file chính vì nó là giao diện người dùng, không phải API


@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/')
def home():
    """Phục vụ trang chủ index.html."""
    return render_template('index.html')

@app.route('/settings')
def settings_page():
    """Phục vụ trang quản lý settings.html."""
    return render_template('settings.html')

@app.route('/manage-players')
def players_page():
    """Phục vụ trang quản lý players.html."""
    return render_template('players.html')

@app.route('/manage-courts')
def courts_page():
    """Phục vụ trang quản lý admin.html."""
    return render_template('courts.html')

@app.route('/history')
def history_page():
    """Phục vụ trang quản lý admin.html."""
    return render_template('history.html')
@app.route('/create')
def create_page():
    """Phục vụ trang tạo trận đấu thủ công."""
    return render_template('create.html')



@sock.route('/ws/web')
def ws_web_endpoint(ws):
    """Handles WebSocket connections from web browsers."""
    print("🌍 Web client connected")
    web_clients.add(ws)
    try:
        while True:
            # Keep connection alive, but we don't expect messages from the web client.
            ws.receive()
    except Exception:
        print("💔 Web client disconnected")
    finally:
        if ws in web_clients:
            web_clients.remove(ws)

@sock.route('/ws/device')
def ws_device_endpoint(ws):
    """Handles WebSocket connections from ESP devices."""
    print("⚡ ESP device connected")
    device_id = None
    try:
        while True:
            data = ws.receive()
            if not data: break

            print(f"[Recv from ESP] {data}")
            msg = json.loads(data)
            
            if 'device_id' in msg and device_id is None:
                device_id = msg['device_id']
                esp_clients[device_id] = ws
                print(f"Registered device: {device_id}")

            if 'score_A' in msg and 'score_B' in msg and device_id:
                score_a, score_b = msg['score_A'], msg['score_B']
                
                # Database Logic
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE scoreboards SET score_A = ?, score_B = ?, last_seen = datetime('now', 'localtime'), updated_by = 'device' WHERE device_id = ?",
                    (score_a, score_b, device_id)
                )
                if cursor.rowcount == 0:
                    cursor.execute("INSERT INTO scoreboards (device_id, score_A, score_B, last_seen) VALUES (?, ?, ?, datetime('now', 'localtime'))", (device_id, score_a, score_b))
                conn.commit()
                
                scoreboard = cursor.execute("SELECT court_id FROM scoreboards WHERE device_id = ?", (device_id,)).fetchone()
                conn.close()
                
                # Notify Web Clients
                if scoreboard and scoreboard['court_id'] is not None:
                    payload = {'type': 'score_updated', 'payload': {'court_id': scoreboard['court_id'], 'score_A': score_a, 'score_B': score_b}}
                    broadcast_to_web(json.dumps(payload))

    except Exception as e:
        print(f"ESP client connection error: {e}")
    finally:
        if device_id and device_id in esp_clients:
            del esp_clients[device_id]
        print(f"🔌 ESP device {device_id or ''} disconnected")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

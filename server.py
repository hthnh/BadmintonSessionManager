# server.py (Phiên bản cuối cùng, rất gọn gàng)
from flask import Flask, render_template, send_from_directory
from flask_sock import Sock
import os
import json

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

clients = set()  # danh sách client websocket kết nối

 

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


@sock.route('/ws')
def ws_endpoint(ws):
    clients.add(ws)
    print("⚡ ESP connected via WebSocket")
    try:
        while True:
            data = ws.receive()
            if not data:
                break

            print(f"[Recv] {data}")
            msg = json.loads(data)

            # Broadcast cho các client khác (nếu có dashboard)
            for client in list(clients):
                if client != ws:
                    try:
                        client.send(json.dumps(msg))
                    except:
                        clients.remove(client)

    except Exception as e:
        print(f"Client error: {e}")
    finally:
        clients.remove(ws)
        print("🔌 ESP disconnected")





if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

# bridge_server.py
from flask import Flask
from flask_sock import Sock
import redis
import json
import threading

# --- Cấu hình ---
REDIS_CHANNEL = 'scoreboard_updates'
BRIDGE_HOST = '192.168.50.1' # Cùng IP với server chính
BRIDGE_PORT = 5001           # Chạy trên một port khác

# --- Khởi tạo ---
app = Flask(__name__)
sock = Sock(app)
redis_client = redis.Redis(decode_responses=True)

# List để lưu tất cả các kết nối WebSocket đang hoạt động
clients = []

# --- Logic xử lý Redis Pub/Sub ---
def redis_listener():
    """
    Hàm này chạy trong một thread riêng, chuyên lắng nghe tin nhắn từ Redis.
    """
    pubsub = redis_client.pubsub()
    pubsub.subscribe(REDIS_CHANNEL)
    print(f"[*] Subscribed to Redis channel '{REDIS_CHANNEL}'")

    for message in pubsub.listen():
        if message['type'] == 'message':
            data = message['data']
            print(f"[Redis -> All Clients] Forwarding data: {data}")
            # Gửi dữ liệu nhận được đến tất cả các client đang kết nối
            # Dùng list(clients) để tạo bản sao, tránh lỗi khi client ngắt kết nối giữa vòng lặp
            for client_ws in list(clients):
                try:
                    client_ws.send(data)
                except Exception as e:
                    print(f"[Error] Failed to send to a client, removing it. Error: {e}")
                    # Nếu gửi lỗi, có thể client đã ngắt kết nối, xóa nó khỏi danh sách
                    if client_ws in clients:
                        clients.remove(client_ws)

# --- WebSocket Route ---
@sock.route('/ws')
def websocket_handler(ws):
    """
    Hàm này được gọi mỗi khi có một client (ESP8266) kết nối vào.
    """
    print(f"[+] New client connected: {ws.environ['REMOTE_ADDR']}")
    clients.append(ws)

    try:
        while True:
            # Chờ nhận dữ liệu từ client (ESP8266).
            # Nếu nhận được None nghĩa là client đã ngắt kết nối.
            data = ws.receive()
            if data is None:
                break 
    except Exception as e:
        print(f"[Error] WebSocket error: {e}")
    finally:
        # Khi client ngắt kết nối, xóa nó khỏi danh sách
        print(f"[-] Client disconnected: {ws.environ['REMOTE_ADDR']}")
        if ws in clients:
            clients.remove(ws)

# --- Chạy ứng dụng ---
if __name__ == '__main__':
    # Bắt đầu thread lắng nghe Redis
    redis_thread = threading.Thread(target=redis_listener, daemon=True)
    redis_thread.start()

    # Chạy Flask server trên một port khác
    print(f"[*] Starting Flask-Sock bridge server on http://{BRIDGE_HOST}:{BRIDGE_PORT}")
    app.run(host=BRIDGE_HOST, port=BRIDGE_PORT, debug=False)
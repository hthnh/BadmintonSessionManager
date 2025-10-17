# extensions.py
from flask_socketio import SocketIO
import redis

# Khởi tạo đối tượng SocketIO ở đây nhưng chưa gắn vào app
socketio = SocketIO(cors_allowed_origins="*")

redis_client = redis.Redis(decode_responses=True)


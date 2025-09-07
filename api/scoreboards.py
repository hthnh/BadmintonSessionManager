# api/scoreboards.py
from flask import Blueprint, request, jsonify
import sqlite3
from server import socketio # Import đối tượng socketio từ file server

scoreboards_api = Blueprint('scoreboards_api', __name__)

def get_db_connection():
    # (Copy hàm này từ các file api khác)
    conn = sqlite3.connect('badminton.db', timeout=15)
    conn.row_factory = sqlite3.Row
    return conn

# API để WEMOS gọi khi có điểm mới
@scoreboards_api.route('/scoreboards/<device_id>/score', methods=['POST'])
def update_score_from_device(device_id):
    data = request.get_json()
    score_a = data.get('score_A')
    score_b = data.get('score_B')

    conn = get_db_connection()
    # Cập nhật điểm và lấy court_id đang được gán
    cursor = conn.execute(
        "UPDATE scoreboards SET score_A = ?, score_B = ?, last_seen = datetime('now', 'localtime') WHERE device_id = ?",
        (score_a, score_b, device_id)
    )
    conn.commit()
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Device not found'}), 404
        
    scoreboard = conn.execute("SELECT court_id FROM scoreboards WHERE device_id = ?", (device_id,)).fetchone()
    conn.close()
    
    if scoreboard and scoreboard['court_id'] is not None:
        # Phát sự kiện WebSocket cho tất cả client
        socketio.emit('score_updated', {
            'court_id': scoreboard['court_id'],
            'score_A': score_a,
            'score_B': score_b
        })
        
    return jsonify({'message': 'Score updated successfully'}), 200

# API để web UI gọi để điều khiển từ xa
@scoreboards_api.route('/scoreboards/control', methods=['POST'])
def control_scoreboard():
    data = request.get_json()
    court_id = data.get('court_id')
    action = data.get('action') # 'inc_a', 'dec_a', 'inc_b', 'dec_b', 'reset'

    conn = get_db_connection()
    # Tìm scoreboard được gán cho sân này
    scoreboard = conn.execute("SELECT * FROM scoreboards WHERE court_id = ?", (court_id,)).fetchone()
    if not scoreboard:
        conn.close()
        return jsonify({"error": "No scoreboard assigned to this court"}), 404

    score_a, score_b = scoreboard['score_A'], scoreboard['score_B']

    if action == 'inc_a': score_a += 1
    elif action == 'dec_a' and score_a > 0: score_a -= 1
    elif action == 'inc_b': score_b += 1
    elif action == 'dec_b' and score_b > 0: score_b -= 1
    elif action == 'reset':
        score_a, score_b = 0, 0
    
    # Cập nhật DB
    conn.execute("UPDATE scoreboards SET score_A = ?, score_B = ? WHERE id = ?", (score_a, score_b, scoreboard['id']))
    conn.commit()
    conn.close()

    # Phát sự kiện WebSocket
    socketio.emit('score_updated', {
        'court_id': court_id,
        'score_A': score_a,
        'score_B': score_b
    })
    
    return jsonify({'message': 'Action successful'}), 200

# (Bạn có thể thêm các API để GÁN/HỦY GÁN scoreboard với court ở đây)
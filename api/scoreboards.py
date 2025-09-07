# api/scoreboards.py
from flask import Blueprint, request, jsonify
import sqlite3
from extensions import socketio 

scoreboards_api = Blueprint('scoreboards_api', __name__)

def get_db_connection():
    # (Copy hàm này từ các file api khác)
    conn = sqlite3.connect('badminton.db', timeout=15)
    conn.row_factory = sqlite3.Row
    return conn


# [MỚI] API để lấy danh sách tất cả scoreboard
@scoreboards_api.route('/scoreboards', methods=['GET'])
def get_scoreboards():
    conn = get_db_connection()
    # Lấy thông tin scoreboard và tên của sân được gán (nếu có)
    query = """
        SELECT s.id, s.device_id, s.court_id, s.score_A, s.score_B, s.last_seen, c.name as court_name
        FROM scoreboards s
        LEFT JOIN courts c ON s.court_id = c.id
        ORDER BY s.device_id ASC
    """
    boards = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in boards])



@scoreboards_api.route('/scoreboards/<device_id>/score', methods=['POST'])
def update_score_from_device(device_id):
    data = request.get_json()
    score_a = data.get('score_A', 0)
    score_b = data.get('score_B', 0)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Thử cập nhật trước
    cursor.execute(
        "UPDATE scoreboards SET score_A = ?, score_B = ?, last_seen = datetime('now', 'localtime') WHERE device_id = ?",
        (score_a, score_b, device_id)
    )
    # Nếu không có hàng nào được cập nhật (thiết bị mới), thì thêm mới
    if cursor.rowcount == 0:
        cursor.execute(
            "INSERT INTO scoreboards (device_id, score_A, score_B, last_seen) VALUES (?, ?, ?, datetime('now', 'localtime'))",
            (device_id, score_a, score_b)
        )
    conn.commit()
    
    scoreboard = cursor.execute("SELECT court_id FROM scoreboards WHERE device_id = ?", (device_id,)).fetchone()
    conn.close()
    
    if scoreboard and scoreboard['court_id'] is not None:
        socketio.emit('score_updated', {
            'court_id': scoreboard['court_id'], 'score_A': score_a, 'score_B': score_b
        })
        
    return jsonify({'message': 'Score updated and device registered if new'}), 200


@scoreboards_api.route('/scoreboards/assign', methods=['POST'])
def assign_scoreboard():
    data = request.get_json()
    device_id = data.get('device_id')
    court_id = data.get('court_id')

    if not device_id or not court_id:
        return jsonify({'error': 'Thiếu device_id hoặc court_id'}), 400

    conn = get_db_connection()
    # Hủy gán scoreboard này ở bất kỳ sân nào khác trước
    conn.execute("UPDATE scoreboards SET court_id = NULL WHERE device_id = ?", (device_id,))
    # Gán vào sân mới
    conn.execute("UPDATE scoreboards SET court_id = ? WHERE device_id = ?", (court_id, device_id))
    conn.commit()
    conn.close()
    
    return jsonify({'message': f'Đã gán {device_id} vào sân {court_id}'})


@scoreboards_api.route('/scoreboards/control', methods=['POST'])
def control_scoreboard():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    court_id = data.get('court_id')
    action = data.get('action')

    if court_id is None or action is None:
        return jsonify({"error": "Missing court_id or action"}), 400

    conn = get_db_connection()
    # Tìm scoreboard được gán cho sân này
    scoreboard = conn.execute("SELECT * FROM scoreboards WHERE court_id = ?", (court_id,)).fetchone()
    
    if not scoreboard:
        conn.close()
        return jsonify({"error": "No scoreboard assigned to this court"}), 404

    # Lấy điểm hiện tại từ CSDL
    score_a, score_b = scoreboard['score_A'], scoreboard['score_B']

    # Thay đổi điểm số dựa trên action
    if action == 'inc_a': score_a += 1
    elif action == 'dec_a' and score_a > 0: score_a -= 1
    elif action == 'inc_b': score_b += 1
    elif action == 'dec_b' and score_b > 0: score_b -= 1
    elif action == 'reset':
        score_a, score_b = 0, 0
    else:
        conn.close()
        return jsonify({"error": "Invalid action"}), 400

    # Cập nhật điểm mới vào CSDL
    conn.execute("UPDATE scoreboards SET score_A = ?, score_B = ? WHERE id = ?", (score_a, score_b, scoreboard['id']))
    conn.commit()
    conn.close()

    # Phát sự kiện WebSocket cho TẤT CẢ client
    # Đây là bước quan trọng nhất bị thiếu
    socketio.emit('score_updated', {
        'court_id': court_id,
        'score_A': score_a,
        'score_B': score_b
    })
    
    return jsonify({'message': 'Action successful', 'new_score_a': score_a, 'new_score_b': score_b}), 200
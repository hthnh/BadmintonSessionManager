# api/players.py
from flask import Blueprint, request, jsonify
import sqlite3

# Tạo một Blueprint tên là 'players_api'
# Blueprint giống như một ứng dụng Flask thu nhỏ, có thể được đăng ký vào ứng dụng chính
players_api = Blueprint('players_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db', timeout=15)
    conn.row_factory = sqlite3.Row
    return conn

@players_api.route('/players', methods=['GET'])
def get_players():
    conn = get_db_connection()
    players = conn.execute('SELECT * FROM players ORDER BY name ASC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in players])

@players_api.route('/players/<int:player_id>', methods=['GET'])
def get_player_by_id(player_id):
    conn = get_db_connection()
    # Lấy tất cả các cột dữ liệu của người chơi
    player = conn.execute('SELECT * FROM players WHERE id = ?', (player_id,)).fetchone()
    conn.close()
    if player is None:
        return jsonify({'error': 'Không tìm thấy người chơi'}), 404
    # Trả về dữ liệu của người chơi dưới dạng JSON
    return jsonify(dict(player))



@players_api.route('/players', methods=['POST'])
def add_player():
    new_player = request.get_json()
    if not new_player or not new_player.get('name'):
        return jsonify({'error': 'Thiếu tên người chơi'}), 400

    name = new_player.get('name')
    player_type = new_player.get('type', 'Vãng lai')
    gender = new_player.get('gender', 'Nam')
    contact_info = new_player.get('contact_info', None)
    
    elo = new_player.get('elo_rating', 1500)
    k_factor = new_player.get('k_factor', 32)
    provisional_games_left = new_player.get('provisional_games_left', 5)
    rank_tier = new_player.get('rank_tier', None)

    try:
        conn = get_db_connection()
        # Thêm các trường mới và sử dụng giờ địa phương cho join_date
        conn.execute('''
            INSERT INTO players (name, type, gender, contact_info, elo_rating, k_factor, provisional_games_left, rank_tier, join_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
            ''',
            (name, player_type, gender, contact_info, elo, k_factor, provisional_games_left, rank_tier))
        conn.commit()
        conn.close()
        return jsonify({'message': f'Đã thêm thành công người chơi {name}'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Lỗi khi thêm người chơi'}), 500

@players_api.route('/players/<int:player_id>', methods=['PUT'])
def update_player(player_id):
    data = request.get_json()
    if not data: return jsonify({'error': 'Không có dữ liệu để cập nhật'}), 400

    allowed_fields = [
        'name', 'type', 'is_active', 'elo_rating', 'gender', 
        'contact_info', 'k_factor', 'provisional_games_left', 'rank_tier'
    ]
    
    fields_to_update = []
    values = []
    
    for field in allowed_fields:
        if field in data:
            fields_to_update.append(f"{field} = ?")
            values.append(data[field])

    if not fields_to_update: return jsonify({'error': 'Không có trường hợp lệ nào để cập nhật'}), 400
    
    values.append(player_id)
    # Câu lệnh SQL không cần thay đổi vì last_played_date được cập nhật ở finish_match
    sql = f"UPDATE players SET {', '.join(fields_to_update)} WHERE id = ?"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql, values)
    conn.commit()
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Không tìm thấy người chơi'}), 404
    
    conn.close()
    return jsonify({'message': f'Cập nhật thành công người chơi ID {player_id}'})

@players_api.route('/players/<int:player_id>', methods=['DELETE'])
def delete_player(player_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM players WHERE id = ?', (player_id,))
    conn.commit()
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Không tìm thấy người chơi'}), 404
    conn.close()
    return jsonify({'message': f'Đã xóa thành công người chơi ID {player_id}'})

# Thêm vào cuối file api/players.py

@players_api.route('/players/available', methods=['GET'])
def get_available_players():
    """
    Chỉ trả về danh sách người chơi thỏa mãn các điều kiện sau:
    1. Đang có mặt (is_active = 1)
    2. Không phải nghỉ do đã chơi 2 trận liên tiếp (consecutive_matches < 2)
    """
    conn = get_db_connection()
    query = "SELECT * FROM players WHERE is_active = 1 AND consecutive_matches < 2 ORDER BY name ASC"
    players = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in players])
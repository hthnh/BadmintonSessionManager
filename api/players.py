# api/players.py
from flask import Blueprint, request, jsonify
import sqlite3
from database import get_db_connection

# Tạo một Blueprint tên là 'players_api'
# Blueprint giống như một ứng dụng Flask thu nhỏ, có thể được đăng ký vào ứng dụng chính
players_api = Blueprint('players_api', __name__)


@players_api.route('/players', methods=['GET'])
def get_players():
    conn = get_db_connection()
    players = conn.execute('SELECT * FROM players ORDER BY name ASC').fetchall()
    return jsonify([dict(row) for row in players])

@players_api.route('/players/<int:player_id>', methods=['GET'])
def get_player_by_id(player_id):
    conn = get_db_connection()
    # Lấy tất cả các cột dữ liệu của người chơi
    player = conn.execute('SELECT * FROM players WHERE id = ?', (player_id,)).fetchone()
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
    # Lấy skill_level thay vì elo
    skill_level = new_player.get('skill_level', 3) 

    try:
        conn = get_db_connection()
        # Cập nhật câu lệnh SQL
        conn.execute('''
            INSERT INTO players (name, type, gender, contact_info, skill_level, join_date) 
            VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
            ''',
            (name, player_type, gender, contact_info, skill_level))
        conn.commit()
        return jsonify({'message': f'Đã thêm thành công người chơi {name}'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Lỗi khi thêm người chơi'}), 500

@players_api.route('/players/<int:player_id>', methods=['PUT'])
def update_player(player_id):
    data = request.get_json()
    if not data: return jsonify({'error': 'Không có dữ liệu để cập nhật'}), 400
    allowed_fields = [
            'name', 'type', 'is_active', 'gender', 
            'contact_info', 'skill_level' 
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
        return jsonify({'error': 'Không tìm thấy người chơi'}), 404
    
    return jsonify({'message': f'Cập nhật thành công người chơi ID {player_id}'})

@players_api.route('/players/<int:player_id>', methods=['DELETE'])
def delete_player(player_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM players WHERE id = ?', (player_id,))
    conn.commit()
    if cursor.rowcount == 0:
        return jsonify({'error': 'Không tìm thấy người chơi'}), 404
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
    return jsonify([dict(row) for row in players])
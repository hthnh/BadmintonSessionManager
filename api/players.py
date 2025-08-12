# api/players.py
from flask import Blueprint, request, jsonify
import sqlite3

# Tạo một Blueprint tên là 'players_api'
# Blueprint giống như một ứng dụng Flask thu nhỏ, có thể được đăng ký vào ứng dụng chính
players_api = Blueprint('players_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db')
    conn.row_factory = sqlite3.Row
    return conn

@players_api.route('/players', methods=['GET'])
def get_players():
    conn = get_db_connection()
    players = conn.execute('SELECT * FROM players ORDER BY name ASC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in players])

@players_api.route('/players', methods=['POST'])
def add_player():
    new_player = request.get_json()
    if not new_player or not new_player.get('name'):
        return jsonify({'error': 'Thiếu tên người chơi'}), 400
    name = new_player.get('name')
    player_type = new_player.get('type', 'Vãng lai')
    elo = new_player.get('elo_rating', 1500)
    gender = new_player.get('gender', 'Nam')
    try:
        conn = get_db_connection()
        conn.execute('INSERT INTO players (name, type, elo_rating, gender) VALUES (?, ?, ?, ?)',
                     (name, player_type, elo, gender))
        conn.commit()
        conn.close()
        return jsonify({'message': f'Đã thêm thành công người chơi {name}'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Lỗi khi thêm người chơi'}), 500

@players_api.route('/players/<int:player_id>', methods=['PUT'])
def update_player(player_id):
    data = request.get_json()
    if not data: return jsonify({'error': 'Không có dữ liệu để cập nhật'}), 400
    fields_to_update, values, allowed_fields = [], [], ['name', 'type', 'is_active', 'elo_rating', 'gender']
    for field in allowed_fields:
        if field in data:
            fields_to_update.append(f"{field} = ?")
            values.append(data[field])
    if not fields_to_update: return jsonify({'error': 'Không có trường hợp lệ nào để cập nhật'}), 400
    values.append(player_id)
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
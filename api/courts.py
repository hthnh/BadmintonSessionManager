# api/courts.py
from flask import Blueprint, request, jsonify
import sqlite3
from database import get_db_connection

courts_api = Blueprint('courts_api', __name__)


@courts_api.route('/courts/', methods=['GET'])
def get_courts():
    conn = get_db_connection()
    courts = conn.execute('SELECT * FROM courts ORDER BY name ASC').fetchall()
    return jsonify([dict(row) for row in courts])

@courts_api.route('/courts', methods=['POST'])
def add_court():
    data = request.get_json()
    if not data or not data.get('name'): return jsonify({'error': 'Thiếu tên sân'}), 400
    name = data.get('name')
    try:
        conn = get_db_connection()
        conn.execute('INSERT INTO courts (name) VALUES (?)', (name,))
        conn.commit()
        new_court_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        return jsonify({'message': f'Đã thêm thành công {name}', 'court_id': new_court_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': f'Tên sân "{name}" đã tồn tại'}), 409

@courts_api.route('/courts/<int:court_id>', methods=['DELETE'])
def delete_court(court_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM courts WHERE id = ?', (court_id,))
    conn.commit()
    if cursor.rowcount == 0:
        return jsonify({'error': 'Không tìm thấy sân'}), 404
    return jsonify({'message': f'Đã xóa thành công sân ID {court_id}'})
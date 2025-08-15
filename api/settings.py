# api/settings.py
from flask import Blueprint, jsonify, request
import sqlite3

settings_api = Blueprint('settings_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db')
    conn.row_factory = sqlite3.Row
    return conn

@settings_api.route('/settings', methods=['GET'])
def get_settings():
    conn = get_db_connection()
    settings_rows = conn.execute('SELECT key, value FROM settings').fetchall()
    conn.close()
    settings_dict = {row['key']: row['value'] for row in settings_rows}
    return jsonify(settings_dict)

@settings_api.route('/settings', methods=['PUT'])
def update_settings():
    new_settings = request.get_json()
    if not new_settings:
        return jsonify({'error': 'Không có dữ liệu'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for key, value in new_settings.items():
            cursor.execute(
                'UPDATE settings SET value = ? WHERE key = ?',
                (str(value), key)
            )
        conn.commit()
        return jsonify({'message': 'Cập nhật cấu hình thành công!'})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()
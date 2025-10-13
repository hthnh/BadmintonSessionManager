# api/sessions.py
from flask import Blueprint, jsonify, request
import sqlite3
from database import get_db_connection

sessions_api = Blueprint('sessions_api', __name__)


@sessions_api.route('/sessions/current', methods=['GET'])
def get_current_session():
    """Lấy thông tin về phiên đang hoạt động."""
    conn = get_db_connection()
    session = conn.execute("SELECT * FROM sessions WHERE status = 'active'").fetchone()
    if session:
        return jsonify(dict(session))
    return jsonify(None)

@sessions_api.route('/sessions/start', methods=['POST'])
def start_session():
    """Bắt đầu một phiên chơi mới và reset chỉ số phiên của người chơi và sân.""" # <-- Cập nhật mô tả
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Kiểm tra xem có phiên nào đang hoạt động không
    active_session = cursor.execute("SELECT id FROM sessions WHERE status = 'active'").fetchone()
    if active_session:
        return jsonify({'error': 'Một phiên chơi khác đang diễn ra. Vui lòng kết thúc phiên đó trước.'}), 409

    try:
        # 2. Reset tất cả chỉ số phiên của người chơi
        cursor.execute("""
            UPDATE players 
            SET 
                session_matches_played = 0, 
                session_wins = 0, 
                session_last_played = NULL,
                consecutive_matches = 0
        """)

        # [MỚI] Reset chỉ số lượt sân
        cursor.execute("UPDATE courts SET session_turns = 0")

        # 3. Tạo phiên mới
        cursor.execute("INSERT INTO sessions (status) VALUES ('active')")
        
        conn.commit()
        return jsonify({'message': 'Phiên chơi mới đã bắt đầu thành công!'}), 201
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        pass



@sessions_api.route('/sessions/end', methods=['POST'])
def end_session():
    """Kết thúc phiên chơi hiện tại."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Tìm phiên đang hoạt động
    active_session_row = cursor.execute("SELECT id FROM sessions WHERE status = 'active'").fetchone()
    if not active_session_row:
        return jsonify({'error': 'Không có phiên nào đang hoạt động để kết thúc.'}), 404
    
    active_session_id = active_session_row['id']

    try:
        # 2. Cập nhật trạng thái phiên
        cursor.execute(
            "UPDATE sessions SET status = 'finished', end_time = datetime('now', 'localtime') WHERE id = ?",
            (active_session_id,)
        )

        # 3. Reset trạng thái có mặt của tất cả người chơi
        cursor.execute("UPDATE players SET is_active = 0")
        
        conn.commit()
        return jsonify({'message': 'Phiên chơi đã kết thúc. Hẹn gặp lại lần sau!'})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:   
        pass
# api/suggestions.py
from flask import Blueprint, request, jsonify
import sqlite3
import logic

suggestions_api = Blueprint('suggestions_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db')
    conn.row_factory = sqlite3.Row
    return conn

@suggestions_api.route('/suggestions', methods=['POST'])
def get_suggestions():
    data = request.get_json()
    if not data or 'player_ids' not in data:
        return jsonify({'error': 'Cần cung cấp player_ids'}), 400

    player_ids = data.get('player_ids')
    if not player_ids or len(player_ids) < 4:
        return jsonify({'suggestions': []})

    rules = {
        'prioritize_rest': data.get('prioritize_rest', False),
        'prioritize_low_games': data.get('prioritize_low_games', True),
        'avoid_rematch': data.get('avoid_rematch', True)
    }
    
    conn = get_db_connection()
    cursor = conn.cursor()

    # --- [LOGIC MỚI] RESET BỘ ĐẾM CHO NGƯỜI CHƠI ĐÃ NGHỈ ---
    try:
        # Lấy ID người chơi đang trong trận 'ongoing'
        ongoing_player_rows = cursor.execute('''
            SELECT DISTINCT player_id FROM match_players WHERE match_id IN (
                SELECT id FROM matches WHERE status = 'ongoing'
            )
        ''').fetchall()
        ongoing_player_ids = {row['player_id'] for row in ongoing_player_rows}

        # Lấy ID người chơi có mặt
        active_player_rows = cursor.execute('SELECT id FROM players WHERE is_active = 1').fetchall()
        active_player_ids = {row['id'] for row in active_player_rows}

        # Người chơi đã nghỉ = (người có mặt) - (người đang chơi)
        rested_player_ids = list(active_player_ids - ongoing_player_ids)

        if rested_player_ids:
            placeholders = ','.join('?' for _ in rested_player_ids)
            cursor.execute(f'UPDATE players SET consecutive_matches = 0 WHERE id IN ({placeholders})', rested_player_ids)
            conn.commit()
    except sqlite3.Error as e:
        print(f"Lỗi database khi reset bộ đếm: {e}")
        conn.rollback()
    # --- KẾT THÚC LOGIC MỚI ---

    # Query để lấy người chơi có thể thi đấu từ danh sách được chọn
    placeholders = ','.join('?' for _ in player_ids)
    query = f"SELECT * FROM players WHERE id IN ({placeholders}) AND consecutive_matches < 2"
    
    selected_players = conn.execute(query, player_ids).fetchall()
    empty_courts = conn.execute('SELECT * FROM courts WHERE id NOT IN (SELECT court_id FROM matches WHERE status = "ongoing")').fetchall()
    
    selected_players_dict = [dict(p) for p in selected_players]
    empty_courts_dict = [dict(c) for c in empty_courts]
    
    suggestions = logic.suggest_matches(selected_players_dict, empty_courts_dict, rules, conn)
    
    conn.close()
    return jsonify({'suggestions': suggestions})
# api/matches.py
from flask import Blueprint, request, jsonify
import sqlite3
import logic

matches_api = Blueprint('matches_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db', timeout=15)
    conn.row_factory = sqlite3.Row
    return conn

@matches_api.route('/matches/queue', methods=['POST'])
def queue_match():
    data = request.get_json()
    court_id, team_a, team_b = data.get('court_id'), data.get('team_A'), data.get('team_B')
    # Đoạn code mới
    if not all([court_id, team_a is not None, team_b is not None]):
        return jsonify({'error': 'Thiếu dữ liệu sân hoặc đội'}), 400

    # Kiểm tra mỗi đội có từ 1 đến 2 người
    if not (1 <= len(team_a) <= 2 and 1 <= len(team_b) <= 2):
        return jsonify({'error': 'Mỗi đội phải có từ 1 đến 2 người chơi'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO matches (court_id, status) VALUES (?, 'queued')", (court_id,))
        match_id = cursor.lastrowid
        
        players_data = []
        for player in team_a:
            players_data.append((match_id, player['id'], 'A', player['elo_rating']))
        for player in team_b:
            players_data.append((match_id, player['id'], 'B', player['elo_rating']))
            
        cursor.executemany("INSERT INTO match_players (match_id, player_id, team, elo_before) VALUES (?, ?, ?, ?)", players_data)
        conn.commit()
        return jsonify({'message': 'Đã thêm trận đấu vào hàng chờ!', 'match_id': match_id}), 201
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

@matches_api.route('/matches/<int:match_id>/begin', methods=['POST'])
def begin_queued_match(match_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE matches SET status = 'ongoing', start_time = datetime('now', 'localtime') WHERE id = ? AND status = 'queued'",
            (match_id,)
        )
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Không tìm thấy trận đấu trong hàng chờ hoặc trận đã bắt đầu'}), 404

        player_rows = cursor.execute("SELECT player_id FROM match_players WHERE match_id = ?", (match_id,)).fetchall()
        player_ids = [row['player_id'] for row in player_rows]

        if player_ids:
            placeholders = ','.join('?' for _ in player_ids)
            sql = f'UPDATE players SET consecutive_matches = consecutive_matches + 1 WHERE id IN ({placeholders})'
            cursor.execute(sql, player_ids)
        
        conn.commit()
        return jsonify({'message': 'Trận đấu đã chính thức bắt đầu!'})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

@matches_api.route('/matches/<int:match_id>/finish', methods=['POST'])
def finish_match(match_id):
    data = request.get_json()
    score_a = data.get('score_A')
    score_b = data.get('score_B')

    if score_a is None or score_b is None or score_a == score_b:
        return jsonify({'error': 'Điểm số không hợp lệ.'}), 400

    settings = logic.load_settings()
    winning_team = 'A' if score_a > score_b else 'B'
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        player_rows = cursor.execute(
            'SELECT p.id, p.total_matches_played, p.total_wins, mp.team FROM players p JOIN match_players mp ON p.id = mp.player_id WHERE mp.match_id = ?',
            (match_id,)
        ).fetchall()

        for row in player_rows:
            won_match = 1 if row['team'] == winning_team else 0
            new_total_matches = row['total_matches_played'] + 1
            new_wins = row['total_wins'] + won_match
            new_win_rate = new_wins / new_total_matches
            
            cursor.execute(
            "UPDATE matches SET status = 'finished', end_time = datetime('now', 'localtime'), winning_team = ?, score_A = ?, score_B = ? WHERE id = ?",
            (winning_team, score_a, score_b, match_id)
        )

            cursor.execute(
                '''UPDATE players SET 
                       elo_rating = ?, 
                       total_matches_played = ?, 
                       total_wins = ?, 
                       win_rate = ?, 
                       last_played_date = datetime('now', 'localtime'),
                       session_matches_played = ?,  -- Dòng mới
                       session_wins = ?,            -- Dòng mới
                       session_last_played = datetime('now', 'localtime') -- Dòng mới
                   WHERE id = ?''',
                (new_elo, new_total_matches, new_wins, new_win_rate, 
                 new_session_matches, new_session_wins, player['id'])
            )
            cursor.execute('UPDATE match_players SET elo_after = ? WHERE match_id = ? AND player_id = ?',
                        (new_elo, match_id, player['id']))

        for p in team_a_players:
            k = logic.get_dynamic_k_factor(p, settings)
            elo_change = k * (result_for_a - expected_a)
            update_player_stats(p, elo_change, winning_team == 'A')

        for p in team_b_players:
            k = logic.get_dynamic_k_factor(p, settings)
            elo_change = k * ((1 - result_for_a) - (1 - expected_a))
            update_player_stats(p, elo_change, winning_team == 'B')
        
        logic.update_pair_history(team_a_players, cursor)
        logic.update_pair_history(team_b_players, cursor)
        
        cursor.execute(
            "UPDATE matches SET status = 'finished', end_time = datetime('now', 'localtime'), winning_team = ?, score_A = ?, score_B = ? WHERE id = ?",
            (winning_team, score_a, score_b, match_id)
        )
        conn.commit()
        match_info = cursor.execute("SELECT court_id FROM matches WHERE id = ?", (match_id,)).fetchone()
        if match_info:
            court_id = match_info['court_id']
            cursor.execute("UPDATE courts SET session_turns = session_turns + 1 WHERE id = ?", (court_id,))

        conn.commit()

        # Logic reset consecutive_matches cho người chơi đã nghỉ
        active_rows = cursor.execute('SELECT id FROM players WHERE is_active = 1').fetchall()
        active_ids = {row['id'] for row in active_rows}
        ongoing_rows = cursor.execute("SELECT DISTINCT player_id FROM match_players WHERE match_id IN (SELECT id FROM matches WHERE status = 'ongoing')").fetchall()
        ongoing_ids = {row['player_id'] for row in ongoing_rows}
        rested_ids = list(active_ids - ongoing_ids)

        if rested_ids:
            placeholders = ','.join('?' for _ in rested_ids)
            sql = f'UPDATE players SET consecutive_matches = 0 WHERE id IN ({placeholders})'
            cursor.execute(sql, rested_ids)
            conn.commit()

        return jsonify({'message': 'Trận đấu đã kết thúc và dữ liệu đã được cập nhật.'}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

@matches_api.route('/matches/ongoing', methods=['GET'])
def get_ongoing_matches():
    query = """
        SELECT m.id as match_id, m.court_id, c.name as court_name, m.start_time,
               p.id as player_id, p.name as player_name, mp.team
        FROM matches m JOIN courts c ON m.court_id = c.id
        JOIN match_players mp ON m.id = mp.match_id
        JOIN players p ON mp.player_id = p.id
        WHERE m.status = 'ongoing' ORDER BY m.id, mp.team;
    """
    conn = get_db_connection()
    rows = conn.execute(query).fetchall()
    matches = {}
    for row in rows:
        mid = row['match_id']
        if mid not in matches:
            matches[mid] = {'id': mid, 'court_id': row['court_id'], 'court_name': row['court_name'], 'start_time': row['start_time'], 'team_A': [], 'team_B': []}
        player = {'id': row['player_id'], 'name': row['player_name']}
        matches[mid][f"team_{row['team']}"].append(player)
    conn.close()
    return jsonify(list(matches.values()))

@matches_api.route('/matches/queued', methods=['GET'])
def get_queued_matches():
    query = """
        SELECT m.id as match_id, m.court_id, c.name as court_name,
               p.id as player_id, p.name as player_name, mp.team
        FROM matches m JOIN courts c ON m.court_id = c.id
        JOIN match_players mp ON m.id = mp.match_id
        JOIN players p ON mp.player_id = p.id
        WHERE m.status = 'queued' ORDER BY m.id, mp.team;
    """
    conn = get_db_connection()
    rows = conn.execute(query).fetchall()
    matches = {}
    for row in rows:
        mid = row['match_id']
        if mid not in matches:
            matches[mid] = {'id': mid, 'court_id': row['court_id'], 'court_name': row['court_name'], 'team_A': [], 'team_B': []}
        player = {'id': row['player_id'], 'name': row['player_name']}
        matches[mid][f"team_{row['team']}"].append(player)
    conn.close()
    return jsonify(list(matches.values()))
    
@matches_api.route('/matches/history', methods=['GET'])
def get_match_history():
    query = """
        SELECT
            m.id as match_id, m.end_time, m.winning_team, m.score_A, m.score_B, 
            c.name as court_name, p.id as player_id, p.name as player_name, 
            mp.team
        FROM matches m
        JOIN courts c ON m.court_id = c.id
        JOIN match_players mp ON m.id = mp.match_id
        JOIN players p ON mp.player_id = p.id
        WHERE m.status = 'finished'
        ORDER BY m.end_time DESC, m.id, mp.team;
    """
    conn = get_db_connection()
    rows = conn.execute(query).fetchall()
    conn.close()
    matches = {}
    for row in rows:
        mid = row['match_id']
        if mid not in matches:
            matches[mid] = {
                'id': mid, 'court_name': row['court_name'], 'end_time': row['end_time'],
                'winning_team': row['winning_team'], 'score_A': row['score_A'],
                'score_B': row['score_B'], 'team_A': [], 'team_B': []
            }

        
        player = {
            'id': row['player_id'], 'name': row['player_name']
        }
        matches[mid][f"team_{row['team']}"].append(player)
        
    return jsonify(list(matches.values()))
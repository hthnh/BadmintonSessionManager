# api/matches.py
from flask import Blueprint, request, jsonify
import sqlite3
import logic 

matches_api = Blueprint('matches_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db', timeout=15)
    conn.row_factory = sqlite3.Row
    return conn

@matches_api.route('/matches/start', methods=['POST'])
def start_match():
    data = request.get_json()
    court_id, team_a, team_b = data.get('court_id'), data.get('team_A'), data.get('team_B')
    if not all([court_id, team_a, team_b]) or len(team_a) != 2 or len(team_b) != 2:
        return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO matches (court_id, status, start_time) VALUES (?, 'ongoing', datetime('now', 'localtime'))", (court_id,))
        match_id = cursor.lastrowid
        
        players_in_match_data = []
        player_ids_in_match = []
        for player in team_a: 
            players_in_match_data.append((match_id, player['id'], 'A', player['elo_rating']))
            player_ids_in_match.append(player['id'])
        for player in team_b: 
            players_in_match_data.append((match_id, player['id'], 'B', player['elo_rating']))
            player_ids_in_match.append(player['id'])
            
        cursor.executemany("INSERT INTO match_players (match_id, player_id, team, elo_before) VALUES (?, ?, ?, ?)", players_in_match_data)

        # --- [LOGIC MỚI] TĂNG BỘ ĐẾM NGAY KHI BẮT ĐẦU TRẬN ---
        placeholders = ','.join('?' for _ in player_ids_in_match)
        cursor.execute(
            f'UPDATE players SET consecutive_matches = consecutive_matches + 1 WHERE id IN ({placeholders})',
            player_ids_in_match
        )
        # --- KẾT THÚC LOGIC MỚI ---

        conn.commit()
        return jsonify({'message': 'Trận đấu đã bắt đầu!', 'match_id': match_id}), 201
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()



@matches_api.route('/matches/create', methods=['POST'])
def create_match():
    data = request.get_json()
    court_id, player_ids = data.get('court_id'), data.get('player_ids')
    if not all([court_id, player_ids]) or len(player_ids) != 4:
        return jsonify({'error': 'Dữ liệu không hợp lệ: Cần court_id và đúng 4 player_ids'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        placeholders = ','.join('?' for _ in player_ids)
        query = f'SELECT * FROM players WHERE id IN ({placeholders})'
        players_from_db = cursor.execute(query, player_ids).fetchall()
        if len(players_from_db) != 4:
            return jsonify({'error': 'Một hoặc nhiều ID người chơi không tồn tại'}), 404
            
        group_of_4 = [dict(p) for p in players_from_db]
        (team_a, team_b), elo_diff = logic.find_best_pairing_for_group(group_of_4)
        
        cursor.execute("INSERT INTO matches (court_id, status, start_time) VALUES (?, 'ongoing', datetime('now', 'localtime'))", (court_id,))
        match_id = cursor.lastrowid
        
        players_in_match_data = []
        for p in team_a: players_in_match_data.append((match_id, p['id'], 'A', p['elo_rating']))
        for p in team_b: players_in_match_data.append((match_id, p['id'], 'B', p['elo_rating']))
        cursor.executemany("INSERT INTO match_players (match_id, player_id, team, elo_before) VALUES (?, ?, ?, ?)", players_in_match_data)

        # --- [LOGIC MỚI] TĂNG BỘ ĐẾM NGAY KHI BẮT ĐẦU TRẬN ---
        all_player_ids_in_match = [p['id'] for p in group_of_4]
        placeholders_update = ','.join('?' for _ in all_player_ids_in_match)
        cursor.execute(
            f'UPDATE players SET consecutive_matches = consecutive_matches + 1 WHERE id IN ({placeholders_update})',
            all_player_ids_in_match
        )
        # --- KẾT THÚC LOGIC MỚI ---
        
        conn.commit()
        return jsonify({'message': f'Trận đấu đã bắt đầu trên sân {court_id}!', 'match_id': match_id, 'team_A': team_a, 'team_B': team_b, 'elo_difference': elo_diff}), 201
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()


# [MỚI] API để thêm một trận đấu vào hàng chờ
@matches_api.route('/matches/queue', methods=['POST'])
def queue_match():
    data = request.get_json()
    court_id, team_a, team_b = data.get('court_id'), data.get('team_A'), data.get('team_B')
    if not all([court_id, team_a, team_b]):
        return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Tạo trận đấu với status = 'queued', chưa có start_time
        cursor.execute("INSERT INTO matches (court_id, status) VALUES (?, 'queued')", (court_id,))
        match_id = cursor.lastrowid
        
        players_in_match_data = []
        for player in team_a: 
            players_in_match_data.append((match_id, player['id'], 'A', player['elo_rating']))
        for player in team_b: 
            players_in_match_data.append((match_id, player['id'], 'B', player['elo_rating']))
            
        cursor.executemany("INSERT INTO match_players (match_id, player_id, team, elo_before) VALUES (?, ?, ?, ?)", players_in_match_data)
        
        # Lưu ý: Không tăng consecutive_matches ở bước này
        conn.commit()
        return jsonify({'message': 'Đã thêm trận đấu vào hàng chờ!', 'match_id': match_id}), 201
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

# [MỚI] API để bắt đầu một trận đấu từ hàng chờ
@matches_api.route('/matches/<int:match_id>/begin', methods=['POST'])
def begin_queued_match(match_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Cập nhật trạng thái và thời gian bắt đầu
        cursor.execute(
            "UPDATE matches SET status = 'ongoing', start_time = datetime('now', 'localtime') WHERE id = ? AND status = 'queued'",
            (match_id,)
        )
        if cursor.rowcount == 0:
            return jsonify({'error': 'Không tìm thấy trận đấu trong hàng chờ hoặc trận đã bắt đầu'}), 404

        # Lấy player_ids từ trận đấu này
        player_rows = cursor.execute("SELECT player_id FROM match_players WHERE match_id = ?", (match_id,)).fetchall()
        player_ids_in_match = [row['player_id'] for row in player_rows]

        # Tăng bộ đếm consecutive_matches cho những người chơi này
        if player_ids_in_match:
            placeholders = ','.join('?' for _ in player_ids_in_match)
            cursor.execute(
                f'UPDATE players SET consecutive_matches = consecutive_matches + 1 WHERE id IN ({placeholders})',
                player_ids_in_match
            )
        
        conn.commit()
        return jsonify({'message': 'Trận đấu đã chính thức bắt đầu!'})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

# [MỚI] API để lấy danh sách các trận đang trong hàng chờ
@matches_api.route('/matches/queued', methods=['GET'])
def get_queued_matches():
    query = """
        SELECT m.id as match_id, m.court_id, c.name as court_name,
               p.id as player_id, p.name as player_name, mp.team, mp.elo_before
        FROM matches m JOIN courts c ON m.court_id = c.id
        JOIN match_players mp ON m.id = mp.match_id
        JOIN players p ON mp.player_id = p.id
        WHERE m.status = 'queued' ORDER BY m.id, mp.team;
    """
    conn = get_db_connection()
    rows = conn.execute(query).fetchall()
    matches_dict = {}
    for row in rows:
        match_id = row['match_id']
        if match_id not in matches_dict:
            matches_dict[match_id] = {'id': match_id, 'court_id': row['court_id'], 'court_name': row['court_name'], 'team_A': [], 'team_B': []}
        player_info = {'id': row['player_id'], 'name': row['player_name'], 'elo_before': row['elo_before']}
        if row['team'] == 'A':
            matches_dict[match_id]['team_A'].append(player_info)
        else:
            matches_dict[match_id]['team_B'].append(player_info)
    conn.close()
    return jsonify(list(matches_dict.values()))

# --- CÁC API CŨ VẪN GIỮ NGUYÊN ---
# (finish_match, get_ongoing_matches, get_match_history)
@matches_api.route('/matches/<int:match_id>/finish', methods=['POST'])
def finish_match(match_id):
    data = request.get_json()
    score_a = data.get('score_A')
    score_b = data.get('score_B')

    if score_a is None or score_b is None or score_a == score_b:
        return jsonify({'error': 'Điểm số không hợp lệ.'}), 400

    winning_team = 'A' if score_a > score_b else 'B'
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        players_rows = conn.execute(
            'SELECT p.id, p.elo_rating, p.total_matches_played, p.total_wins, mp.team, p.gender '
            'FROM players p JOIN match_players mp ON p.id = mp.player_id WHERE mp.match_id = ?', (match_id,)
        ).fetchall()
        players = [dict(row) for row in players_rows]
        if len(players) != 4:
            return jsonify({'error': 'Không tìm thấy đủ người chơi cho trận đấu này'}), 404

        team_a_players = [p for p in players if p['team'] == 'A']
        team_b_players = [p for p in players if p['team'] == 'B']
        
        elo_team_a = (team_a_players[0]['elo_rating'] + team_b_players[0]['elo_rating']) / 2
        elo_team_b = (team_a_players[1]['elo_rating'] + team_b_players[1]['elo_rating']) / 2
        expected_a = 1 / (1 + logic.ELO_BASE**((elo_team_b - elo_team_a) / logic.SCALING_FACTOR))
        result_for_a = 1 if winning_team == 'A' else 0

        def update_player_stats(player, elo_change_amount, won_match):
            new_elo = player['elo_rating'] + elo_change_amount
            new_total_matches = player['total_matches_played'] + 1
            new_wins = player['total_wins'] + 1 if won_match else player['total_wins']
            new_win_rate = new_wins / new_total_matches if new_total_matches > 0 else 0.0
            cursor.execute(
                '''UPDATE players SET elo_rating = ?, total_matches_played = ?, total_wins = ?, win_rate = ?, last_played_date = datetime('now', 'localtime') WHERE id = ?''',
                (new_elo, new_total_matches, new_wins, new_win_rate, player['id'])
            )
            cursor.execute('UPDATE match_players SET elo_after = ? WHERE match_id = ? AND player_id = ?',
                        (new_elo, match_id, player['id']))
        for p in team_a_players:
            k_factor = logic.get_dynamic_k_factor(p)
            elo_change = k_factor * (result_for_a - expected_a)
            update_player_stats(p, elo_change, winning_team == 'A')
        for p in team_b_players:
            k_factor = logic.get_dynamic_k_factor(p)
            elo_change = - (k_factor * (result_for_a - expected_a))
            update_player_stats(p, elo_change, winning_team == 'B')
        
        logic.update_pair_history(team_a_players, cursor)
        logic.update_pair_history(team_b_players, cursor)
        
        cursor.execute("""
            UPDATE matches SET status = 'finished', end_time = datetime('now', 'localtime'), winning_team = ?, score_A = ?, score_B = ?
            WHERE id = ?
        """, (winning_team, score_a, score_b, match_id))

        conn.commit()
        return jsonify({'message': 'Trận đấu đã kết thúc. ELO, điểm số và lịch sử cặp đôi đã được cập nhật.'}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

@matches_api.route('/matches/ongoing', methods=['GET'])
def get_ongoing_matches():
    query = """
        SELECT m.id as match_id, m.court_id, c.name as court_name,
               p.id as player_id, p.name as player_name, mp.team, mp.elo_before, m.start_time
        FROM matches m JOIN courts c ON m.court_id = c.id
        JOIN match_players mp ON m.id = mp.match_id
        JOIN players p ON mp.player_id = p.id
        WHERE m.status = 'ongoing' ORDER BY m.id, mp.team;
    """
    conn = get_db_connection()
    rows = conn.execute(query).fetchall()
    matches_dict = {}
    for row in rows:
        match_id = row['match_id']
        if match_id not in matches_dict:
            matches_dict[match_id] = {'id': match_id, 'court_id': row['court_id'], 'court_name': row['court_name'], 'start_time': row['start_time'], 'team_A': [], 'team_B': []}
        player_info = {'id': row['player_id'], 'name': row['player_name'], 'elo_before': row['elo_before']}
        if row['team'] == 'A':
            matches_dict[match_id]['team_A'].append(player_info)
        else:
            matches_dict[match_id]['team_B'].append(player_info)
    conn.close()
    return jsonify(list(matches_dict.values()))
    
@matches_api.route('/matches/history', methods=['GET'])
def get_match_history():
    query = """
        SELECT
            m.id as match_id, m.start_time, m.end_time, m.winning_team,
            m.score_A, m.score_B, c.name as court_name, p.id as player_id,
            p.name as player_name, mp.team, mp.elo_before, mp.elo_after
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
    matches_dict = {}
    for row in rows:
        match_id = row['match_id']
        if match_id not in matches_dict:
            matches_dict[match_id] = {
                'id': match_id, 'court_name': row['court_name'], 'start_time': row['start_time'],
                'end_time': row['end_time'], 'winning_team': row['winning_team'],
                'score_A': row['score_A'], 'score_B': row['score_B'],
                'team_A': [], 'team_B': []
            }
        elo_change = (row['elo_after'] - row['elo_before']) if row['elo_after'] is not None else 0
        player_info = {
            'id': row['player_id'], 'name': row['player_name'],
            'elo_before': round(row['elo_before']),
            'elo_after': round(row['elo_after']) if row['elo_after'] is not None else 'N/A',
            'elo_change': round(elo_change, 2)
        }
        if row['team'] == 'A':
            matches_dict[match_id]['team_A'].append(player_info)
        else:
            matches_dict[match_id]['team_B'].append(player_info)
    return jsonify(list(matches_dict.values()))
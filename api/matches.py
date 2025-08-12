# api/matches.py
from flask import Blueprint, request, jsonify
import sqlite3
import logic # Import file logic chung của chúng ta

matches_api = Blueprint('matches_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db')
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
        # Trong tương lai, bạn có thể thêm match_type='doubles' vào đây
        cursor.execute("INSERT INTO matches (court_id, status) VALUES (?, 'ongoing')", (court_id,))
        match_id = cursor.lastrowid
        players_in_match = []
        for player in team_a: players_in_match.append((match_id, player['id'], 'A', player['elo_rating']))
        for player in team_b: players_in_match.append((match_id, player['id'], 'B', player['elo_rating']))
        cursor.executemany("INSERT INTO match_players (match_id, player_id, team, elo_before) VALUES (?, ?, ?, ?)", players_in_match)
        conn.commit()
        return jsonify({'message': 'Trận đấu đã bắt đầu!', 'match_id': match_id}), 201
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

@matches_api.route('/matches/<int:match_id>/finish', methods=['POST'])
def finish_match(match_id):
    data = request.get_json()
    winning_team = data.get('winning_team')
    if winning_team not in ['A', 'B']: return jsonify({'error': 'Đội thắng không hợp lệ'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        players = conn.execute(
            'SELECT p.id, p.elo_rating, p.total_matches_played, p.total_wins, mp.team, p.gender '
            'FROM players p JOIN match_players mp ON p.id = mp.player_id WHERE mp.match_id = ?', (match_id,)
        ).fetchall()
        if len(players) != 4: return jsonify({'error': 'Không tìm thấy đủ người chơi cho trận đấu này'}), 404
        
        team_a_players = [p for p in players if p['team'] == 'A']
        team_b_players = [p for p in players if p['team'] == 'B']
        
        elo_team_a = (team_a_players[0]['elo_rating'] + team_a_players[1]['elo_rating']) / 2
        elo_team_b = (team_b_players[0]['elo_rating'] + team_b_players[1]['elo_rating']) / 2
        
        expected_a = 1 / (1 + logic.ELO_BASE**((elo_team_b - elo_team_a) / logic.SCALING_FACTOR))
        result_for_a = 1 if winning_team == 'A' else 0

        def update_player_stats(player, elo_change_amount, won_match):
            new_elo = player['elo_rating'] + elo_change_amount
            new_wins = player['total_wins'] + 1 if won_match else player['total_wins']
            cursor.execute(
                'UPDATE players SET elo_rating = ?, total_matches_played = total_matches_played + 1, total_wins = ?, last_played_date = CURRENT_TIMESTAMP WHERE id = ?',
                (new_elo, new_wins, player['id'])
            )
            cursor.execute('UPDATE match_players SET elo_after = ? WHERE match_id = ? AND player_id = ?', (new_elo, match_id, player['id']))

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

        cursor.execute("UPDATE matches SET status = 'finished', end_time = CURRENT_TIMESTAMP, winning_team = ? WHERE id = ?", (winning_team, match_id))
        conn.commit()
        return jsonify({'message': 'Trận đấu đã kết thúc. ELO và lịch sử cặp đôi đã được cập nhật.'}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

@matches_api.route('/matches/ongoing', methods=['GET'])
def get_ongoing_matches():
    query = """
        SELECT m.id as match_id, m.court_id, c.name as court_name,
               p.id as player_id, p.name as player_name, mp.team, mp.elo_before
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
            matches_dict[match_id] = {'id': match_id, 'court_id': row['court_id'], 'court_name': row['court_name'], 'team_A': [], 'team_B': []}
        player_info = {'id': row['player_id'], 'name': row['player_name'], 'elo_before': row['elo_before']}
        if row['team'] == 'A':
            matches_dict[match_id]['team_A'].append(player_info)
        else:
            matches_dict[match_id]['team_B'].append(player_info)
    conn.close()
    return jsonify(list(matches_dict.values()))

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
        cursor.execute("INSERT INTO matches (court_id, status) VALUES (?, 'ongoing')", (court_id,))
        match_id = cursor.lastrowid
        players_in_match = []
        for p in team_a: players_in_match.append((match_id, p['id'], 'A', p['elo_rating']))
        for p in team_b: players_in_match.append((match_id, p['id'], 'B', p['elo_rating']))
        cursor.executemany("INSERT INTO match_players (match_id, player_id, team, elo_before) VALUES (?, ?, ?, ?)", players_in_match)
        conn.commit()
        return jsonify({'message': f'Trận đấu đã bắt đầu trên sân {court_id}!', 'match_id': match_id, 'team_A': team_a, 'team_B': team_b, 'elo_difference': elo_diff}), 201
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()
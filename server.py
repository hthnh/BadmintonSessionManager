from flask import Flask, render_template, request, jsonify
import sqlite3
import os
import itertools 
from datetime import datetime


SCALING_FACTOR = 400
ELO_BASE = 10

# --- Hằng số cho thuật toán gợi ý trận đấu ---
REST_PRIORITY_WEIGHT = 0.01
LOW_GAMES_PENALTY_WEIGHT = 0.1
REMATCH_PENALTY_WEIGHT = 10


# --- Cấu hình và Khởi tạo Ứng dụng ---
app = Flask(__name__,
            static_folder='static',
            template_folder='templates')

DATABASE_NAME = 'badminton.db'

# --- Hàm trợ giúp kết nối Database ---
def get_db_connection():
    """Tạo kết nối đến database. Trả về các dòng dưới dạng dictionary."""
    conn = sqlite3.connect(DATABASE_NAME)
    # Dòng này rất quan trọng, nó giúp chuyển đổi kết quả từ tuple sang dictionary
    # để dễ dàng chuyển thành JSON.
    conn.row_factory = sqlite3.Row
    return conn

# --- Route phục vụ Frontend ---
@app.route('/')
def home():
    """Phục vụ trang chủ index.html."""
    return render_template('index.html')







# =====================================================
#                CÁC HÀM LOGIC TÍNH TOÁN
# =====================================================

def _calculate_elo_change(player_a1_elo, player_a2_elo, player_b1_elo, player_b2_elo, result, k_factor):
    """
    Tính toán sự thay đổi ELO cho Đội A.
    - result: 1 nếu Đội A thắng, 0 nếu Đội A thua.
    """
    elo_team_a = (player_a1_elo + player_a2_elo) / 2
    elo_team_b = (player_b1_elo + player_b2_elo) / 2

    expected_a = 1 / (1 + ELO_BASE**((elo_team_b - elo_team_a) / SCALING_FACTOR))

    # Tính toán lượng ELO thay đổi
    elo_change = k_factor * (result - expected_a)
    return elo_change

def _get_dynamic_k_factor(player):
    """
    Lấy K-Factor dựa trên số trận đã chơi của người chơi.
    - player: một dictionary chứa thông tin người chơi, bao gồm 'total_matches_played'.
    """
    matches_played = player.get('total_matches_played', 0)
    if matches_played < 20:
        return 48  # K-factor cao cho người chơi mới (< 20 trận)
    elif matches_played < 50:
        return 32  # K-factor trung bình cho người chơi đang phát triển
    else:
        return 24  # K-factor thấp cho người chơi đã có thứ hạng ổn định

def _find_best_pairing_for_group(group_of_4):
    """
    Với một nhóm 4 người, tìm ra cách chia đội cân bằng nhất.
    Trả về cặp đấu tốt nhất và chênh lệch ELO của cặp đó.
    """
    p = group_of_4
    # Tất cả 3 cách chia đội có thể
    possible_pairings = [
        ((p[0], p[1]), (p[2], p[3])),
        ((p[0], p[2]), (p[1], p[3])),
        ((p[0], p[3]), (p[1], p[2]))
    ]

    best_pairing = None
    min_elo_diff = float('inf')

    for team_a, team_b in possible_pairings:
        elo_team_a = (team_a[0]['elo_rating'] + team_a[1]['elo_rating']) / 2
        elo_team_b = (team_b[0]['elo_rating'] + team_b[1]['elo_rating']) / 2
        elo_diff = abs(elo_team_a - elo_team_b)

        if elo_diff < min_elo_diff:
            min_elo_diff = elo_diff
            best_pairing = (list(team_a), list(team_b))

    return best_pairing, min_elo_diff

def _suggest_matches(active_players, empty_courts, rules):
    """
    Thuật toán chính để gợi ý các trận đấu dựa trên các quy tắc từ frontend.
    - rules: một dictionary ví dụ {'prioritize_rest': True, 'avoid_rematch': True}
    """
    if len(active_players) < 4:
        return []

    num_matches_to_suggest = min(len(empty_courts), len(active_players) // 4)
    if num_matches_to_suggest == 0:
        return []

    # Tạo tất cả các nhóm 4 người có thể
    possible_groups = list(itertools.combinations(active_players, 4))
    
    scored_groups = []
    for group in possible_groups:
        pairing, elo_diff = _find_best_pairing_for_group(group)
        
        # === TÍNH TOÁN ĐIỂM SỐ KẾT HỢP ===
        # Điểm số khởi tạo, chênh lệch ELO càng thấp, điểm càng tốt.
        score = elo_diff
        
        # --- Quy tắc 1: Ưu tiên người nghỉ lâu nhất ---
        if rules.get('prioritize_rest'):
            # Tính tổng thời gian nghỉ của cả nhóm (tính bằng giây)
            # Người chưa chơi (last_played_date is None) sẽ được ưu tiên cao nhất.
            now = datetime.now()
            total_rest_time = 0
            for p in group:
                if p['last_played_date']:
                    # Chuyển đổi chuỗi timestamp từ DB về đối tượng datetime
                    last_played = datetime.fromisoformat(p['last_played_date'])
                    total_rest_time += (now - last_played).total_seconds()
                else:
                    # Gán một giá trị rất lớn để ưu tiên người chưa chơi
                    total_rest_time += 999999 
            
            # Chúng ta muốn thời gian nghỉ CÀNG LỚN CÀNG TỐT, nhưng điểm số thì CÀNG NHỎ CÀNG TỐT.
            # Vì vậy, ta lấy số nghịch đảo và nhân với một hệ số để nó có ảnh hưởng.
            # Tránh chia cho 0.
            if total_rest_time > 0:
                score -= (total_rest_time / 4) * REST_PRIORITY_WEIGHT

        # --- Quy tắc 2: Ưu tiên người chơi ít nhất ---
        if rules.get('prioritize_low_games'):
            total_games = sum(p['total_matches_played'] for p in group)
            # Thêm điểm phạt nếu nhóm này đã chơi quá nhiều.
            # Mỗi trận đã chơi sẽ tăng điểm số (làm nó tệ đi) một chút.
            score += total_games * LOW_GAMES_PENALTY_WEIGHT

        # --- Quy tắc 3: Ưu tiên cặp đôi mới ---
        if rules.get('avoid_rematch'):
            # Logic này yêu cầu truy vấn lịch sử các cặp đã đấu.
            # Đây là một ví dụ giả định, bạn cần có bảng pair_history.
            # team_a, team_b = pairing
            # pair1_history = get_pair_history(team_a[0]['id'], team_a[1]['id'])
            # pair2_history = get_pair_history(team_b[0]['id'], team_b[1]['id'])
            # score += (pair1_history + pair2_history) * REMATCH_PENALTY_WEIGHT
            pass # Tạm thời bỏ qua để đơn giản hóa

        scored_groups.append({'score': score, 'pairing': pairing})

    # Sắp xếp các nhóm dựa trên điểm số tổng hợp (điểm thấp nhất là tốt nhất)
    scored_groups.sort(key=lambda x: x['score'])

    suggestions = []
    used_player_ids = set()

    for court in empty_courts:
        best_available_match = None
        for group in scored_groups:
            player_ids_in_group = {p['id'] for p in group['pairing'][0]} | {p['id'] for p in group['pairing'][1]}
            if not player_ids_in_group.intersection(used_player_ids):
                best_available_match = group
                break
        
        if best_available_match:
            team_a, team_b = best_available_match['pairing']
            suggestions.append({
                'court_id': court['id'],
                'court_name': court['name'],
                'team_A': team_a,
                'team_B': team_b,
                'balance_score': round(best_available_match['score'], 2)
            })
            used_player_ids.update({p['id'] for p in team_a} | {p['id'] for p in team_b})
        
        if len(suggestions) >= num_matches_to_suggest:
            break
            
    return suggestions










# =====================================================
#                CÁC API ENDPOINTS
# =====================================================

# --- API cho Người chơi (Players) ---

@app.route('/api/players', methods=['GET'])
def get_players():
    """API để lấy danh sách tất cả người chơi."""
    conn = get_db_connection()
    players = conn.execute('SELECT * FROM players ORDER BY name ASC').fetchall()
    conn.close()
    # Chuyển đổi danh sách các đối tượng Row thành danh sách các dictionary
    return jsonify([dict(row) for row in players])

@app.route('/api/players', methods=['POST'])
def add_player():
    """API để thêm một người chơi mới."""
    # Lấy dữ liệu JSON từ request
    new_player = request.get_json()
    if not new_player or not new_player.get('name'):
        return jsonify({'error': 'Thiếu tên người chơi'}), 400

    name = new_player.get('name')
    # Gán giá trị mặc định nếu không được cung cấp
    player_type = new_player.get('type', 'Vãng lai')
    elo = new_player.get('elo_rating', 1500) # Thêm trình độ ban đầu nếu cần

    try:
        conn = get_db_connection()
        conn.execute('INSERT INTO players (name, type, elo_rating) VALUES (?, ?, ?)',
                     (name, player_type, elo))
        conn.commit()
        conn.close()
        return jsonify({'message': f'Đã thêm thành công người chơi {name}'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Lỗi khi thêm người chơi'}), 500


@app.route('/api/players/<int:player_id>', methods=['PUT'])
def update_player(player_id):
    """API để cập nhật thông tin người chơi."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Không có dữ liệu để cập nhật'}), 400

    # Xây dựng câu lệnh SQL một cách linh hoạt
    fields_to_update = []
    values = []
    # Các trường được phép cập nhật
    allowed_fields = ['name', 'type', 'is_active', 'elo_rating']

    for field in allowed_fields:
        if field in data:
            fields_to_update.append(f"{field} = ?")
            values.append(data[field])

    if not fields_to_update:
        return jsonify({'error': 'Không có trường hợp lệ nào để cập nhật'}), 400

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


@app.route('/api/players/<int:player_id>', methods=['DELETE'])
def delete_player(player_id):
    """API để xóa một người chơi."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM players WHERE id = ?', (player_id,))
    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Không tìm thấy người chơi'}), 404

    conn.close()
    return jsonify({'message': f'Đã xóa thành công người chơi ID {player_id}'})

# --- API cho Sân đấu (Courts) ---
@app.route('/api/courts', methods=['GET'])
def get_courts():
    """API để lấy danh sách tất cả các sân."""
    conn = get_db_connection()
    courts = conn.execute('SELECT * FROM courts ORDER BY name ASC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in courts])

@app.route('/api/courts', methods=['POST'])
def add_court():
    """API để thêm một sân mới."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Thiếu tên sân'}), 400

    name = data.get('name')

    try:
        conn = get_db_connection()
        conn.execute('INSERT INTO courts (name) VALUES (?)', (name,))
        conn.commit()
        # Lấy ID của sân vừa tạo
        new_court_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        conn.close()
        return jsonify({
            'message': f'Đã thêm thành công {name}',
            'court_id': new_court_id
        }), 201
    except sqlite3.IntegrityError:
        # Lỗi này xảy ra nếu tên sân đã tồn tại (do có UNIQUE constraint)
        return jsonify({'error': f'Tên sân "{name}" đã tồn tại'}), 409

@app.route('/api/courts/<int:court_id>', methods=['DELETE'])
def delete_court(court_id):
    """API để xóa một sân."""
    # Thêm logic kiểm tra xem sân có đang được sử dụng không trước khi xóa (nếu cần)
    # Ví dụ: SELECT * FROM matches WHERE court_id = ? AND status = 'ongoing'
    
    

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM courts WHERE id = ?', (court_id,))
    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Không tìm thấy sân'}), 404

    conn.close()
    return jsonify({'message': f'Đã xóa thành công sân ID {court_id}'})


# --- API cho Gợi ý cặp đấu (Suggestions) ---
@app.route('/api/suggestions', methods=['GET'])
def get_suggestions():
    """
    API để gợi ý các cặp đấu.
    Nhận các quy tắc từ query parameters, ví dụ:
    /api/suggestions?prioritize_rest=true&prioritize_low_games=false
    """
    # Lấy các quy tắc từ request, mặc định là False nếu không được cung cấp
    rules = {
        'prioritize_rest': request.args.get('prioritize_rest', 'false').lower() == 'true',
        'prioritize_low_games': request.args.get('prioritize_low_games', 'false').lower() == 'true',
        'avoid_rematch': request.args.get('avoid_rematch', 'false').lower() == 'true'
    }

    conn = get_db_connection()
    active_players = conn.execute('SELECT * FROM players WHERE is_active = 1').fetchall()
    empty_courts = conn.execute('SELECT * FROM courts').fetchall()
    conn.close()

    if len(active_players) < 4:
        return jsonify({'message': 'Không đủ người chơi để xếp cặp', 'suggestions': []})

    active_players_dict = [dict(p) for p in active_players]
    empty_courts_dict = [dict(c) for c in empty_courts]

    # Gọi hàm logic chính với các quy tắc đã nhận được
    suggestions = _suggest_matches(active_players_dict, empty_courts_dict, rules)

    return jsonify({'suggestions': suggestions})


# --- API cho Quản lý Trận đấu (Matches) ---

@app.route('/api/matches/start', methods=['POST'])
def start_match():
    """
    API để bắt đầu một trận đấu mới từ một gợi ý.
    Nhận vào: { court_id: 1, team_A: [player1, player2], team_B: [player3, player4] }
    """
    data = request.get_json()
    court_id = data.get('court_id')
    team_a = data.get('team_A')
    team_b = data.get('team_B')

    if not all([court_id, team_a, team_b]) or len(team_a) != 2 or len(team_b) != 2:
        return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Tạo một trận đấu mới trong bảng `matches`
        cursor.execute("INSERT INTO matches (court_id, status) VALUES (?, 'ongoing')", (court_id,))
        match_id = cursor.lastrowid

        # 2. Thêm 4 người chơi vào bảng `match_players`
        players_in_match = []
        for player in team_a:
            players_in_match.append((match_id, player['id'], 'A', player['elo_rating']))
        for player in team_b:
            players_in_match.append((match_id, player['id'], 'B', player['elo_rating']))
        
        cursor.executemany(
            "INSERT INTO match_players (match_id, player_id, team, elo_before) VALUES (?, ?, ?, ?)",
            players_in_match
        )

        # 3. (Tùy chọn) Cập nhật trạng thái của người chơi thành 'playing'
        # Điều này hữu ích nếu bạn muốn loại họ khỏi các gợi ý tiếp theo
        # player_ids = [p['id'] for p in team_a] + [p['id'] for p in team_b]
        # cursor.execute(f"UPDATE players SET status = 'playing' WHERE id IN ({','.join('?'*len(player_ids))})", player_ids)

        conn.commit()
        return jsonify({'message': 'Trận đấu đã bắt đầu!', 'match_id': match_id}), 201

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()


@app.route('/api/matches/<int:match_id>/finish', methods=['POST'])
def finish_match(match_id):
    """
    API để kết thúc một trận đấu và cập nhật ELO.
    Nhận vào: { winning_team: 'A' } hoặc { winning_team: 'B' }
    """
    data = request.get_json()
    winning_team = data.get('winning_team')

    if winning_team not in ['A', 'B']:
        return jsonify({'error': 'Đội thắng không hợp lệ'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Lấy thông tin các người chơi trong trận từ database
        players = conn.execute(
            'SELECT p.id, p.elo_rating, p.total_matches_played, p.total_wins, mp.team '
            'FROM players p JOIN match_players mp ON p.id = mp.player_id '
            'WHERE mp.match_id = ?',
            (match_id,)
        ).fetchall()

        if len(players) != 4:
            return jsonify({'error': 'Không tìm thấy đủ người chơi cho trận đấu này'}), 404

        team_a_players = [p for p in players if p['team'] == 'A']
        team_b_players = [p for p in players if p['team'] == 'B']

        # 2. Tính toán kết quả kỳ vọng
        result_for_a = 1 if winning_team == 'A' else 0
        elo_team_a = (team_a_players[0]['elo_rating'] + team_a_players[1]['elo_rating']) / 2
        elo_team_b = (team_b_players[0]['elo_rating'] + team_b_players[1]['elo_rating']) / 2
        expected_a = 1 / (1 + ELO_BASE**((elo_team_b - elo_team_a) / SCALING_FACTOR))

        # 3. Cập nhật ELO và các chỉ số cho từng người chơi
        for p in team_a_players:
            k_factor = _get_dynamic_k_factor(p)
            elo_change = k_factor * (result_for_a - expected_a)
            new_elo = p['elo_rating'] + elo_change
            new_wins = p['total_wins'] + 1 if winning_team == 'A' else p['total_wins']
            cursor.execute(
                'UPDATE players SET elo_rating = ?, total_matches_played = ?, total_wins = ?, last_played_date = CURRENT_TIMESTAMP WHERE id = ?',
                (new_elo, p['total_matches_played'] + 1, new_wins, p['id'])
            )
            cursor.execute('UPDATE match_players SET elo_after = ? WHERE match_id = ? AND player_id = ?', (new_elo, match_id, p['id']))

        for p in team_b_players:
            k_factor = _get_dynamic_k_factor(p)
            # Đội B thay đổi ngược lại với Đội A, nên ta dùng ( (1-result_for_a) - (1-expected_a) )
            # tương đương với -(result_for_a - expected_a)
            elo_change = k_factor * (result_for_a - expected_a)
            new_elo = p['elo_rating'] - elo_change
            new_wins = p['total_wins'] + 1 if winning_team == 'B' else p['total_wins']
            cursor.execute(
                'UPDATE players SET elo_rating = ?, total_matches_played = ?, total_wins = ?, last_played_date = CURRENT_TIMESTAMP WHERE id = ?',
                (new_elo, p['total_matches_played'] + 1, new_wins, p['id'])
            )
            cursor.execute('UPDATE match_players SET elo_after = ? WHERE match_id = ? AND player_id = ?', (new_elo, match_id, p['id']))

        # 4. Cập nhật trạng thái trận đấu trong bảng `matches`
        cursor.execute(
            "UPDATE matches SET status = 'finished', end_time = CURRENT_TIMESTAMP, winning_team = ? WHERE id = ?",
            (winning_team, match_id)
        )

        conn.commit()
        return jsonify({'message': 'Trận đấu đã kết thúc. ELO đã được cập nhật.'}), 200

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()

@app.route('/api/matches/ongoing', methods=['GET'])
def get_ongoing_matches():
    """Lấy danh sách các trận đang diễn ra và người chơi trong đó."""
    query = """
        SELECT 
            m.id as match_id, 
            m.court_id, 
            c.name as court_name,
            p.id as player_id, 
            p.name as player_name, 
            mp.team, 
            mp.elo_before
        FROM matches m
        JOIN courts c ON m.court_id = c.id
        JOIN match_players mp ON m.id = mp.match_id
        JOIN players p ON mp.player_id = p.id
        WHERE m.status = 'ongoing'
        ORDER BY m.id, mp.team;
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



@app.route('/api/matches/create', methods=['POST'])
def create_match():
    """
    API để tạo một trận đấu mới từ một danh sách 4 người chơi và một sân.
    Backend sẽ tự động chia cặp cân bằng nhất.
    """
    data = request.get_json()
    court_id = data.get('court_id')
    player_ids = data.get('player_ids')

    # --- Kiểm tra dữ liệu đầu vào ---
    if not all([court_id, player_ids]) or len(player_ids) != 4:
        return jsonify({'error': 'Dữ liệu không hợp lệ: Cần court_id và đúng 4 player_ids'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Lấy thông tin đầy đủ của 4 người chơi từ DB
        # Dùng '?' để tránh SQL Injection
        placeholders = ','.join('?' for _ in player_ids)
        query = f'SELECT * FROM players WHERE id IN ({placeholders})'
        players_from_db = cursor.execute(query, player_ids).fetchall()

        if len(players_from_db) != 4:
            return jsonify({'error': 'Một hoặc nhiều ID người chơi không tồn tại'}), 404
            
        # Chuyển đổi thành list các dictionary để xử lý
        group_of_4 = [dict(p) for p in players_from_db]

        # 2. Tìm cách chia cặp cân bằng nhất bằng hàm đã có
        (team_a, team_b), elo_diff = _find_best_pairing_for_group(group_of_4)

        # 3. Tạo một trận đấu mới trong bảng `matches`
        cursor.execute("INSERT INTO matches (court_id, status) VALUES (?, 'ongoing')", (court_id,))
        match_id = cursor.lastrowid

        # 4. Thêm 4 người chơi vào bảng `match_players` với đội đã được chia
        players_in_match = []
        for player in team_a:
            players_in_match.append((match_id, player['id'], 'A', player['elo_rating']))
        for player in team_b:
            players_in_match.append((match_id, player['id'], 'B', player['elo_rating']))
        
        cursor.executemany(
            "INSERT INTO match_players (match_id, player_id, team, elo_before) VALUES (?, ?, ?, ?)",
            players_in_match
        )

        conn.commit()
        return jsonify({
            'message': f'Trận đấu đã bắt đầu trên sân {court_id}!', 
            'match_id': match_id,
            'team_A': team_a,
            'team_B': team_b,
            'elo_difference': elo_diff
        }), 201

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': f'Lỗi database: {e}'}), 500
    finally:
        conn.close()








# --- Chạy ứng dụng ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
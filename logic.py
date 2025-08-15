# logic.py

import itertools
from datetime import datetime
import sqlite3

def load_settings():
    """Tải tất cả cấu hình từ DB và trả về một dictionary."""
    conn = None
    try:
        conn = sqlite3.connect('badminton.db')
        conn.row_factory = sqlite3.Row
        settings_rows = conn.execute('SELECT key, value FROM settings').fetchall()
        settings = {row['key']: row['value'] for row in settings_rows}
    except sqlite3.Error as e:
        print(f"Lỗi database khi tải settings: {e}")
        settings = {} # Trả về dict rỗng nếu lỗi
    finally:
        if conn:
            conn.close()

    # Giá trị mặc định phòng trường hợp DB lỗi hoặc thiếu key
    defaults = {
        'SCALING_FACTOR': 400, 'ELO_BASE': 10, 'FEMALE_ELO_BONUS': 50,
        'REST_PRIORITY_WEIGHT': 0.01, 'LOW_GAMES_PENALTY_WEIGHT': 0.1,
        'REMATCH_PENALTY_WEIGHT': 50, 'K_FACTOR_NEW': 48,
        'K_FACTOR_MID': 32, 'K_FACTOR_STABLE': 24
    }

    # Ép kiểu các giá trị về đúng định dạng số, dùng giá trị mặc định nếu lỗi
    numeric_keys = {
        'SCALING_FACTOR': float, 'ELO_BASE': float, 'FEMALE_ELO_BONUS': float,
        'REST_PRIORITY_WEIGHT': float, 'LOW_GAMES_PENALTY_WEIGHT': float,
        'REMATCH_PENALTY_WEIGHT': float, 'K_FACTOR_NEW': int,
        'K_FACTOR_MID': int, 'K_FACTOR_STABLE': int
    }

    processed_settings = {}
    for key, cast_func in numeric_keys.items():
        try:
            processed_settings[key] = cast_func(settings.get(key, defaults[key]))
        except (ValueError, TypeError):
            processed_settings[key] = defaults[key]
            print(f"Warning: Could not cast setting '{key}'. Reverting to default.")

    return processed_settings

def get_dynamic_k_factor(player, settings):
    """Lấy K-Factor dựa trên số trận đã chơi của người chơi."""
    matches_played = player.get('total_matches_played', 0)
    if matches_played < 20:
        return settings.get('K_FACTOR_NEW', 48)
    elif matches_played < 50:
        return settings.get('K_FACTOR_MID', 32)
    else:
        return settings.get('K_FACTOR_STABLE', 24)

def find_best_pairing_for_group(group_of_4, settings):
    """Với một nhóm 4 người, tìm ra cách chia đội cân bằng nhất."""
    p = group_of_4
    possible_pairings = [
        ((p[0], p[1]), (p[2], p[3])),
        ((p[0], p[2]), (p[1], p[3])),
        ((p[0], p[3]), (p[1], p[2]))
    ]
    best_pairing, min_elo_diff = None, float('inf')

    for team_a, team_b in possible_pairings:
        def get_virtual_elo(player):
            base_elo = player['elo_rating']
            if player.get('gender') == 'Nữ':
                return base_elo + settings.get('FEMALE_ELO_BONUS', 50)
            return base_elo

        elo_team_a = (get_virtual_elo(team_a[0]) + get_virtual_elo(team_a[1])) / 2
        elo_team_b = (get_virtual_elo(team_b[0]) + get_virtual_elo(team_b[1])) / 2
        elo_diff = abs(elo_team_a - elo_team_b)

        if elo_diff < min_elo_diff:
            min_elo_diff = elo_diff
            best_pairing = (list(team_a), list(team_b))
            
    return best_pairing, min_elo_diff

def suggest_matches(active_players, empty_courts, rules, conn):
    """Thuật toán chính để gợi ý các trận đấu."""
    settings = load_settings()
    if len(active_players) < 4: return []
    num_matches_to_suggest = min(len(empty_courts), len(active_players) // 4)
    if num_matches_to_suggest == 0: return []
    
    possible_groups = list(itertools.combinations(active_players, 4))
    scored_groups = []
    now = datetime.now()

    for group in possible_groups:
        pairing, elo_diff = find_best_pairing_for_group(group, settings)
        score = elo_diff
        
        if rules.get('prioritize_rest'):
            total_rest_time = 0
            for p in group:
                if p['last_played_date']:
                    last_played = datetime.fromisoformat(p['last_played_date'])
                    total_rest_time += (now - last_played).total_seconds()
                else:
                    total_rest_time += 999999
            if total_rest_time > 0:
                score -= (total_rest_time / 4) * settings.get('REST_PRIORITY_WEIGHT', 0.01)

        if rules.get('prioritize_low_games'):
            score += sum(p['total_matches_played'] for p in group) * settings.get('LOW_GAMES_PENALTY_WEIGHT', 0.1)
        
        if rules.get('avoid_rematch'):
            team_a, team_b = pairing
            def get_pair_history(p1_id, p2_id, db_cursor):
                player_ids = sorted([p1_id, p2_id])
                res = db_cursor.execute('SELECT times_played FROM pair_history WHERE player1_id = ? AND player2_id = ?', (player_ids[0], player_ids[1])).fetchone()
                return res['times_played'] if res else 0
            cursor = conn.cursor()
            rematch_penalty = get_pair_history(team_a[0]['id'], team_a[1]['id'], cursor) + \
                              get_pair_history(team_b[0]['id'], team_b[1]['id'], cursor)
            score += rematch_penalty * settings.get('REMATCH_PENALTY_WEIGHT', 50)

        scored_groups.append({'score': score, 'pairing': pairing})

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
                'court_id': court['id'], 'court_name': court['name'],
                'team_A': team_a, 'team_B': team_b,
                'balance_score': round(best_available_match['score'], 2)
            })
            used_player_ids.update({p['id'] for p in team_a} | {p['id'] for p in team_b})
        
        if len(suggestions) >= num_matches_to_suggest: break
            
    return suggestions

def update_pair_history(team_players, cursor):
    """Cập nhật bảng pair_history cho một đội gồm 2 người chơi."""
    if len(team_players) != 2: return
    player_ids = sorted([p['id'] for p in team_players])
    p1_id, p2_id = player_ids[0], player_ids[1]
    
    cursor.execute("""
        INSERT INTO pair_history (player1_id, player2_id, last_played_together)
        VALUES (?, ?, datetime('now', 'localtime'))
        ON CONFLICT(player1_id, player2_id) DO UPDATE SET
            times_played = times_played + 1,
            last_played_together = datetime('now', 'localtime')
    """, (p1_id, p2_id))
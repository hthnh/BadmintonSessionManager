# logic.py

import itertools
from datetime import datetime

# Di chuyển các hằng số tính toán vào đây
SCALING_FACTOR = 400
ELO_BASE = 10
FEMALE_ELO_BONUS = 50 
REST_PRIORITY_WEIGHT = 0.01
LOW_GAMES_PENALTY_WEIGHT = 0.1
REMATCH_PENALTY_WEIGHT = 50

#==================================
# CÁC HÀM LOGIC
#==================================

def get_dynamic_k_factor(player):
    """Lấy K-Factor dựa trên số trận đã chơi của người chơi."""
    matches_played = player.get('total_matches_played', 0)
    if matches_played < 20: return 48
    elif matches_played < 50: return 32
    else: return 24

def find_best_pairing_for_group(group_of_4):
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
            if player.get('gender') == 'Nữ': return base_elo + FEMALE_ELO_BONUS
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
    if len(active_players) < 4: return []
    num_matches_to_suggest = min(len(empty_courts), len(active_players) // 4)
    if num_matches_to_suggest == 0: return []
    
    possible_groups = list(itertools.combinations(active_players, 4))
    scored_groups = []

    # Lấy thời gian hiện tại một lần để nhất quán
    now = datetime.now()

    for group in possible_groups:
        pairing, elo_diff = find_best_pairing_for_group(group)
        score = elo_diff
        
        # Các quy tắc tính điểm
        if rules.get('prioritize_rest'):
            total_rest_time = 0
            for p in group:
                if p['last_played_date']:
                    # Chuyển đổi chuỗi ISO thành đối tượng datetime
                    # Giả định last_played_date từ DB đã là giờ địa phương
                    last_played = datetime.fromisoformat(p['last_played_date'])
                    total_rest_time += (now - last_played).total_seconds()
                else:
                    # Nếu chưa chơi trận nào, cho điểm ưu tiên cao
                    total_rest_time += 999999 
            
            if total_rest_time > 0:
                score -= (total_rest_time / 4) * REST_PRIORITY_WEIGHT

        if rules.get('prioritize_low_games'):
            score += sum(p['total_matches_played'] for p in group) * LOW_GAMES_PENALTY_WEIGHT
        if rules.get('avoid_rematch'):
            team_a, team_b = pairing
            def get_pair_history(p1_id, p2_id, db_cursor):
                player_ids = sorted([p1_id, p2_id])
                res = db_cursor.execute('SELECT times_played FROM pair_history WHERE player1_id = ? AND player2_id = ?', (player_ids[0], player_ids[1])).fetchone()
                return res['times_played'] if res else 0
            cursor = conn.cursor()
            score += (get_pair_history(team_a[0]['id'], team_a[1]['id'], cursor) + get_pair_history(team_b[0]['id'], team_b[1]['id'], cursor)) * REMATCH_PENALTY_WEIGHT
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
    player_ids = sorted([p['id'] for p in team_players])
    p1_id, p2_id = player_ids[0], player_ids[1]
    cursor.execute("""
        INSERT INTO pair_history (player1_id, player2_id, last_played_together)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(player1_id, player2_id) DO UPDATE SET
            times_played = times_played + 1,
            last_played_together = CURRENT_TIMESTAMP
    """, (p1_id, p2_id))
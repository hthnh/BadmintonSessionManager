# api/scoreboards.py
from flask import Blueprint, request, jsonify
import sqlite3
from extensions import broadcast_to_web, broadcast_to_esp
from database import get_db_connection

scoreboards_api = Blueprint('scoreboards_api', __name__)



# [UPDATED] Return the new 'is_swapped' field

# This function remains unchanged
@scoreboards_api.route('/scoreboards/<device_id>/score', methods=['POST'])
def update_score_from_device(device_id):
    data = request.get_json()
    score_a = data.get('score_A', 0)
    score_b = data.get('score_B', 0)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE scoreboards SET score_A = ?, score_B = ?, last_seen = datetime('now', 'localtime'), updated_by = 'device' WHERE device_id = ?",
        (score_a, score_b, device_id)
    )
    if cursor.rowcount == 0:
        cursor.execute(
            "INSERT INTO scoreboards (device_id, score_A, score_B, last_seen) VALUES (?, ?, ?, datetime('now', 'localtime'))",
            (device_id, score_a, score_b)
        )
    conn.commit()
    scoreboard = cursor.execute("SELECT court_id FROM scoreboards WHERE device_id = ?", (device_id,)).fetchone()

    # [UPDATED] Notify web clients about the score change.
    if scoreboard and scoreboard['court_id'] is not None:
        payload = {
            'type': 'score_updated',
            'payload': {
                'court_id': scoreboard['court_id'],
                'score_A': score_a,
                'score_B': score_b
            }
        }
        broadcast_to_web(json.dumps(payload))
        
    return jsonify({'message': 'Score updated via HTTP'}), 200



# [UPDATED] More robust assignment logic
@scoreboards_api.route('/scoreboards/assign', methods=['POST'])
def assign_scoreboard():
    data = request.get_json()
    device_id = data.get('device_id')
    court_id = data.get('court_id')

    if not device_id or not court_id:
        return jsonify({'error': 'Missing device_id or court_id'}), 400

    conn = get_db_connection()
    # 1. Unassign any device that might currently be on the target court
    conn.execute("UPDATE scoreboards SET court_id = NULL WHERE court_id = ?", (court_id,))
    # 2. Assign the new device to the court
    conn.execute("UPDATE scoreboards SET court_id = ? WHERE device_id = ?", (court_id, device_id))
    conn.commit()
    
    return jsonify({'message': f'Successfully assigned {device_id} to court {court_id}'})

# [NEW] Endpoint to unassign a scoreboard
@scoreboards_api.route('/scoreboards/unassign', methods=['POST'])
def unassign_scoreboard():
    data = request.get_json()
    court_id = data.get('court_id')
    if not court_id:
        return jsonify({'error': 'Missing court_id'}), 400
    
    conn = get_db_connection()
    conn.execute("UPDATE scoreboards SET court_id = NULL WHERE court_id = ?", (court_id,))
    conn.commit()
    return jsonify({'message': f'Successfully unassigned scoreboard from court {court_id}'})





@scoreboards_api.route('/scoreboards', methods=['GET'])
def get_scoreboards():
    conn = get_db_connection()
    query = """
        SELECT s.id, s.device_id, s.court_id, s.score_A, s.score_B, s.last_seen, s.is_swapped, c.name as court_name
        FROM scoreboards s
        LEFT JOIN courts c ON s.court_id = c.id
        ORDER BY s.device_id ASC
    """
    boards = conn.execute(query).fetchall()
    return jsonify([dict(row) for row in boards])




@scoreboards_api.route('/scoreboards/toggle-swap', methods=['POST'])
def toggle_swap():
    data = request.get_json()
    court_id = data.get('court_id')
    if not court_id:
        return jsonify({'error': 'Missing court_id'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE scoreboards SET is_swapped = 1 - is_swapped WHERE court_id = ?",
        (court_id,)
    )
    conn.commit()
    
    if cursor.rowcount > 0:
        updated_board = conn.execute("SELECT * FROM scoreboards WHERE court_id = ?", (court_id,)).fetchone()
        
        # [UPDATED] Broadcast state change to web clients via standard WebSocket
        broadcast_to_web(json.dumps({
            'type': 'board_state_updated',
            'payload': dict(updated_board)
        }))

        # [UPDATED] Send updated state to the physical scoreboard
        if updated_board['device_id']:
            broadcast_to_esp(json.dumps({
                'score_A': updated_board['score_A'],
                'score_B': updated_board['score_B'],
                'is_swapped': updated_board['is_swapped']
            }), device_id=updated_board['device_id'])

        return jsonify({'message': 'Swap state toggled successfully.'})
    else:
        return jsonify({'error': 'No scoreboard found for this court'}), 404

@scoreboards_api.route('/scoreboards/control', methods=['POST'])
def control_scoreboard():
    data = request.get_json()
    if not data: return jsonify({"error": "Invalid request"}), 400
    court_id = data.get('court_id')
    action = data.get('action')
    if court_id is None or action is None: return jsonify({"error": "Missing court_id or action"}), 400

    conn = get_db_connection()
    scoreboard = conn.execute("SELECT * FROM scoreboards WHERE court_id = ?", (court_id,)).fetchone()
    if not scoreboard:
        return jsonify({"error": "No scoreboard assigned to this court"}), 404

    score_a, score_b = scoreboard['score_A'], scoreboard['score_B']
    if action == 'inc_a': score_a += 1
    elif action == 'dec_a' and score_a > 0: score_a -= 1
    elif action == 'inc_b': score_b += 1
    elif action == 'dec_b' and score_b > 0: score_b -= 1
    elif action == 'reset': score_a, score_b = 0, 0
    else:
        return jsonify({"error": "Invalid action"}), 400

    conn.execute("UPDATE scoreboards SET score_A = ?, score_B = ?, updated_by = 'web' WHERE id = ?", (score_a, score_b, scoreboard['id']))
    conn.commit()

    # [UPDATED] Broadcast the score update to all connected web clients
    payload = {
        'type': 'score_updated', # Add a type for the frontend to identify the message
        'payload': {
            'court_id': court_id,
            'score_A': score_a,
            'score_B': score_b
        }
    }
    broadcast_to_web(json.dumps(payload))
    
    # [UPDATED] Send the score update to the specific physical scoreboard
    if scoreboard['device_id']:
        esp_payload = {
            'score_A': score_a,
            'score_B': score_b,
            'is_swapped': scoreboard['is_swapped']
        }
        broadcast_to_esp(json.dumps(esp_payload), device_id=scoreboard['device_id'])

    return jsonify({'message': 'Action successful'}), 200
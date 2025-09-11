# api/scoreboards.py
from flask import Blueprint, request, jsonify
import sqlite3
from extensions import socketio 

scoreboards_api = Blueprint('scoreboards_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db', timeout=15)
    conn.row_factory = sqlite3.Row
    return conn

# [UPDATED] Return the new 'is_swapped' field
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
    conn.close()
    return jsonify([dict(row) for row in boards])

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
    conn.close()
    if scoreboard and scoreboard['court_id'] is not None:
        socketio.emit('score_updated', {
            'court_id': scoreboard['court_id'], 'score_A': score_a, 'score_B': score_b
        })
    return jsonify({'message': 'Score updated'}), 200

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
    conn.close()
    
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
    conn.close()
    return jsonify({'message': f'Successfully unassigned scoreboard from court {court_id}'})

# [NEW] Endpoint to toggle the swapped state
@scoreboards_api.route('/scoreboards/toggle-swap', methods=['POST'])
def toggle_swap():
    data = request.get_json()
    court_id = data.get('court_id')
    if not court_id:
        return jsonify({'error': 'Missing court_id'}), 400

    conn = get_db_connection()
    # Use a subquery to toggle the boolean value (0 to 1, 1 to 0)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE scoreboards SET is_swapped = 1 - is_swapped WHERE court_id = ?",
        (court_id,)
    )
    conn.commit()
    
    if cursor.rowcount > 0:
        # Get the new state and emit an event so the UI can update instantly
        updated_board = conn.execute("SELECT id, device_id, is_swapped FROM scoreboards WHERE court_id = ?", (court_id,)).fetchone()
        socketio.emit('board_state_updated', dict(updated_board))
        conn.close()
        return jsonify({'message': 'Swap state toggled successfully.'})
    else:
        conn.close()
        return jsonify({'error': 'No scoreboard found for this court'}), 404

# This function remains largely unchanged
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
        conn.close()
        return jsonify({"error": "No scoreboard assigned to this court"}), 404

    score_a, score_b = scoreboard['score_A'], scoreboard['score_B']
    if action == 'inc_a': score_a += 1
    elif action == 'dec_a' and score_a > 0: score_a -= 1
    elif action == 'inc_b': score_b += 1
    elif action == 'dec_b' and score_b > 0: score_b -= 1
    elif action == 'reset': score_a, score_b = 0, 0
    else:
        conn.close()
        return jsonify({"error": "Invalid action"}), 400

    conn.execute("UPDATE scoreboards SET score_A = ?, score_B = ?, updated_by = 'web' WHERE id = ?", (score_a, score_b, scoreboard['id']))
    conn.commit()
    conn.close()

    socketio.emit('score_updated', {
        'court_id': court_id,
        'score_A': score_a,
        'score_B': score_b
    })
    
    return jsonify({'message': 'Action successful'}), 200
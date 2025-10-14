# Filename: api/scoreboards.py
"""
API endpoints for managing scoreboards (physical devices).
- Refactored to use the central database connection.
- Integrated with SocketIO to emit real-time state changes to the web client.
"""

from flask import Blueprint, jsonify, request
import sqlite3

# --- IMPORTS MỚI ---
from database import get_db_connection
from extensions import socketio # Quan trọng: import socketio để phát sự kiện

scoreboards_api = Blueprint('scoreboards_api', __name__)

@scoreboards_api.route('/scoreboards', methods=['GET'])
def get_all_scoreboards():
    """Fetches all registered scoreboard devices."""
    try:
        conn = get_db_connection()
        cursor = conn.execute("SELECT * FROM scoreboards")
        scoreboards = [dict(row) for row in cursor.fetchall()]
        return jsonify(scoreboards)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500

@scoreboards_api.route('/scoreboards/assign', methods=['POST'])
def assign_scoreboard():
    """Assigns a scoreboard device to a court."""
    data = request.get_json()
    device_id = data.get('device_id')
    court_id = data.get('court_id')

    if not device_id or not court_id:
        return jsonify({'error': 'Device ID and Court ID are required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Unassign any existing board from the target court first
        cursor.execute("UPDATE scoreboards SET court_id = NULL WHERE court_id = ?", (court_id,))
        
        # Assign the new board
        cursor.execute("UPDATE scoreboards SET court_id = ? WHERE device_id = ?", (court_id, device_id))
        
        conn.commit()
        
        # --- TÍCH HỢP SOCKET.IO ---
        socketio.emit('scoreboard_assignment_changed', {'court_id': court_id, 'device_id': device_id})
        print(f"[API] Emitted 'scoreboard_assignment_changed' for court {court_id}.")

        return jsonify({'message': f'Scoreboard {device_id} assigned to court {court_id}'}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500

@scoreboards_api.route('/scoreboards/unassign', methods=['POST'])
def unassign_scoreboard():
    """Unassigns any scoreboard from a specific court."""
    data = request.get_json()
    court_id = data.get('court_id')

    if not court_id:
        return jsonify({'error': 'Court ID is required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE scoreboards SET court_id = NULL WHERE court_id = ?", (court_id,))
        conn.commit()

        # --- TÍCH HỢP SOCKET.IO ---
        socketio.emit('scoreboard_assignment_changed', {'court_id': court_id, 'device_id': None})
        print(f"[API] Emitted 'scoreboard_assignment_changed' for court {court_id} (unassigned).")

        return jsonify({'message': f'Scoreboard unassigned from court {court_id}'}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500

@scoreboards_api.route('/scoreboards/toggle-swap', methods=['POST'])
def toggle_swap():
    """Toggles the is_swapped state for a scoreboard assigned to a court."""
    data = request.get_json()
    court_id = data.get('court_id')

    if not court_id:
        return jsonify({'error': 'Court ID is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Toggle the boolean value
        cursor.execute("UPDATE scoreboards SET is_swapped = NOT is_swapped WHERE court_id = ?", (court_id,))
        conn.commit()

        # Get the new state to broadcast
        new_state = cursor.execute("SELECT is_swapped FROM scoreboards WHERE court_id = ?", (court_id,)).fetchone()
        if new_state:
            # --- TÍCH HỢP SOCKET.IO ---
            payload = {'court_id': court_id, 'is_swapped': new_state['is_swapped']}
            socketio.emit('board_state_updated', payload)
            print(f"[API] Emitted 'board_state_updated': {payload}")

        return jsonify({'message': 'Swap state toggled'}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500

@scoreboards_api.route('/scoreboards/control', methods=['POST'])
def control_scoreboard():
    """
    Handles score controls from the web UI (inc, dec, reset).
    This function updates the DB and emits the new state.
    """
    data = request.get_json()
    court_id = data.get('court_id')
    action = data.get('action')

    if not court_id or not action:
        return jsonify({'error': 'Court ID and action are required'}), 400

    actions = {
        'inc_a': "score_A = score_A + 1",
        'dec_a': "score_A = MAX(0, score_A - 1)",
        'inc_b': "score_B = score_B + 1",
        'dec_b': "score_B = MAX(0, score_B - 1)",
        'reset': "score_A = 0, score_B = 0"
    }

    if action not in actions:
        return jsonify({'error': 'Invalid action'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update scores in DB
        query = f"UPDATE scoreboards SET {actions[action]}, updated_by = 'web' WHERE court_id = ?"
        cursor.execute(query, (court_id,))
        conn.commit()

        # Get the new scores to broadcast
        new_scores = cursor.execute("SELECT score_A, score_B FROM scoreboards WHERE court_id = ?", (court_id,)).fetchone()
        
        if new_scores:
            # --- TÍCH HỢP SOCKET.IO ---
            # This is the same event the Redis listener uses.
            # This ensures the UI updates consistently whether the score
            # is changed by a device or by the web UI.
            payload = {
                'court_id': court_id,
                'score_A': new_scores['score_A'],
                'score_B': new_scores['score_B']
            }
            socketio.emit('score_updated', payload)
            print(f"[API] Emitted 'score_updated': {payload}")

        # LƯU Ý: Logic để gửi lệnh ngược lại cho ESP qua Redis
        # sẽ cần được thêm vào đây nếu muốn điều khiển 2 chiều.
        
        return jsonify({'message': f'Action {action} performed'}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500





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
    if scoreboard and scoreboard['court_id'] is not None:
        socketio.emit('score_updated', {
            'court_id': scoreboard['court_id'], 'score_A': score_a, 'score_B': score_b
        })
    return jsonify({'message': 'Score updated'}), 200




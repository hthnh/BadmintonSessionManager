# Filename: api/matches.py
"""
API endpoints for managing matches.
- Refactored to use the central database connection.
- ELO calculation has been REMOVED.
- Integrated with SocketIO to emit real-time events to the web client.
"""

from flask import Blueprint, jsonify, request
import sqlite3
import json

# --- IMPORTS MỚI ---
from database import get_db_connection
from extensions import socketio # Quan trọng: import socketio để phát sự kiện
from logic import update_pair_history

matches_api = Blueprint('matches_api', __name__)

# --- CÁC HÀM HELPER (Giữ nguyên) ---
def _get_player_details(player_ids):
    """Helper function to fetch player details for a list of IDs."""
    if not player_ids:
        return {}
    conn = get_db_connection()
    placeholders = ','.join('?' for _ in player_ids)
    query = f"SELECT id, name FROM players WHERE id IN ({placeholders})"
    cursor = conn.execute(query, player_ids)
    return {row['id']: dict(row) for row in cursor.fetchall()}

def _format_match(match_row):
    """Helper function to format a match dictionary from a DB row."""
    match = dict(match_row)
    player_ids = []
    
    for key in ['player1_A_id', 'player2_A_id', 'player1_B_id', 'player2_B_id']:
        if match.get(key):
            player_ids.append(match[key])
            
    player_details = _get_player_details(player_ids)
    
    match['team_A'] = [
        player_details.get(match['player1_A_id']),
        player_details.get(match['player2_A_id'])
    ]
    match['team_B'] = [
        player_details.get(match['player1_B_id']),
        player_details.get(match['player2_B_id'])
    ]
    match['team_A'] = [p for p in match['team_A'] if p]
    match['team_B'] = [p for p in match['team_B'] if p]
    
    return match

# --- CÁC ENDPOINT GET (Giữ nguyên) ---
@matches_api.route('/matches/ongoing', methods=['GET'])
def get_ongoing_matches():
    """Get all matches with status 'ongoing'."""
    try:
        conn = get_db_connection()
        cursor = conn.execute("""
            SELECT m.*, c.name as court_name
            FROM matches m
            JOIN courts c ON m.court_id = c.id
            WHERE m.status = 'ongoing'
        """)
        matches = [_format_match(row) for row in cursor.fetchall()]
        return jsonify(matches)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500

@matches_api.route('/matches/queued', methods=['GET'])
def get_queued_matches():
    """Get all matches with status 'queued'."""
    try:
        conn = get_db_connection()
        cursor = conn.execute("SELECT * FROM matches WHERE status = 'queued' ORDER BY created_at")
        matches = [_format_match(row) for row in cursor.fetchall()]
        return jsonify(matches)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500

@matches_api.route('/matches/history', methods=['GET'])
def get_match_history():
    """Get all matches with status 'finished'."""
    try:
        conn = get_db_connection()
        cursor = conn.execute("""
            SELECT m.*, c.name as court_name
            FROM matches m
            LEFT JOIN courts c ON m.court_id = c.id
            WHERE m.status = 'finished'
            ORDER BY m.end_time DESC
        """)
        matches = [_format_match(row) for row in cursor.fetchall()]
        return jsonify(matches)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500

# --- CÁC ENDPOINT POST (Đã sửa đổi) ---
    
@matches_api.route('/matches/<int:match_id>/begin', methods=['POST'])
def begin_match(match_id):
    """Assign a court to a queued match and set its status to 'ongoing'."""
    data = request.get_json()
    court_id = data.get('court_id')

    if not court_id:
        return jsonify({'error': 'Court ID is required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        is_busy = cursor.execute("SELECT id FROM matches WHERE court_id = ? AND status = 'ongoing'", (court_id,)).fetchone()
        if is_busy:
            return jsonify({'error': 'Court is already in use'}), 409
            
        cursor.execute(
            """
            UPDATE matches 
            SET status = 'ongoing', court_id = ?, start_time = datetime('now', 'localtime')
            WHERE id = ? AND status = 'queued'
            """, (court_id, match_id)
        )
        
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({'error': 'Match not found or not in queued status'}), 404

        conn.commit()

        # --- TÍCH HỢP SOCKET.IO ---
        # Sau khi bắt đầu trận, phát sự kiện để frontend tự cập nhật
        socketio.emit('match_state_changed', {'message': 'A match has started!'})
        print(f"[API] Emitted 'match_state_changed' after match {match_id} began.")
        
        return jsonify({'message': 'Match started successfully'}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500

@matches_api.route('/matches/<int:match_id>/finish', methods=['POST'])
def finish_match(match_id):
    """
    Finish an ongoing match, update scores. (ELO CALCULATION IS REMOVED).
    """
    data = request.get_json()
    score_A = data.get('score_A')
    score_B = data.get('score_B')

    if score_A is None or score_B is None or score_A == score_B:
        return jsonify({'error': 'Invalid scores provided. Scores must be different.'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        match_row = cursor.execute("SELECT * FROM matches WHERE id = ? AND status = 'ongoing'", (match_id,)).fetchone()
        if not match_row:
            return jsonify({'error': 'Ongoing match not found'}), 404
        
        match = _format_match(match_row)
        winning_team = 'A' if score_A > score_B else 'B'
        
        # --- LOGIC ELO ĐÃ BỊ XÓA BỎ HOÀN TOÀN ---

        # Update match status and scores
        cursor.execute(
            """
            UPDATE matches
            SET status = 'finished', score_A = ?, score_B = ?, winning_team = ?, end_time = datetime('now', 'localtime')
            WHERE id = ?
            """, (score_A, score_B, winning_team, match_id)
        )
        
        # Update player stats and session info
        team_a_players = match['team_A']
        team_b_players = match['team_B']
        all_player_ids = [p['id'] for p in team_a_players] + [p['id'] for p in team_b_players]
        for pid in all_player_ids:
            cursor.execute("UPDATE player_stats SET total_matches = total_matches + 1 WHERE player_id = ?", (pid,))
            cursor.execute("UPDATE players SET session_matches_played = session_matches_played + 1, session_last_played = datetime('now', 'localtime') WHERE id = ?", (pid,))

        # Update pair history
        update_pair_history(team_a_players, cursor)
        update_pair_history(team_b_players, cursor)
        
        conn.commit()
        
        # --- TÍCH HỢP SOCKET.IO ---
        # Sau khi kết thúc trận, phát sự kiện để frontend tự cập nhật
        socketio.emit('match_state_changed', {'message': 'A match has finished!'})
        print(f"[API] Emitted 'match_state_changed' after match {match_id} finished.")

        return jsonify({'message': 'Match finished successfully'}), 200
        
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
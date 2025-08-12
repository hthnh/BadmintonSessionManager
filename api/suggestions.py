# api/suggestions.py
from flask import Blueprint, request, jsonify
import sqlite3
import logic # Import file logic chung của chúng ta

suggestions_api = Blueprint('suggestions_api', __name__)

def get_db_connection():
    conn = sqlite3.connect('badminton.db')
    conn.row_factory = sqlite3.Row
    return conn

@suggestions_api.route('/suggestions', methods=['GET'])
def get_suggestions():
    rules = {
        'prioritize_rest': request.args.get('prioritize_rest', 'false').lower() == 'true',
        'prioritize_low_games': request.args.get('prioritize_low_games', 'false').lower() == 'true',
        'avoid_rematch': request.args.get('avoid_rematch', 'false').lower() == 'true'
    }
    conn = get_db_connection()
    active_players = conn.execute('SELECT * FROM players WHERE is_active = 1').fetchall()
    empty_courts = conn.execute('SELECT * FROM courts WHERE id NOT IN (SELECT court_id FROM matches WHERE status = "ongoing")').fetchall()
    
    if len(active_players) < 4:
        conn.close()
        return jsonify({'message': 'Không đủ người chơi để xếp cặp', 'suggestions': []})

    active_players_dict = [dict(p) for p in active_players]
    empty_courts_dict = [dict(c) for c in empty_courts]
    
    suggestions = logic.suggest_matches(active_players_dict, empty_courts_dict, rules, conn)
    conn.close()
    return jsonify({'suggestions': suggestions})
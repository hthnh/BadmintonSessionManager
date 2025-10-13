# api/suggestions.py
from flask import Blueprint, request, jsonify
import sqlite3
import os
from openai import OpenAI
from dotenv import load_dotenv
from database import get_db_connection

# Tải các biến môi trường từ file .env
load_dotenv()

suggestions_api = Blueprint('suggestions_api', __name__)

# Khởi tạo OpenAI client
# Nó sẽ tự động đọc key từ biến môi trường OPENAI_API_KEY
try:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
except Exception as e:
    client = None
    print(f"LỖI: Không thể khởi tạo OpenAI client. Hãy chắc chắn bạn đã đặt OPENAI_API_KEY. Lỗi: {e}")



def create_prompt(players, courts_count, rules):
    """Tạo ra một prompt chi tiết cho mô hình AI."""
    
    system_prompt = """
    Bạn là một chuyên gia sắp xếp các trận đấu cầu lông cho một câu lạc bộ nhỏ. 
    Nhiệm vụ của bạn là đề xuất các cặp đấu đôi (2 vs 2) cân bằng và thú vị nhất dựa trên dữ liệu được cung cấp.
    
    QUY TẮC BẮT BUỘC:
    1. Chỉ sử dụng những người chơi trong danh sách "available_players".
    2. Trả về kết quả dưới dạng một cấu trúc JSON hoàn hảo, không có bất kỳ ký tự nào bên ngoài.
    3. Cấu trúc JSON phải là một object chứa key duy nhất là "suggestions", giá trị là một danh sách (list) các trận đấu.
    4. Mỗi trận đấu trong danh sách là một object chứa các key: "court_name", "team_A", "team_B", và "reasoning".
    5. "team_A" và "team_B" phải là một danh sách (list) chứa chính xác tên của 2 người chơi.
    6. "reasoning" phải là một chuỗi giải thích ngắn gọn, thuyết phục lý do tại sao cặp đấu này lại cân bằng và hợp lý.
    """

    player_info_list = []
    for p in players:
        player_info_list.append(
            f"- {p['name']} (Level: {p['skill_level']}, Số trận đã chơi hôm nay: {p['session_matches_played']}, Đã nghỉ: {p.get('rest_time_minutes', 'N/A')} phút)"
        )
    
    player_details = "\n".join(player_info_list)

    user_prompt = f"""
    Dữ liệu đầu vào:
    - Số sân trống: {courts_count}
    - Danh sách người chơi có thể thi đấu:
    {player_details}
    - Quy tắc bổ sung từ người dùng: {rules}

    Dựa vào các thông tin trên, hãy đề xuất các cặp đấu tốt nhất.
    """
    
    return system_prompt, user_prompt


@suggestions_api.route('/suggestions', methods=['POST'])
def get_suggestions():
    if not client:
        return jsonify({'error': 'Dịch vụ gợi ý AI chưa được cấu hình đúng.'}), 503

    data = request.get_json()
    player_ids = data.get('player_ids')
    
    if not player_ids or len(player_ids) < 4:
        return jsonify({'suggestions': []}) # Không đủ người để xếp trận

    # --- Lấy dữ liệu từ DB (giống như code cũ của bạn) ---
    conn = get_db_connection()
    placeholders = ','.join('?' for _ in player_ids)
    
    # Lấy thông tin người chơi được chọn
    query_players = f"SELECT id, name, skill_level, session_matches_played, session_last_played FROM players WHERE id IN ({placeholders})"
    selected_players_rows = conn.execute(query_players, player_ids).fetchall()
    
    # Lấy thông tin sân trống
    empty_courts = conn.execute('SELECT * FROM courts WHERE id NOT IN (SELECT court_id FROM matches WHERE status = "ongoing")').fetchall()

    if not empty_courts:
         return jsonify({'suggestions': []}) # Không có sân trống

    # Xử lý dữ liệu người chơi để thêm thông tin "thời gian nghỉ"
    from datetime import datetime
    players_for_prompt = []
    for row in selected_players_rows:
        player = dict(row)
        if player['session_last_played']:
            last_played = datetime.fromisoformat(player['session_last_played'])
            rest_time = (datetime.now() - last_played).total_seconds() / 60
            player['rest_time_minutes'] = int(rest_time)
        else:
            player['rest_time_minutes'] = 999 # Coi như đã nghỉ rất lâu
        players_for_prompt.append(player)

    # --- Gọi API của LLM ---
    system_prompt, user_prompt = create_prompt(
        players_for_prompt, 
        len(empty_courts), 
        data.get('rules', 'Ưu tiên cân bằng trình độ và cho người nghỉ lâu được chơi.')
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo", # Hoặc "gpt-4" để có kết quả tốt hơn
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        response_content = completion.choices[0].message.content
        suggestions_data = json.loads(response_content)
        
        # Gán tên sân cho các gợi ý (vì LLM không biết tên sân cụ thể)
        for i, suggestion in enumerate(suggestions_data.get("suggestions", [])):
            if i < len(empty_courts):
                suggestion["court_name"] = empty_courts[i]["name"]

        return jsonify(suggestions_data)

    except Exception as e:
        print(f"Lỗi khi gọi API OpenAI: {e}")
        return jsonify({'error': f'Đã có lỗi xảy ra khi kết nối với dịch vụ AI: {str(e)}'}), 500
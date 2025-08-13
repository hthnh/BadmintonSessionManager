# server.py (Phiên bản cuối cùng, rất gọn gàng)
from flask import Flask, render_template
import os

# Import các Blueprint từ thư mục 'api'
from api.players import players_api
from api.courts import courts_api
from api.suggestions import suggestions_api
from api.matches import matches_api

# --- Cấu hình và Khởi tạo Ứng dụng ---
app = Flask(__name__,
            static_folder='static',
            template_folder='templates')

# --- Đăng ký các Blueprint ---
# Mỗi Blueprint sẽ quản lý một nhóm API với một tiền tố (prefix) riêng
app.register_blueprint(players_api, url_prefix='/api')
app.register_blueprint(courts_api, url_prefix='/api')
app.register_blueprint(suggestions_api, url_prefix='/api')
app.register_blueprint(matches_api, url_prefix='/api')


# --- Route chính phục vụ Frontend ---
# Route này vẫn giữ ở file chính vì nó là giao diện người dùng, không phải API
@app.route('/')
def home():
    """Phục vụ trang chủ index.html."""
    return render_template('index.html')

@app.route('/settings')
def settings_page():
    """Phục vụ trang quản lý settings.html."""
    return render_template('settings.html')

@app.route('/manage-players')
def players_page():
    """Phục vụ trang quản lý players.html."""
    return render_template('players.html')

@app.route('/manage-courts')
def courts_page():
    """Phục vụ trang quản lý admin.html."""
    return render_template('courts.html')

@app.route('/history')
def history_page():
    """Phục vụ trang quản lý admin.html."""
    return render_template('history.html')
@app.route('/create')
def create_page():
    """Phục vụ trang tạo trận đấu thủ công."""
    return render_template('create.html')






# --- Chạy ứng dụng ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
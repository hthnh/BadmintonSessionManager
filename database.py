# database.py
import sqlite3
from flask import g # g là một đối tượng đặc biệt của Flask

DATABASE_URI = 'badminton.db'

def get_db_connection():
    """
    Mở một kết nối DB mới nếu chưa có cho request hiện tại.
    """
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE_URI, timeout=15)
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    """
    Đóng kết nối DB nếu nó đã được tạo.
    """
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_app(app):
    """
    Hàm này sẽ được gọi từ server.py để đăng ký lệnh và teardown.
    """
    app.teardown_appcontext(close_db)
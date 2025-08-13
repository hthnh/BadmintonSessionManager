// static/app.js

// Nhập các module tương ứng với từng trang
import initPlayerManager from './modules/player-manager.js';

/**
 * Hàm cập nhật đồng hồ ở sidebar
 */
function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        clockElement.textContent = now.toLocaleDateString('vi-VN', options);
    }
}

/**
 * Hàm khởi tạo chính của toàn bộ ứng dụng
 */
function initializeApp() {
    console.log("Ứng dụng đang khởi tạo...");

    // 1. Khởi tạo các thành phần chung
    updateClock();
    setInterval(updateClock, 1000);

    // 2. Nhận diện trang hiện tại và tải module tương ứng
    // Chúng ta có thể dựa vào một ID duy nhất trên thẻ <body> hoặc URL
    // Ở đây, ta sẽ dùng URL pathname để đơn giản.
    const path = window.location.pathname;

    if (path.includes('/manage-players')) {
        console.log("Đang ở trang Quản lý Người chơi -> Khởi tạo PlayerManager");
        initPlayerManager();
    } else if (path.includes('/manage-courts')) {
        // Tương lai: initCourtManager();
    } else {
        console.log("Đang ở trang Dashboard");
        // Tương lai: initDashboard();
    }

    console.log("Ứng dụng đã khởi tạo thành công với cấu trúc mới!");
}

// Bắt đầu chạy ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', initializeApp);
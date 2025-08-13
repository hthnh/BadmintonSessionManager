// static/app.js


import initPlayerManager from './modules/player-manager.js';
import initDashboardManager from './modules/dashboard-manager.js';
import initCourtManager from './modules/court-manager.js';
import initHistoryManager from './modules/history-manager.js'; 
import initCreateManager from './modules/create-manager.js';

/**
 * Hàm cập nhật đồng hồ ở sidebar
 */
function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();

        // Sử dụng một mẹo nhỏ với locale 'sv-SE' (Thụy Điển) để có định dạng YYYY-MM-DD HH:MM:SS
        // Sau đó thay thế khoảng trắng ở giữa bằng chữ 'T' nếu muốn chuẩn ISO đầy đủ
        const isoString = now.toLocaleString('sv-SE').replace(' ', '   '); // Dùng 3 khoảng trắng cho dễ nhìn

        clockElement.textContent = isoString; // Kết quả: 2025-08-13   13:23:05
    }
}
/**
 * Hàm khởi tạo chính của toàn bộ ứng dụng
 */
function initializeApp() {
    console.log("Ứng dụng đang khởi tạo...");
    
    updateClock();
    setInterval(updateClock, 1000);

    const path = window.location.pathname;

    if (path.includes('/manage-players')) {
        initPlayerManager();
    } else if (path.includes('/manage-courts')) {
        initCourtManager();
    } else if (path.includes('/history')) {
        initHistoryManager();
    } else if (path.includes('/create')) { 
        initCreateManager();
    } else if (path === '/') {
        initDashboardManager();
    }

    console.log("Ứng dụng đã khởi tạo thành công!");
}

document.addEventListener('DOMContentLoaded', initializeApp);
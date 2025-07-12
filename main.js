// main.js
import { loadState } from './state.js';
import { renderAll, updateClock } from './ui.js';
import * as handlers from './handlers.js';

// Gán sự kiện cho các element tĩnh
function setupEventListeners() {
    document.getElementById('add-player-form').addEventListener('submit', handlers.handleAddPlayer);
    document.getElementById('suggest-btn').addEventListener('click', handlers.handleSuggestMatch);
    document.getElementById('confirm-match-btn').addEventListener('click', handlers.handleConfirmMatch);
    document.getElementById('add-court-btn').addEventListener('click', handlers.handleAddCourt);
    document.getElementById('clear-data-btn').addEventListener('click', handlers.handleClearAllData);
    document.getElementById('export-data-btn').addEventListener('click', handlers.handleExportData);
    document.getElementById('import-file-input').addEventListener('change', handlers.handleImportData);
    
    // Sử dụng event delegation cho các element động
    document.getElementById('player-list-body').addEventListener('click', handlers.handlePlayerTableClick);
    document.getElementById('attendance-list').addEventListener('click', handlers.handleAttendanceChange);
    document.getElementById('current-match-courts').addEventListener('click', handlers.handleCourtAreaClick);
    const playerListBody = document.getElementById('player-list-body');
    playerListBody.addEventListener('click', handlers.handlePlayerTableClick);
    
    // THÊM EVENT LISTENER MỚI cho việc chỉnh sửa trực tiếp
    playerListBody.addEventListener('focusout', handlers.handleInlineEdit);

    document.getElementById('attendance-list').addEventListener('click', handlers.handleAttendanceChange);
    document.getElementById('current-match-courts').addEventListener('click', handlers.handleCourtAreaClick);

}

// Hàm khởi tạo ứng dụng
function initialize() {
    loadState();
    setupEventListeners();
    renderAll();
    
    // Chạy các tác vụ nền
    setInterval(updateClock, 1000);
    setInterval(renderAll, 30000); // Cập nhật lại toàn bộ giao diện để làm mới thời gian nghỉ
    
    console.log("Ứng dụng quản lý sân cầu lông đã được khởi tạo!");
}

// Bắt đầu chạy ứng dụng
initialize();
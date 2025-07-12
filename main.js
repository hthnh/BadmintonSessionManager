// main.js
import { loadState } from './state.js';
import { renderAll, updateClock, addToHistory } from './ui.js';
import * as handlers from './handlers.js';

// Hàm render tổng hợp, là trái tim của việc cập nhật giao diện
function renderApp() {
    // Hàm này được truyền vào SortableJS.
    // Nó sẽ được gọi MỖI KHI người dùng thả một người chơi.
    const onDropHandler = (evt) => {
        // 1. Gọi handler để xử lý logic và thay đổi dữ liệu (state)
        handlers.handleDropPlayerOnCourt(evt);
        // 2. Ngay sau khi dữ liệu đã thay đổi, gọi lại renderApp để
        //    vẽ lại toàn bộ giao diện với dữ liệu mới nhất.
        renderApp();
    };
    // Luôn truyền onDropHandler mới nhất vào renderAll
    renderAll(onDropHandler);
}

// Hàm "action" để bao bọc các handler, đảm bảo re-render sau mỗi hành động
function action(handler, event) {
    handler(event);
    renderApp();
}

// Hàm bao bọc cho sự kiện click vào nút Kết thúc trận
function finishMatchAction(e) {
    if (e.target.classList.contains('finish-match-btn')) {
        const courtId = parseInt(e.target.dataset.courtId);
        const finishedCourt = handlers.handleFinishMatch(courtId);
        if (finishedCourt) {
            addToHistory(finishedCourt, finishedCourt.endTime);
            renderApp();
        }
    }
}

// Hàm bao bọc cho sự kiện click vào nút Xóa sân
function removeCourtAction(e) {
     if (e.target.classList.contains('delete-court-btn')) {
        const courtId = parseInt(e.target.dataset.courtId);
        handlers.handleRemoveCourt(courtId);
        renderApp();
    }
}

// Gán sự kiện cho các element tĩnh
function setupEventListeners() {
    document.getElementById('add-player-form').addEventListener('submit', e => action(handlers.handleAddPlayer, e));
    document.getElementById('suggest-btn').addEventListener('click', e => action(handlers.handleSuggestMatch, e));
    document.getElementById('confirm-match-btn').addEventListener('click', e => action(handlers.handleConfirmMatch, e));
    document.getElementById('add-court-btn').addEventListener('click', e => action(handlers.handleAddCourt, e));
    document.getElementById('clear-data-btn').addEventListener('click', handlers.handleClearAllData);
    document.getElementById('export-data-btn').addEventListener('click', handlers.handleExportData);
    
    // Listener đặc biệt cho import
    document.getElementById('import-file-input').addEventListener('change', handlers.handleImportData);
    document.addEventListener('datachanged', renderApp);

    // Event delegation cho các element động
    const playerListBody = document.getElementById('player-list-body');
    playerListBody.addEventListener('click', e => action(handlers.handlePlayerTableClick, e));
    playerListBody.addEventListener('focusout', e => action(handlers.handleInlineEdit, e));

    document.getElementById('attendance-list').addEventListener('click', e => action(handlers.handleAttendanceChange, e));
    
    const courtsContainer = document.getElementById('current-match-courts');
    courtsContainer.addEventListener('click', finishMatchAction);
    courtsContainer.addEventListener('click', removeCourtAction);
}

// Hàm khởi tạo ứng dụng
function initialize() {
    loadState();
    setupEventListeners();
    renderApp(); // Chạy lần đầu tiên để hiển thị giao diện

    setInterval(updateClock, 1000);
    // Giữ lại để cập nhật thời gian nghỉ cho người chơi
    setInterval(() => {
        // Chỉ cần render lại bảng người chơi là đủ để cập nhật thời gian
        // Điều này nhẹ hơn là render lại toàn bộ ứng dụng
        if(document.querySelector('#player-list-body')) {
             // Tạm thời vẫn render all để đảm bảo tính nhất quán
             renderApp();
        }
    }, 30000); 

    console.log("Ứng dụng quản lý sân cầu lông đã được khởi tạo và sửa lỗi!");
}

// Bắt đầu chạy ứng dụng
initialize();
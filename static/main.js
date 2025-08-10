// main.js (Phiên bản mới cho kiến trúc Backend/API)

// Bỏ các import cũ không cần thiết, ui.js và handlers.js sẽ được sửa sau
import { renderAll, updateClock } from './ui.js';
import { initializeEventHandlers } from './handlers.js';

// Nơi lưu trữ trạng thái tạm thời của frontend
// Dữ liệu này sẽ được nạp từ server
const appState = {
    players: [],
    courts: [],
    suggestions: [],
    ongoingMatches: [] // Thêm dòng này
};
/**
 * Hàm trung tâm để render lại toàn bộ giao diện
 * Nó sẽ sử dụng dữ liệu từ appState
 */
function renderApp() {
    console.log("Rendering with state:", appState);
    renderAll(appState);
}

/**
 * Hàm lấy dữ liệu mới nhất từ server và trigger render lại
 */
async function refreshDataAndRender() {
    try {
        // Sử dụng Promise.all để gọi các API song song cho hiệu quả
        const [playersResponse, courtsResponse] = await Promise.all([
            fetch('/api/players'),
            fetch('/api/courts'),
            fetch('/api/matches/ongoing')
        ]);

        if (!playersResponse.ok || !courtsResponse.ok) {
            throw new Error('Lỗi khi tải dữ liệu từ server.');
        }

        appState.players = await playersResponse.json();
        appState.courts = await courtsResponse.json();
        appState.ongoingMatches = await ongoingMatchesResponse.json(); // Lưu dữ liệu trận đấu

        // Sau khi có dữ liệu mới, vẽ lại giao diện
        renderApp();

    } catch (error) {
        console.error("Lỗi khi làm mới dữ liệu:", error);
        alert("Không thể kết nối tới server. Vui lòng thử lại.");
    }
}


/**
 * Hàm khởi tạo ứng dụng
 */
async function initialize() {
    console.log("Ứng dụng đang khởi tạo...");

    // Gán các sự kiện tĩnh cho các nút bấm, form...
    // Truyền hàm refreshDataAndRender vào để các handler có thể gọi sau khi thực hiện API
    initializeEventHandlers(appState, refreshDataAndRender, renderSuggestions);

    // Tải dữ liệu ban đầu và render ứng dụng
    await refreshDataAndRender();

    // Cập nhật đồng hồ và các tác vụ lặp lại khác
    setInterval(updateClock, 1000);
    
    // Không cần tự động refresh liên tục nữa, vì dữ liệu chỉ thay đổi khi có hành động
    // Nếu vẫn muốn cập nhật thời gian nghỉ, có thể giữ lại
    // setInterval(refreshDataAndRender, 60000); // Ví dụ: 1 phút 1 lần

    console.log("Ứng dụng đã được khởi tạo thành công với kiến trúc mới!");
}

// Bắt đầu chạy ứng dụng
initialize();
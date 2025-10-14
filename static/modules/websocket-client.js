// static/modules/websocket-client.js

// Biến lưu trữ kết nối WebSocket
let socket = null;
// Hàng đợi các hàm callback theo từng loại sự kiện
const eventHandlers = {};

/**
 * Hàm kết nối tới WebSocket server
 */
function connect() {
    // Tránh kết nối lại nếu đã có kết nối
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("WebSocket is already connected.");
        return;
    }

    // Lấy protocol (ws:// hoặc wss://) và host của trang web hiện tại
    const protocol = window.location.protocol === 'https' ? 'wss' : 'ws';
    const host = window.location.host;
    const wsUrl = `${protocol}://${host}/ws/web`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("WebSocket connection established to /ws/web");
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log("[WS Recv]:", message);

            // Nếu có hàm callback nào đăng ký cho loại sự kiện này thì gọi nó
            if (message.type && eventHandlers[message.type]) {
                eventHandlers[message.type].forEach(callback => callback(message.payload));
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    };

    socket.onclose = () => {
        console.log("WebSocket connection closed. Attempting to reconnect in 5 seconds...");
        // Tự động kết nối lại sau 5 giây
        setTimeout(connect, 5000);
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        socket.close(); // Đóng kết nối khi có lỗi để kích hoạt onclose và kết nối lại
    };
}

/**
 * Hàm để các module khác đăng ký lắng nghe một sự kiện
 * @param {string} eventType - Tên sự kiện (vd: 'score_updated')
 * @param {function} callback - Hàm sẽ được gọi khi sự kiện xảy ra
 */
function on(eventType, callback) {
    if (!eventHandlers[eventType]) {
        eventHandlers[eventType] = [];
    }
    eventHandlers[eventType].push(callback);
}

// Khởi tạo kết nối khi module được load
connect();

// Export các hàm cần thiết để các module khác có thể sử dụng
export { on };
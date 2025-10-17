import { io } from 'socket.io-client';

// Khởi tạo socket nhưng chưa kết nối
const socket = io('http://127.0.0.1:5000', {
  autoConnect: false
});

// Hàm để kết nối thủ công
const connect = () => {
  if (!socket.connected) {
    socket.connect();
    console.log('Socket.IO connected');
  }
};

// Hàm để ngắt kết nối
const disconnect = () => {
  if (socket.connected) {
    socket.disconnect();
    console.log('Socket.IO disconnected');
  }
};

// Hàm để lắng nghe một sự kiện
const listen = (eventName, callback) => {
  socket.on(eventName, callback);
};

// Hàm để ngừng lắng nghe một sự kiện
const off = (eventName) => {
  socket.off(eventName);
}

export const socketService = {
  connect,
  disconnect,
  listen,
  off,
  socket // export cả instance để có thể dùng trực tiếp nếu cần
};
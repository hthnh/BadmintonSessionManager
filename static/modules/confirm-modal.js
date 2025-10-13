// static/modules/confirm-modal.js

const modal = document.getElementById('confirm-modal');
const modalText = document.getElementById('confirm-modal-text');
const confirmBtn = document.getElementById('confirm-modal-confirm-btn');
const cancelBtn = document.getElementById('confirm-modal-cancel-btn');

let onConfirmCallback = null;

function show(message, onConfirm) {
    modalText.textContent = message;
    onConfirmCallback = onConfirm; // Lưu hàm callback lại
    modal.style.display = 'block';
}

function hide() {
    modal.style.display = 'none';
    onConfirmCallback = null; // Xóa callback khi modal đóng
}

function onConfirm() {
    if (typeof onConfirmCallback === 'function') {
        onConfirmCallback(); // Chỉ gọi callback nếu nó là một hàm
    }
    hide();
}

// Gán sự kiện cho các nút
confirmBtn.addEventListener('click', onConfirm);
cancelBtn.addEventListener('click', hide);
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        hide();
    }
});

// Xuất hàm `show` để các module khác có thể sử dụng
export const showConfirm = show;
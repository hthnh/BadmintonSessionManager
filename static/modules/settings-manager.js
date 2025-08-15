// static/modules/settings-manager.js

async function apiCall(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, options);
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.error || `Lỗi server: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi: ${error.message}`);
        return null;
    }
}

// Tải và điền dữ liệu cấu hình vào form
async function loadSettings() {
    const settings = await apiCall('/api/settings');
    if (settings) {
        for (const key in settings) {
            const inputElement = document.getElementById(key);
            if (inputElement) {
                inputElement.value = settings[key];
            }
        }
    }
}

// Xử lý khi submit form
async function handleSaveSettings(event) {
    event.preventDefault();
    const saveBtn = document.getElementById('save-settings-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';

    const form = document.getElementById('settings-form');
    const formData = new FormData(form);
    const newSettings = {};
    for (const [key, value] of formData.entries()) {
        newSettings[key] = value;
    }

    const result = await apiCall('/api/settings', 'PUT', newSettings);
    if (result) {
        alert(result.message);
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Lưu thay đổi';
}


export default function init() {
    // Tải cấu hình khi trang được mở
    loadSettings();

    // Gán sự kiện cho form
    const form = document.getElementById('settings-form');
    if (form) {
        form.addEventListener('submit', handleSaveSettings);
    }
}
// static/modules/player-manager.js

// Biến lưu trữ trạng thái của trang này
let players = [];
let isEditMode = false;
let editingPlayerId = null;

// Helper function để gọi API
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
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Lỗi server: ${response.status}`);
        }
        // Nếu không phải là GET và không có lỗi, không cần trả về JSON
        if (method !== 'GET' && response.status !== 204) {
             // 201 Created thường có body
            if(response.status === 201) return response.json();
            return { success: true, message: (await response.json()).message };
        }
        return response.json();
    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi: ${error.message}`);
        return null;
    }
}

// === CÁC HÀM RENDER ===

function renderPlayerList() {
    const container = document.getElementById('player-list-container');
    if (!container) return;
    container.innerHTML = ''; // Xóa list cũ

    if (players.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có người chơi nào.</div>';
        return;
    }

    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.dataset.playerId = player.id;

        const avatar = player.name.charAt(0).toUpperCase();
        
        // static/modules/player-manager.js -> renderPlayerList

        playerCard.innerHTML = `
            <div class="player-info">
                <div class="player-avatar">${avatar}</div>
                <div class="player-details">
                    <h5>${player.name}</h5>
            <p>SĐT: ${player.contact_info || 'Chưa có'} - Level: ${player.skill_level}</p>
                </div>
            </div>
            <div class="player-actions">
                <button class="button button--secondary detail-btn">Chi tiết</button>
                <button class="button button--secondary edit-btn">Sửa</button>
                <button class="button button--danger delete-btn">Xóa</button>
            </div>
        `;
// ...
        container.appendChild(playerCard);
    });
}

function populatePlayerDetailModal(player) {
    const fields = [
        'id','name', 'join_date', 'type', 'gender', 'contact_info', 'is_active','skill-level',
        'total_matches_played', 'total_wins', 'win_rate', 'current_win_streak',
        'longest_win_streak', 'last_played_date', 'total_sessions_attended'
    ];
    fields.forEach(field => {
        const element = document.getElementById(`detail-${field}`);
        if (element) {
            let value = player[field];
            // Format lại một số giá trị cho dễ đọc
            if (field === 'is_active') value = value ? 'Có mặt' : 'Vắng';
            if (field.includes('date')) value = value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
            if (field === 'win_rate') value = `${(value * 100).toFixed(1)}%`;
            element.textContent = value || 'N/A';
        }
    });
    document.getElementById('player-detail-modal').style.display = 'block';
}

// static/modules/player-manager.js -> populatePlayerForm
function populatePlayerForm(player) {
    isEditMode = true;
    editingPlayerId = player.id;
    
    document.getElementById('form-title').textContent = 'Chỉnh sửa người chơi';
    document.getElementById('player-id-input').value = player.id;
    document.getElementById('player-name-input').value = player.name;
    document.getElementById('player-contact-input').value = player.contact_info || '';
    document.getElementById('player-type-input').value = player.type;
    document.getElementById('player-gender-input').value = player.gender;
    // Điền vào mục chọn level
    document.getElementById('player-level-input').value = player.skill_level;
}


function resetPlayerForm() {
    isEditMode = false;
    editingPlayerId = null;

    document.getElementById('form-title').textContent = 'Thêm người chơi mới';
    document.getElementById('player-form').reset(); // Reset tất cả các trường
    document.getElementById('player-id-input').value = '';

    document.getElementById('advanced-settings-container').style.display = 'none';
    document.getElementById('toggle-advanced-btn').innerHTML = '<span>Thiết lập nâng cao ⚙️</span>';
}

// === CÁC HÀM XỬ LÝ SỰ KIỆN ===
// static/modules/player-manager.js -> handleFormSubmit
async function handleFormSubmit(e) {
    e.preventDefault();

    const playerData = {
        name: document.getElementById('player-name-input').value,
        contact_info: document.getElementById('player-contact-input').value,
        type: document.getElementById('player-type-input').value,
        gender: document.getElementById('player-gender-input').value,
        // Lấy giá trị skill_level
        skill_level: parseInt(document.getElementById('player-level-input').value, 10),
    };

    let result;
    if (isEditMode) {
        result = await apiCall(`/api/players/${editingPlayerId}`, 'PUT', playerData);
    } else {
        result = await apiCall('/api/players', 'POST', playerData);
    }

    if (result) {
        alert(result.message || 'Thao tác thành công!');
        resetPlayerForm();
        fetchAndRenderPlayers();
    }
}

function handlePlayerListClick(e) {
    const target = e.target;
    const playerCard = target.closest('.player-card');
    if (!playerCard) return;

    const playerId = parseInt(playerCard.dataset.playerId);
    const player = players.find(p => p.id === playerId);

    if (target.classList.contains('detail-btn')) {
        populatePlayerDetailModal(player);
    }
    else if (target.classList.contains('edit-btn')) {
        populatePlayerForm(player);
        // Cuộn đến form để người dùng thấy
        document.getElementById('form-title').scrollIntoView({ behavior: 'smooth' });
    }
    else if (target.classList.contains('delete-btn')) {
        if (confirm(`Bạn có chắc muốn xóa vĩnh viễn người chơi "${player.name}"?`)) {
            apiCall(`/api/players/${playerId}`, 'DELETE').then(result => {
                if(result) {
                    alert(result.message);
                    fetchAndRenderPlayers();
                }
            });
        }
    }
}

function initializeEventListeners() {
    // Event delegation cho danh sách người chơi
    document.getElementById('player-list-container').addEventListener('click', handlePlayerListClick);

    // Sự kiện cho form
    document.getElementById('player-form').addEventListener('submit', handleFormSubmit);

    // Sự kiện cho modal
    const modal = document.getElementById('player-detail-modal');
    modal.querySelector('.close-btn').addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    // Sự kiện cho nút bật/tắt nâng cao
    document.getElementById('toggle-advanced-btn').addEventListener('click', () => {
        const container = document.getElementById('advanced-settings-container');
        const isHidden = container.style.display === 'none' || container.style.display === '';
        container.style.display = isHidden ? 'block' : 'none';
        container.previousElementSibling.innerHTML = isHidden ? '<span>Thu gọn bớt 🔼</span>' : '<span>Thiết lập nâng cao ⚙️</span>';
    });
}

// === HÀM TRUNG TÂM ===

async function fetchAndRenderPlayers() {
    players = await apiCall('/api/players');
    if (players) {
        renderPlayerList();
    }
}

/**
 * Hàm khởi tạo duy nhất cho module này, được gọi từ app.js
 */
export default function init() {
    // 1. Lấy dữ liệu và render lần đầu
    fetchAndRenderPlayers();
    
    // 2. Gán tất cả các sự kiện
    initializeEventListeners();
}
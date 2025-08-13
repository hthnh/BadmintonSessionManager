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
        
        playerCard.innerHTML = `
            <div class="player-info">
                <div class="player-avatar">${avatar}</div>
                <div class="player-details">
                    <h5>${player.name}</h5>
                    <p>SĐT: ${player.contact_info || 'Chưa có'} - ELO: ${Math.round(player.elo_rating)}</p>
                </div>
            </div>
            <div class="player-actions">
                <button class="button button--secondary detail-btn">Chi tiết</button>
                <button class="button button--secondary edit-btn">Sửa</button>
                <button class="button button--danger delete-btn">Xóa</button>
            </div>
        `;
        container.appendChild(playerCard);
    });
}

function populatePlayerDetailModal(player) {
    document.getElementById('modal-player-name').textContent = player.name;
    const fields = [
        'id', 'join_date', 'type', 'gender', 'contact_info', 'is_active',
        'elo_rating', 'k_factor', 'rank_tier', 'provisional_games_left',
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

function populatePlayerForm(player) {
    isEditMode = true;
    editingPlayerId = player.id;
    
    document.getElementById('form-title').textContent = 'Chỉnh sửa người chơi';
    document.getElementById('player-id-input').value = player.id;
    document.getElementById('player-name-input').value = player.name;
    document.getElementById('player-contact-input').value = player.contact_info || '';
    document.getElementById('player-type-input').value = player.type;
    document.getElementById('player-gender-input').value = player.gender;
    
    // Điền các trường nâng cao
    document.getElementById('player-elo-input').value = player.elo_rating;
    document.getElementById('player-k-factor-input').value = player.k_factor;
    document.getElementById('player-provisional-input').value = player.provisional_games_left;
    document.getElementById('player-rank-tier-input').value = player.rank_tier || '';
    
    // Đảm bảo form nâng cao được ẩn khi bắt đầu sửa
    document.getElementById('advanced-settings-container').style.display = 'none';
    document.getElementById('toggle-advanced-btn').innerHTML = '<span>Thiết lập nâng cao ⚙️</span>';
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

async function handleFormSubmit(e) {
    e.preventDefault();

    // Thu thập dữ liệu từ các trường cơ bản
    const playerData = {
        name: document.getElementById('player-name-input').value,
        contact_info: document.getElementById('player-contact-input').value,
        type: document.getElementById('player-type-input').value,
        gender: document.getElementById('player-gender-input').value,
    };

    // Nếu các trường nâng cao được hiển thị, thu thập cả dữ liệu từ chúng
    if (document.getElementById('advanced-settings-container').style.display === 'block') {
        playerData.elo_rating = parseFloat(document.getElementById('player-elo-input').value);
        playerData.k_factor = parseInt(document.getElementById('player-k-factor-input').value);
        playerData.provisional_games_left = parseInt(document.getElementById('player-provisional-input').value);
        playerData.rank_tier = document.getElementById('player-rank-tier-input').value;
    }

    let result;
    if (isEditMode) {
        // Gọi API để cập nhật (PUT)
        result = await apiCall(`/api/players/${editingPlayerId}`, 'PUT', playerData);
    } else {
        // Gọi API để tạo mới (POST)
        result = await apiCall('/api/players', 'POST', playerData);
    }

    if (result) {
        alert(result.message || 'Thao tác thành công!');
        resetPlayerForm();
        fetchAndRenderPlayers(); // Tải lại danh sách
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
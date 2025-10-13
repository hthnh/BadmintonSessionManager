// static/modules/player-manager.js (Refactored with Toast and Confirm Modal)

import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';

let players = [];
let isEditMode = false;
let editingPlayerId = null;

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
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        if (method !== 'GET' && response.status !== 204) {
            if (response.status === 201) return response.json();
            return { success: true, message: (await response.json()).message };
        }
        return response.json();
    } catch (error) {
        console.error(`API call error to ${url}:`, error);
        // Replace alert with error toast
        showToast(`An error occurred: ${error.message}`, 'error');
        return null;
    }
}

// === RENDERING FUNCTIONS ===

function renderPlayerList() {
    const container = document.getElementById('player-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (players.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có người chơi nào.</div>';
        return;
    }
    
    players.sort((a, b) => a.name.localeCompare(b.name))
           .forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.dataset.playerId = player.id;

        const avatar = player.name.charAt(0).toUpperCase();
        
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
        container.appendChild(playerCard);
    });
}

function populatePlayerDetailModal(player) {
    const fields = [
        'id', 'name', 'join_date', 'type', 'gender', 'contact_info', 'is_active', 'skill_level',
        'total_matches_played', 'total_wins', 'win_rate',
        'last_played_date', 'total_sessions_attended'
    ];
    fields.forEach(field => {
        const element = document.getElementById(`detail-${field}`);
        if (element) {
            let value = player[field];
            if (field === 'is_active') value = value ? 'Có mặt' : 'Vắng';
            if (field.includes('date') && value) value = new Date(value).toLocaleString('vi-VN');
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
    document.getElementById('player-level-input').value = player.skill_level;
}

function resetPlayerForm() {
    isEditMode = false;
    editingPlayerId = null;
    document.getElementById('form-title').textContent = 'Thêm người chơi mới';
    document.getElementById('player-form').reset();
    document.getElementById('player-id-input').value = '';
    document.getElementById('advanced-settings-container').style.display = 'none';
    document.getElementById('toggle-advanced-btn').innerHTML = '<span>Thiết lập nâng cao ⚙️</span>';
}

// === EVENT HANDLERS ===

async function handleFormSubmit(e) {
    e.preventDefault();

    const playerData = {
        name: document.getElementById('player-name-input').value,
        contact_info: document.getElementById('player-contact-input').value,
        type: document.getElementById('player-type-input').value,
        gender: document.getElementById('player-gender-input').value,
        skill_level: parseInt(document.getElementById('player-level-input').value, 10),
    };

    let result;
    if (isEditMode) {
        result = await apiCall(`/api/players/${editingPlayerId}`, 'PUT', playerData);
    } else {
        result = await apiCall('/api/players', 'POST', playerData);
    }

    if (result) {
        // Replace alert with success toast
        showToast(result.message || 'Thao tác thành công!', 'success');
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
    } else if (target.classList.contains('edit-btn')) {
        populatePlayerForm(player);
        document.getElementById('form-title').scrollIntoView({ behavior: 'smooth' });
    } else if (target.classList.contains('delete-btn')) {
        // Replace confirm with showConfirm modal
        showConfirm(`Bạn có chắc muốn xóa vĩnh viễn người chơi "${player.name}"?`, async () => {
            const result = await apiCall(`/api/players/${playerId}`, 'DELETE');
            if (result) {
                showToast(result.message, 'success');
                fetchAndRenderPlayers();
            }
        });
    }
}

function initializeEventListeners() {
    document.getElementById('player-list-container').addEventListener('click', handlePlayerListClick);
    document.getElementById('player-form').addEventListener('submit', handleFormSubmit);

    const modal = document.getElementById('player-detail-modal');
    modal.querySelector('.close-btn').addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    document.getElementById('toggle-advanced-btn').addEventListener('click', () => {
        const container = document.getElementById('advanced-settings-container');
        const isHidden = container.style.display === 'none' || container.style.display === '';
        container.style.display = isHidden ? 'block' : 'none';
        container.previousElementSibling.innerHTML = isHidden ? '<span>Thu gọn bớt 🔼</span>' : '<span>Thiết lập nâng cao ⚙️</span>';
    });
}

// === MAIN FUNCTION ===

async function fetchAndRenderPlayers() {
    players = await apiCall('/api/players');
    if (players) {
        renderPlayerList();
    }
}

export default function init() {
    fetchAndRenderPlayers();
    initializeEventListeners();
}
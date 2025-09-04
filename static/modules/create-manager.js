// static/modules/create-manager.js (Phiên bản Sửa lỗi TypeError)

// === STATE MANAGEMENT ===
let availablePlayers = [];
let availableCourts = [];
let courtSlots = {
    teamA: [],
    teamB: []
};

// === API CALLS ===
async function apiCall(url, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Lỗi server: ${response.status}`);
        }
        if (response.status === 204) return { success: true };
        return response.json();
    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi: ${error.message}`);
        return null;
    }
}

// === RENDERING LOGIC ===

function renderAvailablePlayerList() {
    const container = document.getElementById('player-list-container');
    container.innerHTML = '';
    const playersOnCourtIds = new Set([...courtSlots.teamA, ...courtSlots.teamB]);

    availablePlayers.sort((a, b) => a.name.localeCompare(b.name))
        .forEach(player => {
            const div = document.createElement('div');
            div.className = 'player-select-item';
            div.dataset.playerId = player.id;
            div.draggable = true;

            if (playersOnCourtIds.has(player.id)) {
                div.classList.add('on-court');
            }

            div.innerHTML = `<label>${player.name} (Level: ${player.skill_level})</label>`;
            container.appendChild(div);
        });
}

function renderCourt() {
    const container = document.getElementById('court-layout-container');

    const createTeamHTML = (team, teamName) => {
        let playersHTML = team.map(playerId => {
            const player = availablePlayers.find(p => p.id === playerId);
            
            // [SỬA LỖI] Kiểm tra xem player có tồn tại không trước khi dùng
            if (!player) {
                console.error(`Lỗi: Không tìm thấy người chơi với ID ${playerId} trong danh sách availablePlayers.`);
                return ''; // Trả về chuỗi rỗng để không làm hỏng giao diện
            }

            return `<div class="player-chip" draggable="true" data-player-id="${playerId}">${player.name}</div>`;
        }).join('');

        if (team.length === 0) {
            playersHTML = '<div class="player-slot-placeholder">Kéo người chơi vào đây</div>';
        } else if (team.length === 1) {
            playersHTML += '<div class="player-slot-placeholder">Kéo thêm người (đánh đôi)</div>';
        }

        return `<div class="court-team-area" data-team="${teamName}">
                    <div class="team-label">ĐỘI ${teamName}</div>
                    ${playersHTML}
                </div>`;
    };

    const teamA_HTML = createTeamHTML(courtSlots.teamA, 'A');
    const teamB_HTML = createTeamHTML(courtSlots.teamB, 'B');

    container.innerHTML = `<div class="court-layout">${teamA_HTML}<div class="court-net"></div>${teamB_HTML}</div>`;
}

function renderCourtSelector() {
    const select = document.getElementById('court-select');
    select.innerHTML = '';
    if (availableCourts.length === 0) {
        select.innerHTML = '<option value="">Không có sân trống</option>';
        return;
    }
    availableCourts.forEach(court => {
        const option = document.createElement('option');
        option.value = court.id;
        option.textContent = court.name;
        select.appendChild(option);
    });
}

function updateUIStates() {
    document.getElementById('player-count').textContent = `Sẵn sàng: ${availablePlayers.length}`;
    const confirmBtn = document.getElementById('confirm-match-btn');
    const validationMsg = document.getElementById('validation-message');
    const isTeamAValid = courtSlots.teamA.length >= 1 && courtSlots.teamA.length <= 2;
    const isTeamBValid = courtSlots.teamB.length >= 1 && courtSlots.teamB.length <= 2;

    if (!isTeamAValid || !isTeamBValid) {
        confirmBtn.disabled = true;
        validationMsg.textContent = 'Mỗi đội phải có ít nhất 1 người chơi.';
    } else if (availableCourts.length === 0) {
        confirmBtn.disabled = true;
        validationMsg.textContent = 'Không có sân nào trống.';
    } else {
        confirmBtn.disabled = false;
        validationMsg.textContent = '';
    }
    
    renderAvailablePlayerList();
    renderCourt();
}

// === EVENT HANDLERS ===

async function handleConfirmMatch() {
    const courtId = document.getElementById('court-select').value;
    if (!courtId) { alert('Vui lòng chọn sân!'); return; }

    const team_A = courtSlots.teamA.map(id => {
        const p = availablePlayers.find(player => player.id === id);
        return { id: p.id, name: p.name }; // Chỉ gửi id và name
    });
    const team_B = courtSlots.teamB.map(id => {
        const p = availablePlayers.find(player => player.id === id);
        return { id: p.id, name: p.name }; // Chỉ gửi id và name
    });
    const data = { court_id: parseInt(courtId, 10), team_A, team_B };

    const result = await apiCall('/api/matches/queue', 'POST', data);
    if (result) {
        alert(result.message || 'Đã thêm trận đấu vào hàng chờ thành công!');
        window.location.href = '/';
    }
}

// === DRAG & DROP LOGIC ===
let draggedPlayerId = null;

function handleDragStart(e) {
    const target = e.target.closest('[data-player-id]');
    if (!target) return;
    draggedPlayerId = parseInt(target.dataset.playerId, 10);
    e.dataTransfer.setData('text/plain', draggedPlayerId);
    target.classList.add('dragging');
}

function handleDragEnd(e) {
    const target = e.target.closest('[data-player-id]');
    target?.classList.remove('dragging'); // Thêm optional chaining an toàn hơn
    draggedPlayerId = null;
}

function handleDragOver(e) {
    e.preventDefault();
    const teamArea = e.target.closest('.court-team-area');
    if (teamArea) {
        teamArea.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.target.closest('.court-team-area')?.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const teamArea = e.target.closest('.court-team-area');
    if (!teamArea) return;

    teamArea.classList.remove('drag-over');
    const targetTeamName = teamArea.dataset.team;
    const targetTeam = targetTeamName === 'A' ? courtSlots.teamA : courtSlots.teamB;
    
    if (targetTeam.length >= 2) {
        alert("Mỗi đội chỉ có tối đa 2 người chơi.");
        return;
    }

    const droppedPlayerId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    if (courtSlots.teamA.includes(droppedPlayerId)) {
        courtSlots.teamA = courtSlots.teamA.filter(id => id !== droppedPlayerId);
    }
    if (courtSlots.teamB.includes(droppedPlayerId)) {
        courtSlots.teamB = courtSlots.teamB.filter(id => id !== droppedPlayerId);
    }

    targetTeam.push(droppedPlayerId);
    updateUIStates();
}

// === INITIALIZATION ===
function initializeDragDropListeners() {
    const playerListContainer = document.getElementById('player-list-container');
    const courtContainer = document.getElementById('court-layout-container');

    playerListContainer.addEventListener('dragstart', handleDragStart);
    playerListContainer.addEventListener('dragend', handleDragEnd);
    courtContainer.addEventListener('dragstart', handleDragStart);
    courtContainer.addEventListener('dragend', handleDragEnd);
    courtContainer.addEventListener('dragover', handleDragOver);
    courtContainer.addEventListener('dragleave', handleDragLeave);
    courtContainer.addEventListener('drop', handleDrop);
}

function renderInitialPlayerCheckboxes(container) {
    container.innerHTML = '';
    allPlayers.sort((a,b) => a.name.localeCompare(b.name)).forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-select-item-checkbox';
        div.innerHTML = `
            <input type="checkbox" id="player-check-${player.id}" data-player-id="${player.id}">
            <label for="player-check-${player.id}">${player.name}</label>
        `;
        container.appendChild(div);
    });
    container.addEventListener('change', handlePlayerSelection);
}

export default async function init() {
    const [players, courts, ongoingMatches] = await Promise.all([
        apiCall('/api/players/available'),
        apiCall('/api/courts'),
        apiCall('/api/matches/ongoing')
    ]);

    availablePlayers = players || [];
    const busyCourtIds = new Set((ongoingMatches || []).map(m => m.court_id));
    availableCourts = (courts || []).filter(c => !busyCourtIds.has(c.id));
    
    document.getElementById('confirm-match-btn').addEventListener('click', handleConfirmMatch);
    
    initializeDragDropListeners();
    renderCourtSelector();
    updateUIStates();
}
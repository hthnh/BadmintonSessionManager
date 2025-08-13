// static/modules/create-manager.js

// === STATE MANAGEMENT ===
let allPlayers = [];
let allCourts = [];
let busyPlayerIds = new Set();
let busyCourtIds = new Set();

let selectedPlayerIds = new Set();
let selectedCourtId = null;

// === API CALLS ===
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
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        }
        return { success: true };
    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi: ${error.message}`);
        return null;
    }
}
// === RENDERING LOGIC ===
function renderPlayers() {
    const container = document.getElementById('player-list-container');
    container.innerHTML = '';
    const sortedPlayers = [...allPlayers].sort((a, b) => {
        const aIsBusy = busyPlayerIds.has(a.id);
        const bIsBusy = busyPlayerIds.has(b.id);
        if (aIsBusy !== bIsBusy) return aIsBusy - bIsBusy;
        return a.name.localeCompare(b.name);
    });

    sortedPlayers.forEach(player => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.dataset.playerId = player.id;
        item.innerHTML = `<span>${player.name}</span> <span class="elo">ELO: ${Math.round(player.elo_rating)}</span>`;

        if (busyPlayerIds.has(player.id)) item.classList.add('disabled');
        if (selectedPlayerIds.has(player.id)) item.classList.add('selected');
        
        container.appendChild(item);
    });
}

function renderCourts() {
    const container = document.getElementById('court-list-container');
    container.innerHTML = '';
    allCourts.forEach(court => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.dataset.courtId = court.id;
        item.textContent = court.name;

        if (busyCourtIds.has(court.id)) item.classList.add('disabled');
        if (selectedCourtId === court.id) item.classList.add('selected');

        container.appendChild(item);
    });
}

function updateStagingArea() {
    const playersList = document.getElementById('staging-players');
    const courtText = document.getElementById('staging-court');
    const createBtn = document.getElementById('create-match-btn');

    playersList.innerHTML = '';
    if (selectedPlayerIds.size > 0) {
        selectedPlayerIds.forEach(id => {
            const player = allPlayers.find(p => p.id === id);
            const li = document.createElement('li');
            li.textContent = player.name;
            playersList.appendChild(li);
        });
    } else {
        playersList.innerHTML = '<li class="staging-placeholder">Chưa chọn người chơi nào.</li>';
    }

    if (selectedCourtId) {
        const court = allCourts.find(c => c.id === selectedCourtId);
        courtText.textContent = court.name;
        courtText.classList.remove('staging-placeholder');
    } else {
        courtText.textContent = 'Chưa chọn sân.';
        courtText.classList.add('staging-placeholder');
    }
    
    // Kích hoạt nút khi đủ điều kiện
    createBtn.disabled = !(selectedPlayerIds.size === 4 && selectedCourtId !== null);
}


// === EVENT HANDLERS ===
function handlePlayerClick(e) {
    const target = e.target.closest('.selection-item');
    if (!target || target.classList.contains('disabled')) return;

    const playerId = parseInt(target.dataset.playerId);
    if (selectedPlayerIds.has(playerId)) {
        selectedPlayerIds.delete(playerId);
    } else {
        if (selectedPlayerIds.size < 4) {
            selectedPlayerIds.add(playerId);
        } else {
            alert('Bạn chỉ có thể chọn tối đa 4 người chơi.');
        }
    }
    renderPlayers(); // Vẽ lại để cập nhật class 'selected'
    updateStagingArea();
}

function handleCourtClick(e) {
    const target = e.target.closest('.selection-item');
    if (!target || target.classList.contains('disabled')) return;
    
    const courtId = parseInt(target.dataset.courtId);
    selectedCourtId = (selectedCourtId === courtId) ? null : courtId;
    
    renderCourts(); // Vẽ lại để cập nhật class 'selected'
    updateStagingArea();
}

async function handleCreateMatch() {
    if (selectedPlayerIds.size !== 4 || !selectedCourtId) {
        alert('Vui lòng chọn đúng 4 người chơi và 1 sân.');
        return;
    }
    
    const data = {
        court_id: selectedCourtId,
        player_ids: Array.from(selectedPlayerIds)
    };

    const result = await apiCall('/api/matches/create', 'POST', data);
    if (result) {
        alert(result.message);
        window.location.href = '/'; // Chuyển về Dashboard để xem trận đấu
    }
}

// === INITIALIZATION ===
async function fetchData() {
    const [players, courts, ongoingMatches] = await Promise.all([
        apiCall('/api/players'),
        apiCall('/api/courts'),
        apiCall('/api/matches/ongoing')
    ]);
    
    allPlayers = players || [];
    allCourts = courts || [];
    
    if (ongoingMatches) {
        ongoingMatches.forEach(match => {
            busyCourtIds.add(match.court_id);
            match.team_A.forEach(p => busyPlayerIds.add(p.id));
            match.team_B.forEach(p => busyPlayerIds.add(p.id));
        });
    }

    renderPlayers();
    renderCourts();
    updateStagingArea();
}

export default function init() {
    fetchData();
    document.getElementById('player-list-container').addEventListener('click', handlePlayerClick);
    document.getElementById('court-list-container').addEventListener('click', handleCourtClick);
    document.getElementById('create-match-btn').addEventListener('click', handleCreateMatch);
}
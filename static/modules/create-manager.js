// static/modules/create-manager.js (Sử dụng API Suggest)

// === STATE MANAGEMENT ===
let allPlayers = [];
let availableCourts = [];
let selectedPlayerIds = new Set();
let suggestedMatches = []; // Thay cho generatedPairings
let confirmedMatch = null;

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
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) return response.json();
        return { success: true, message: "Thao tác thành công!" };
    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi: ${error.message}`);
        return null;
    }
}

// === RENDERING LOGIC ===

// Render mục 1: Danh sách người chơi
function renderPlayerList() {
    const container = document.getElementById('player-list-container');
    container.innerHTML = '';
    allPlayers.sort((a,b) => a.name.localeCompare(b.name)).forEach(player => {
        const isChecked = selectedPlayerIds.has(player.id);
        const mustRest = player.consecutive_matches >= 2;
        const disabledAttr = mustRest ? 'disabled' : '';

        const div = document.createElement('div');
        div.className = 'player-select-item';
        div.innerHTML = `
            <input type="checkbox" id="player-${player.id}" data-player-id="${player.id}" ${isChecked ? 'checked' : ''} ${disabledAttr}>
            <label for="player-${player.id}">
                ${player.name} (ELO: ${Math.round(player.elo_rating)})
                ${mustRest ? '<span class="rest-badge">Cần nghỉ</span>' : ''}
            </label>
        `;
        container.appendChild(div);
    });
}

// Render mục 2: Danh sách các trận đấu được gợi ý từ API
function renderSuggestedMatches() {
    const container = document.getElementById('pairings-list-container');
    container.innerHTML = '';

    if (suggestedMatches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có gợi ý nào.</div>';
        return;
    }

    suggestedMatches.forEach((match, index) => {
        const teamANames = `${match.team_A[0].name.split(' ').pop()} & ${match.team_A[1].name.split(' ').pop()}`;
        const teamBNames = `${match.team_B[0].name.split(' ').pop()} & ${match.team_B[1].name.split(' ').pop()}`;
        const div = document.createElement('div');
        div.className = 'pairing-item';
        div.dataset.matchIndex = index;
        div.innerHTML = `
            <div>${teamANames} <strong style="color: var(--color-primary)">vs</strong> ${teamBNames}</div>
            <small style="color: var(--color-secondary)">Độ chênh: ${match.balance_score}</small>
        `;
        container.appendChild(div);
    });
}

// Render mục 3: Khu vực xác nhận
function renderConfirmation() {
    const container = document.getElementById('confirmation-container');
    if (!confirmedMatch) {
        container.innerHTML = '<div class="list-item-placeholder">Vui lòng chọn một cặp đấu từ Bước 2.</div>';
        return;
    }

    const { team_A, team_B } = confirmedMatch;
    const teamANames = `${team_A[0].name} & ${team_A[1].name}`;
    const teamBNames = `${team_B[0].name} & ${team_B[1].name}`;
    // Lấy sân đã được gợi ý hoặc cho phép chọn
    const suggestedCourtId = confirmedMatch.court_id;
    const courtOptions = availableCourts.map(court => 
        `<option value="${court.id}" ${court.id === suggestedCourtId ? 'selected' : ''}>${court.name}</option>`
    ).join('');

    container.innerHTML = `
        <div class="pairing-card">
            <div class="pairing-card__teams">
                <div>
                    <div><strong>Đội A:</strong> ${teamANames}</div>
                    <div style="margin: 0.5rem 0;"><strong>VS</strong></div>
                    <div><strong>Đội B:</strong> ${teamBNames}</div>
                </div>
            </div>
            <div class="pairing-card__court-selector">
                <label for="court-select">Gán vào sân:</label>
                <select id="court-select">
                    ${courtOptions}
                </select>
            </div>
            <button id="confirm-match-btn" class="button button--primary">Xác nhận & Bắt đầu</button>
        </div>
    `;
    document.getElementById('confirm-match-btn').addEventListener('click', handleConfirmMatch);
}

// Cập nhật trạng thái giao diện
function updateUIStates() {
    const playerCount = selectedPlayerIds.size;
    document.getElementById('player-count').textContent = `Đã chọn: ${playerCount}`;
    const generateBtn = document.getElementById('generate-pairings-btn');

    if (playerCount >= 4 && playerCount % 4 === 0) {
        generateBtn.disabled = false;
        generateBtn.textContent = `Gợi ý cặp đấu từ ${playerCount} người`;
    } else {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Chọn số người là bội của 4';
    }

    // Reset các bước sau nếu lựa chọn người chơi thay đổi
    suggestedMatches = [];
    confirmedMatch = null;
    renderSuggestedMatches();
    renderConfirmation();
}


// === EVENT HANDLERS ===

function handlePlayerSelection(e) {
    if (e.target.matches('input[type="checkbox"]')) {
        const playerId = parseInt(e.target.dataset.playerId, 10);
        e.target.checked ? selectedPlayerIds.add(playerId) : selectedPlayerIds.delete(playerId);
        updateUIStates();
    }
}

function handleSelectAll() {
    allPlayers.forEach(p => {
        // Chỉ chọn những người không bị bắt buộc nghỉ
        if (p.consecutive_matches < 2) {
            selectedPlayerIds.add(p.id);
        }
    });
    renderPlayerList();
    updateUIStates();
}

function handleDeselectAll() {
    selectedPlayerIds.clear();
    renderPlayerList();
    updateUIStates();
}

// [THAY ĐỔI QUAN TRỌNG] Gọi API suggestions
async function handleGenerateSuggestions() {
    const btn = document.getElementById('generate-pairings-btn');
    btn.disabled = true;
    btn.textContent = 'Đang tính toán...';

    const data = { player_ids: Array.from(selectedPlayerIds) };
    const result = await apiCall('/api/suggestions', 'POST', data);

    if (result) {
        suggestedMatches = result.suggestions;
        renderSuggestedMatches();
    }
    
    btn.disabled = false;
    btn.textContent = `Gợi ý cặp đấu từ ${selectedPlayerIds.size} người`;
}

function handlePairingSelection(e) {
    const target = e.target.closest('.pairing-item');
    if (!target) return;
    document.querySelectorAll('.pairing-item.selected').forEach(el => el.classList.remove('selected'));
    target.classList.add('selected');

    const matchIndex = parseInt(target.dataset.matchIndex, 10);
    confirmedMatch = suggestedMatches[matchIndex];
    renderConfirmation();
}

async function handleConfirmMatch() {
    const courtSelect = document.getElementById('court-select');
    const courtId = courtSelect.value;
    if (!courtId) { alert('Vui lòng chọn sân!'); return; }
    if (!confirmedMatch) { alert('Lỗi, vui lòng chọn lại cặp đấu.'); return; }

    const data = {
        court_id: parseInt(courtId, 10),
        team_A: confirmedMatch.team_A,
        team_B: confirmedMatch.team_B
    };

    // [THAY ĐỔI] Gọi API /queue thay vì /start
    const result = await apiCall('/api/matches/queue', 'POST', data);
    
    if (result) {
        alert(result.message); // Hiển thị thông báo "Đã thêm vào hàng chờ!"
        window.location.href = '/'; // Chuyển về Dashboard để xem hàng chờ
    }
}

// === INITIALIZATION ===
export default async function init() {
    const [players, courts, ongoingMatches] = await Promise.all([
        apiCall('/api/players'),
        apiCall('/api/courts'),
        apiCall('/api/matches/ongoing')
    ]);

    allPlayers = players || [];
    const busyCourtIds = new Set((ongoingMatches || []).map(m => m.court_id));
    availableCourts = (courts || []).filter(c => !busyCourtIds.has(c.id));

    // Gán sự kiện
    document.getElementById('player-list-container').addEventListener('click', handlePlayerSelection);
    document.getElementById('pairings-list-container').addEventListener('click', handlePairingSelection);
    document.getElementById('select-all-btn').addEventListener('click', handleSelectAll);
    document.getElementById('deselect-all-btn').addEventListener('click', handleDeselectAll);
    document.getElementById('generate-pairings-btn').addEventListener('click', handleGenerateSuggestions);

    renderPlayerList();
    updateUIStates();
}
// Filename: static/modules/dashboard-manager.js
// (Restored 100% from original ...7457... version)

let allPlayers = [];
let socket;
let scoreboardStates = {};

// ... (Các hàm từ handleStartSession đến renderAttendanceModal không thay đổi) ...
async function handleStartSession() {
    if (confirm('Are you sure you want to start a new session? This will reset all temporary stats...')) {
        const result = await apiCall('/api/sessions/start', 'POST');
        if (result) {
            alert(result.message);
            await checkSessionStatus();
            await refreshDashboard();
        }
    }
}
async function handleEndSession() {
    if (confirm('Are you sure you want to end this session? All players will be marked as "absent".')) {
        const result = await apiCall('/api/sessions/end', 'POST');
        if (result) {
            alert(result.message);
            await checkSessionStatus();
            await refreshDashboard();
        }
    }
}
async function checkSessionStatus() {
    const statusText = document.getElementById('session-status-text');
    const buttonsContainer = document.getElementById('session-action-buttons');
    buttonsContainer.innerHTML = '';
    const session = await apiCall('/api/sessions/current');
    if (session) {
        const startTime = new Date(session.start_time).toLocaleString('vi-VN');
        statusText.innerHTML = `<span style="color: #198754; font-weight: 700;">ACTIVE</span> (Started at: ${startTime})`;
        const endButton = document.createElement('button');
        endButton.className = 'button button--danger';
        endButton.textContent = 'End Session';
        endButton.onclick = handleEndSession;
        buttonsContainer.appendChild(endButton);
    } else {
        statusText.innerHTML = `<span style="color: #6c757d; font-weight: 700;">NOT STARTED</span>`;
        const startButton = document.createElement('button');
        startButton.className = 'button button--primary';
        startButton.textContent = 'Start New Session';
        startButton.onclick = handleStartSession;
        buttonsContainer.appendChild(startButton);
    }
}
async function apiCall(url, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) return response.json();
        return { success: true };
    } catch (error) {
        console.error(`API call error to ${url}:`, error);
        alert(`An error occurred: ${error.message}`);
        return null;
    }
}
function renderActivePlayers() {
    const container = document.getElementById('active-players-container');
    container.innerHTML = '';
    const activePlayers = allPlayers.filter(p => p.is_active);
    if (activePlayers.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">No active players.</div>';
        return;
    }
    activePlayers.sort((a, b) => a.name.localeCompare(b.name));
    activePlayers.forEach(player => {
        const div = document.createElement('div');
        div.className = 'list-item-player';
        div.innerHTML = `
            <span>${player.name}</span> 
            <span class="player-elo">
                - Matches: <strong style="color: var(--color-primary);">${player.session_matches_played}</strong> 
                - Level: ${player.skill_level}
            </span>`;
        container.appendChild(div);
    });
}
function renderQueuedMatches(matches) {
    const container = document.getElementById('queue-container');
    container.innerHTML = '';
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">No matches in queue.</div>';
        return;
    }
    matches.forEach(match => {
        const div = document.createElement('div');
        div.className = 'history-item-v2 queued';
        const teamAPlayers = match.team_A.map(p => p.name.split(' ').pop()).join(' & ');
        const teamBPlayers = match.team_B.map(p => p.name.split(' ').pop()).join(' & ');
        div.innerHTML = `
            <div class="history-item-v2__header">
                <strong>Unassigned Match</strong>
                <span class="status-tag queued-tag">Waiting</span>
            </div>
            <div class="history-item-v2__body">
                <span class="team-name">${teamAPlayers}</span>
                <strong class="vs-separator-queue">VS</strong>
                <span class="team-name">${teamBPlayers}</span>
            </div>
            <div class="history-item-v2__footer">
                 <button class="button button--primary assign-and-begin-btn" data-match-id="${match.id}">Assign Court & Start</button>
            </div>
        `;
        container.appendChild(div);
    });
}
function renderOngoingMatches(matches) {
    const container = document.getElementById('active-courts-container');
    container.innerHTML = '';
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">No active courts.</div>';
        return;
    }
    matches.forEach(match => {
        const div = document.createElement('div');
        div.className = 'history-item-v2 ongoing';
        div.dataset.matchId = match.id;
        div.dataset.courtId = match.court_id;
        const teamAPlayers = match.team_A.map(p => p.name.split(' ').pop()).join(' & ');
        const teamBPlayers = match.team_B.map(p => p.name.split(' ').pop()).join(' & ');
        div.innerHTML = `
            <div class="history-item-v2__header">
                <strong>Court ${match.court_name}</strong>
                <div class="remote-controls">
                    <button class="button-control reset-btn" data-action="reset">Reset</button>
                </div>
            </div>
            <div class="history-item-v2__body">
                <span class="team-name">${teamAPlayers}</span>
                <div class="score-display-control-area">
                    <button class="button-control score-btn dec-btn" data-action="dec_a">-</button>
                    <span class="score-box realtime-score" id="score-a-${match.court_id}">0</span>
                    <button class="button-control score-btn inc-btn" data-action="inc_a">+</button>
                    <button class="button-control swap-btn" data-action="swap" title="Swap scores">🔁</button>
                    <button class="button-control score-btn dec-btn" data-action="dec_b">-</button>
                    <span class="score-box realtime-score" id="score-b-${match.court_id}">0</span>
                    <button class="button-control score-btn inc-btn" data-action="inc_b">+</button>
                </div>
                <span class="team-name">${teamBPlayers}</span>
            </div>
            <div class="history-item-v2__footer">
                 <button class="button button--primary finish-match-btn" data-match-id="${match.id}">Finish & Save</button>
            </div>
        `;
        container.appendChild(div);
    });
}
function renderDashboardHistory(matches) {
    const container = document.getElementById('match-history-container');
    container.innerHTML = '';
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">No match history yet.</div>';
        return;
    }
    const recentMatches = matches.slice(0, 10);
    recentMatches.forEach(match => {
        const div = document.createElement('div');
        div.className = 'history-item-v2';
        const teamAPlayers = match.team_A.map(p => p.name.split(' ').pop()).join(' & ');
        const teamBPlayers = match.team_B.map(p => p.name.split(' ').pop()).join(' & ');
        div.innerHTML = `
            <div class="history-item-v2__header">
                <strong>Court ${match.court_name}</strong>
                <span class="winner-tag winner-${match.winning_team}">
                    Team ${match.winning_team} wins
                </span>
            </div>
            <div class="history-item-v2__body">
                <span class="team-name ${match.winning_team === 'A' ? 'team-winner' : ''}">${teamAPlayers}</span>
                <span class="score-box">${match.score_A} - ${match.score_B}</span>
                <span class="team-name ${match.winning_team === 'B' ? 'team-winner' : ''}">${teamBPlayers}</span>
            </div>`;
        container.appendChild(div);
    });
}
function renderAttendanceModal() {
    const container = document.getElementById('attendance-list-container');
    container.innerHTML = '';
    allPlayers.sort((a, b) => a.name.localeCompare(b.name)).forEach(player => {
        const div = document.createElement('div');
        div.className = 'attendance-item';
        div.innerHTML = `
            <input type="checkbox" id="player-${player.id}" data-player-id="${player.id}" ${player.is_active ? 'checked' : ''}>
            <label for="player-${player.id}">${player.name}</label>`;
        container.appendChild(div);
    });
}

function renderScoreboardManager(allBoards, allCourts) {
    const content = document.getElementById('scoreboard-manager-content');
    let html = '<h4>Gán bảng điểm cho các sân:</h4>';

    // Ensure we are working with arrays
    const boards = Array.isArray(allBoards) ? allBoards : [];
    const courts = Array.isArray(allCourts) ? allCourts : [];

    const availableBoards = boards.filter(b => b.court_id === null);

    if (courts.length === 0) {
        html += '<p>Chưa có sân nào được tạo.</p>';
    } else {
        courts.forEach(court => {
            // Defensive check to make sure court and court.name are valid
            if (!court || typeof court.name === 'undefined') {
                console.error("Invalid court data detected:", court);
                return; // Skip this invalid item
            }

            const assignedBoard = boards.find(b => b.court_id === court.id);
            
            html += `<div class="assignment-row"><strong>Sân ${court.name}:</strong>`;
            
            let options = '<option value="none">-- Bỏ gán --</option>';
            if (assignedBoard) {
                options += `<option value="${assignedBoard.device_id}" selected>${assignedBoard.device_id}</option>`;
            }
            availableBoards.forEach(board => {
                options += `<option value="${board.device_id}">${board.device_id}</option>`;
            });

            html += `<select class="scoreboard-assign-select" data-court-id="${court.id}">${options}</select>`;
            html += `</div>`;
        });
    }

    content.innerHTML = html;
}

async function refreshDashboard() {
    const [players, ongoing, history, queued, boards] = await Promise.all([
        apiCall('/api/players'),
        apiCall('/api/matches/ongoing'),
        apiCall('/api/matches/history'),
        apiCall('/api/matches/queued'),
        apiCall('/api/scoreboards')
    ]);
    scoreboardStates = {};
    (boards || []).forEach(board => {
        if(board.court_id) {
            scoreboardStates[board.court_id] = {
                is_swapped: board.is_swapped,
                score_A: board.score_A,
                score_B: board.score_B
            };
        }
    });
    allPlayers = players || [];
    renderActivePlayers();
    renderOngoingMatches(ongoing);
    renderDashboardHistory(history);
    renderQueuedMatches(queued);
    Object.keys(scoreboardStates).forEach(courtId => {
        const state = scoreboardStates[courtId];
        updateScoreDisplay(courtId, state.score_A, state.score_B);
    });
}
async function handleRemoteControl(e) {
    const button = e.target.closest('.button-control');
    if (!button) return;
    const ongoingMatchCard = button.closest('.ongoing');
    if (!ongoingMatchCard) return;

    const courtId = parseInt(ongoingMatchCard.dataset.courtId, 10);
    let action = button.dataset.action;

    if (action === 'swap') {
        await apiCall('/api/scoreboards/toggle-swap', 'POST', { court_id: courtId });
        return;
    }

    const isSwapped = scoreboardStates[courtId]?.is_swapped || false;
    if (isSwapped) {
        if (action === 'inc_a') action = 'inc_b';
        else if (action === 'dec_a') action = 'dec_b';
        else if (action === 'inc_b') action = 'inc_a';
        else if (action === 'dec_b') action = 'dec_a';
    }
    if (courtId && action) {
        button.disabled = true;
        await apiCall('/api/scoreboards/control', 'POST', { court_id: courtId, action: action });
        button.disabled = false;
    }
}
async function handleAssignScoreboard(e) {
    if (e.target.tagName !== 'SELECT' || !e.target.classList.contains('scoreboard-assign-select')) return;
    const courtId = parseInt(e.target.dataset.courtId, 10);
    const deviceId = e.target.value;
    let result;
    if (deviceId === "none") {
        result = await apiCall('/api/scoreboards/unassign', 'POST', { court_id: courtId });
    } else {
        result = await apiCall('/api/scoreboards/assign', 'POST', { device_id: deviceId, court_id: courtId });
    }
    if (result) {
        alert(result.message);
        openScoreboardManager();
    }
}
async function openScoreboardManager() {
    const [scoreboards, courts] = await Promise.all([
        apiCall('/api/scoreboards'),
        apiCall('/api/courts')
    ]);
    renderScoreboardManager(scoreboards, courts);
    document.getElementById('scoreboard-manager-modal').style.display = 'block';
}
async function handleAssignAndBeginClick(event) {
    if (!event.target.classList.contains('assign-and-begin-btn')) return;
    const matchId = event.target.dataset.matchId;
    if (matchId) {
        await openAssignCourtModal(matchId);
    }
}
async function handleConfirmAssignAndBegin() {
    const modal = document.getElementById('assign-court-modal');
    const matchId = document.getElementById('assign-match-id-input').value;
    const courtId = document.getElementById('assign-court-select').value;
    const error = document.getElementById('assign-court-error');

    if (!courtId) {
        error.style.display = 'block';
        return;
    }
    error.style.display = 'none';

    const result = await apiCall(`/api/matches/${matchId}/begin`, 'POST', { court_id: parseInt(courtId) });

    if (result) {
        alert(result.message);
        modal.style.display = 'none';
        await refreshDashboard();
    }
}

async function openAssignCourtModal(matchId) {
    const modal = document.getElementById('assign-court-modal');
    const select = document.getElementById('assign-court-select');
    const error = document.getElementById('assign-court-error');
    select.innerHTML = '';
    error.style.display = 'none';

    // Fetch courts and ongoing matches to determine which courts are available
    const [courts, ongoingMatches] = await Promise.all([
        apiCall('/api/courts'),
        apiCall('/api/matches/ongoing')
    ]);

    const busyCourtIds = new Set((ongoingMatches || []).map(m => m.court_id));
    const availableCourts = (courts || []).filter(c => !busyCourtIds.has(c.id));

    if (availableCourts.length === 0) {
        select.innerHTML = '<option value="">Không có sân trống</option>';
    } else {
        availableCourts.forEach(court => {
            const option = document.createElement('option');
            option.value = court.id;
            option.textContent = court.name;
            select.appendChild(option);
        });
    }

    document.getElementById('assign-match-id-input').value = matchId;
    modal.style.display = 'block';
}

async function finishMatch(matchId, scoreA, scoreB) {
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA === scoreB) {
        document.getElementById('finish-modal-error').style.display = 'block';
        return;
    }
    document.getElementById('finish-modal-error').style.display = 'none';
    const result = await apiCall(`/api/matches/${matchId}/finish`, 'POST', {
        score_A: scoreA,
        score_B: scoreB,
    });
    if (result) {
        alert(result.message);
        const modal = document.getElementById('finish-match-modal');
        modal.style.display = 'none';
        document.getElementById('finish-match-form').reset();
        await refreshDashboard();
    }
}
async function handleFinishMatchClick(event) {
    if (!event.target.classList.contains('finish-match-btn')) return;
    const matchCard = event.target.closest('.ongoing');
    const matchId = matchCard.dataset.matchId;
    const courtId = matchCard.dataset.courtId;
    const scoreAEl = document.getElementById(`score-a-${courtId}`);
    const scoreBEl = document.getElementById(`score-b-${courtId}`);
    const scoreA = parseInt(scoreAEl.textContent, 10);
    const scoreB = parseInt(scoreBEl.textContent, 10);
    if (!isNaN(scoreA) && !isNaN(scoreB) && scoreA !== scoreB) {
        if (confirm(`Finish match with score ${scoreA} - ${scoreB}?`)) {
            await finishMatch(matchId, scoreA, scoreB);
        }
    } else {
        const modal = document.getElementById('finish-match-modal');
        modal.querySelector('#finish-match-id-input').value = matchId;
        modal.querySelector('#score-a-input').value = scoreAEl.textContent;
        modal.querySelector('#score-b-input').value = scoreBEl.textContent;
        modal.style.display = 'block';
        document.getElementById('finish-modal-error').style.display = 'none';
        modal.querySelector('#score-a-input').focus();
    }
}
async function handleSaveMatchResultFromModal() {
    const modal = document.getElementById('finish-match-modal');
    const matchId = modal.querySelector('#finish-match-id-input').value;
    const scoreA = parseInt(document.getElementById('score-a-input').value, 10);
    const scoreB = parseInt(document.getElementById('score-b-input').value, 10);
    await finishMatch(matchId, scoreA, scoreB);
}
async function handleAttendanceSave() {
    const modal = document.getElementById('attendance-modal');
    const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
    const promises = [];
    checkboxes.forEach(box => {
        const playerId = box.dataset.playerId;
        const player = allPlayers.find(p => p.id == playerId);
        const isChecked = box.checked;
        if (player && !!player.is_active !== isChecked) {
            promises.push(apiCall(`/api/players/${playerId}`, 'PUT', { is_active: isChecked ? 1 : 0 }));
        }
    });
    if (promises.length > 0) {
        await Promise.all(promises);
        alert('Attendance updated successfully!');
    }
    modal.style.display = 'none';
    await refreshDashboard();
}
function updateScoreDisplay(courtId, scoreA, scoreB) {
    const isSwapped = scoreboardStates[courtId]?.is_swapped || false;
    const scoreAEl = document.getElementById(`score-a-${courtId}`);
    const scoreBEl = document.getElementById(`score-b-${courtId}`);

    if (scoreAEl && scoreBEl) {
        scoreAEl.textContent = isSwapped ? scoreB : scoreA;
        scoreBEl.textContent = isSwapped ? scoreA : scoreB;
    }
}
function connectWebSocket() {
    // This 'io()' function is now available globally 
    // because we loaded 'socket.io.min.js' in layout.html
    socket = io(); 
    
    socket.on('connect', () => console.log('Connected to server via WebSocket!'));
    
    socket.on('score_updated', (data) => {
        // This event is fired by 'web_server.py' 
        // after it receives a message from Redis.
        console.log('Score update received:', data);
        if (scoreboardStates[data.court_id]) {
            scoreboardStates[data.court_id].score_A = data.score_A;
            scoreboardStates[data.court_id].score_B = data.score_B;
        }
        updateScoreDisplay(data.court_id, data.score_A, data.score_B);
    });
    
    socket.on('board_state_updated', (data) => {
        // This event is fired by the API (e.g., /api/scoreboards/toggle-swap)
        console.log('Board state update received:', data);
        if (scoreboardStates[data.court_id]) {
            scoreboardStates[data.court_id].is_swapped = data.is_swapped;
            updateScoreDisplay(data.court_id, scoreboardStates[data.court_id].score_A, scoreboardStates[data.court_id].score_B);
        }
    });
}
export default function init() {
    checkSessionStatus();
    refreshDashboard();
    connectWebSocket(); // This function is now valid again
    
    // Bind all event listeners
    document.getElementById('manage-courts-btn').addEventListener('click', () => { window.location.href = '/manage-courts'; });
    document.getElementById('suggest-btn').addEventListener('click', () => { window.location.href = '/create'; });
    document.getElementById('export-history-btn').addEventListener('click', () => { window.location.href = '/history'; });
    document.getElementById('manage-scoreboards-btn').addEventListener('click', openScoreboardManager);
    
    // Attendance Modal
    const attendanceModal = document.getElementById('attendance-modal');
    document.getElementById('attendance-btn').addEventListener('click', async () => {
        if (allPlayers.length === 0) {
            allPlayers = await apiCall('/api/players') || [];
        }
        renderAttendanceModal();
        attendanceModal.style.display = 'block';
    });
    document.getElementById('close-attendance-modal').addEventListener('click', () => attendanceModal.style.display = 'none');
    document.getElementById('save-attendance-btn').addEventListener('click', handleAttendanceSave);
    
    // Finish Match Modal
    const finishModal = document.getElementById('finish-match-modal');
    document.getElementById('close-finish-modal').addEventListener('click', () => finishModal.style.display = 'none');
    document.getElementById('save-match-result-btn').addEventListener('click', handleSaveMatchResultFromModal);
    
    // Scoreboard Manager Modal
    const scoreboardModal = document.getElementById('scoreboard-manager-modal');
    document.getElementById('close-scoreboard-modal').addEventListener('click', () => scoreboardModal.style.display = 'none');
    
    // Assign Court Modal
    const assignModal = document.getElementById('assign-court-modal');
    if(assignModal) {
        document.getElementById('close-assign-modal').addEventListener('click', () => assignModal.style.display = 'none');
        document.getElementById('confirm-assign-btn').addEventListener('click', handleConfirmAssignAndBegin);
    }
    
    // Close modals on outside click
    window.addEventListener('click', (event) => {
        if (event.target == attendanceModal) attendanceModal.style.display = 'none';
        if (event.target == finishModal) finishModal.style.display = 'none';
        if (event.target == scoreboardModal) scoreboardModal.style.display = 'none';
        if (assignModal && event.target == assignModal) assignModal.style.display = 'none';
    });
    
    // Event delegation for dynamically created buttons
    const activeCourtsContainer = document.getElementById('active-courts-container');
    activeCourtsContainer.addEventListener('click', handleRemoteControl);
    activeCourtsContainer.addEventListener('click', handleFinishMatchClick);
    document.getElementById('queue-container').addEventListener('click', handleAssignAndBeginClick);
    scoreboardModal.addEventListener('change', handleAssignScoreboard);
}
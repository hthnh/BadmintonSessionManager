// static/modules/dashboard-manager.js (Refactored with Toast and Confirm Modal)

import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';
import { on as onWebSocketEvent } from './websocket-client.js';

let currentSession = null;
const courtTimers = {};
let allPlayers = [];
let scoreboardStates = {};


// Helper for API calls
async function apiCall(url, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, options);
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.error || `Server error: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error(`API call error to ${url}:`, error);
        // Replace alert with error toast
        showToast(error.message, 'error');
        return null;
    }
}

// Web socket
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
    socket = io();
    socket.on('connect', () => console.log('Connected to server via WebSocket!'));
    socket.on('score_updated', (data) => {
        console.log('Score update received:', data);
        if (scoreboardStates[data.court_id]) {
            scoreboardStates[data.court_id].score_A = data.score_A;
            scoreboardStates[data.court_id].score_B = data.score_B;
        }
        updateScoreDisplay(data.court_id, data.score_A, data.score_B);
    });
    socket.on('board_state_updated', (data) => {
        console.log('Board state update received:', data);
        if (scoreboardStates[data.court_id]) {
            scoreboardStates[data.court_id].is_swapped = data.is_swapped;
            updateScoreDisplay(data.court_id, scoreboardStates[data.court_id].score_A, scoreboardStates[data.court_id].score_B);
        }
    });
}


// === TIMER LOGIC ===
function startTimer(matchId, startTimeString) {
    if (courtTimers[matchId]) {
        clearInterval(courtTimers[matchId]);
    }
    const timerElement = document.getElementById(`timer-${matchId}`);
    if (!timerElement) return;

    const formattedTime = startTimeString.replace(' ', 'T');
    const startTime = new Date(formattedTime);

    if (isNaN(startTime.getTime())) {
        timerElement.textContent = "Error";
        return;
    }

    courtTimers[matchId] = setInterval(() => {
        const diff = new Date() - startTime;
        const minutes = String(Math.floor(diff / 60000)).padStart(2, '0');
        const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopTimer(matchId) {
    if (courtTimers[matchId]) {
        clearInterval(courtTimers[matchId]);
        delete courtTimers[matchId];
    }
}

// === RENDERING LOGIC ===
function renderSessionStatus() {
    const statusSpan = document.getElementById('session-status-text');
    const actionButtonsDiv = document.getElementById('session-action-buttons');

    if (!statusSpan || !actionButtonsDiv) {
        console.error("Session status elements not found in DOM.");
        return;
    }

    // Luôn dọn dẹp nội dung cũ trước khi render mới
    actionButtonsDiv.innerHTML = '';

    if (currentSession && currentSession.status === 'active') {
        const startTime = new Date(currentSession.start_time).toLocaleTimeString('vi-VN');
        statusSpan.innerHTML = `Phiên đang diễn ra. Bắt đầu lúc: <strong>${startTime}</strong>`;

        // Bước 1: Tạo element nút bấm trong bộ nhớ
        const endButton = document.createElement('button');
        
        // Bước 2: Gán các thuộc tính cho nó
        endButton.id = 'end-session-btn';
        endButton.className = 'button button--danger'; // Áp dụng class CSS
        endButton.textContent = 'Kết thúc phiên';
        
        // Bước 3: Gắn sự kiện trực tiếp vào đối tượng element này
        endButton.addEventListener('click', handleEndSession);
        
        // Bước 4: Gắn element đã hoàn chỉnh vào cây DOM
        actionButtonsDiv.appendChild(endButton);

    } else {
        statusSpan.innerHTML = 'Chưa có phiên nào bắt đầu.';

        // Tương tự cho nút "Bắt đầu phiên"
        const startButton = document.createElement('button');
        startButton.id = 'start-session-btn';
        startButton.className = 'button button--primary';
        startButton.textContent = 'Bắt đầu phiên';
        startButton.addEventListener('click', handleStartSession);
        actionButtonsDiv.appendChild(startButton);
    }
}

function renderOngoingMatches(matches) {
    const container = document.getElementById('active-courts-container');
    if (!container) return; // Thêm dòng này để an toàn hơn

    container.innerHTML = '';
    if (!matches || matches.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Chưa có trận nào đang diễn ra.</p>';
        return;
    }

    matches.forEach(match => {
        stopTimer(match.id); // Clear existing timer before re-rendering
        const card = document.createElement('div');
        card.className = 'match-card ongoing';
        card.innerHTML = `
            <div class="match-card__header">
                <h4>Sân: ${match.court_name}</h4>
                <div class="match-card__timer" id="timer-${match.id}">00:00</div>
            </div>
            <div class="match-card__body">
                <div class="team">
                    <span class="team-name">Đội A</span>
                    <div class="player">${match.team_A[0].name}</div>
                    ${match.team_A[1] ? `<div class="player">${match.team_A[1].name}</div>` : ''}
                </div>
                <div class="vs">VS</div>
                <div class="team">
                    <span class="team-name">Đội B</span>
                    <div class="player">${match.team_B[0].name}</div>
                    ${match.team_B[1] ? `<div class="player">${match.team_B[1].name}</div>` : ''}
                </div>
            </div>
        `;
        container.appendChild(card);
        startTimer(match.id, match.start_time);
    });
}

function renderMatchQueue(queue) {
    const container = document.getElementById('queue-container');
    if (!container) return; // Thêm dòng này để an toàn hơn

    container.innerHTML = '';
    if (!queue || queue.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Hàng chờ trống.</p>';
        return;
    }

    queue.forEach((match, index) => {
        const card = document.createElement('div');
        card.className = 'match-card queued';
        card.innerHTML = `
             <div class="match-card__header">
                <h4>Ưu tiên: #${index + 1}</h4>
                <div class="match-card__actions">
                     <button class="button button--danger button--small delete-queue-btn" data-queue-id="${match.id}">Xóa</button>
                </div>
            </div>
            <div class="match-card__body">
                <div class="team">
                    <span class="team-name">Đội A</span>
                    <div class="player">${match.team_A[0].name}</div>
                    ${match.team_A[1] ? `<div class="player">${match.team_A[1].name}</div>` : ''}
                </div>
                <div class="vs">VS</div>
                 <div class="team">
                    <span class="team-name">Đội B</span>
                    <div class="player">${match.team_B[0].name}</div>
                    ${match.team_B[1] ? `<div class="player">${match.team_B[1].name}</div>` : ''}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderAvailablePlayers(players) {
    const container = document.getElementById('active-players-container');
    if (!container) return; // Thêm dòng này để an toàn hơn

    container.innerHTML = '';
    if (!players || players.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Không có người chơi nào sẵn sàng.</p>';
        return;
    }
    const list = document.createElement('ul');
    list.className = 'player-list';
    players.forEach(player => {
        const item = document.createElement('li');
        item.textContent = `${player.name} (Level ${player.skill_level}) : ${player.session_matches_played}`;
        list.appendChild(item);
    });
    container.appendChild(list);
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

// === EVENT HANDLERS ===
async function handleStartSession() {
    const result = await apiCall('/api/sessions/start', 'POST');
    if (result) {
        // Replace alert with success toast
        showToast(result.message, 'success');
        fetchAllData(); // Re-fetch all data to update UI
    }
}

async function handleEndSession() {
    // Replace confirm with showConfirm modal
    showConfirm('Bạn có chắc muốn kết thúc phiên hiện tại? Hành động này sẽ xóa hàng chờ và các trận đang diễn ra.', async () => {
        const result = await apiCall('/api/sessions/end', 'POST');
        if (result) {
            // Replace alert with success toast
            showToast(result.message, 'success');
            // Stop all timers
            Object.keys(courtTimers).forEach(stopTimer);
            fetchAllData();
        }
    });
}

async function handleDeleteQueueItem(e) {
    if (e.target.classList.contains('delete-queue-btn')) {
        const queueId = e.target.dataset.queueId;
        // Replace confirm with showConfirm modal
        showConfirm('Bạn có chắc muốn xóa trận đấu này khỏi hàng chờ?', async () => {
            const result = await apiCall(`/api/matches/queue/${queueId}`, 'DELETE');
            if (result) {
                // Replace alert with success toast
                showToast(result.message, 'success');
                fetchAllData();
            }
        });
    }
}


function handleOpenAttendanceModal() { console.log("Mở modal điểm danh..."); /* Logic sẽ được thêm sau */ }

function handleOpenSuggestModal() { console.log("Mở modal gợi ý..."); /* Logic sẽ được thêm sau */ }


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

function handleScoreUpdate(payload) {
    console.log("Received score update:", payload);
    // Cập nhật điểm số trên giao diện mà không cần tải lại toàn bộ
    const scoreAElement = document.querySelector(`#court-${payload.court_id} .score-a`);
    const scoreBElement = document.querySelector(`#court-${payload.court_id} .score-b`);
    if(scoreAElement && scoreBElement) {
        scoreAElement.textContent = payload.score_A;
        scoreBElement.textContent = payload.score_B;
        showToast(`Sân ${payload.court_id} cập nhật điểm!`, 'info');
    }
}


function handleNewMatchStarted(payload) {
    showToast('Một trận đấu mới vừa bắt đầu!', 'success');
    // Tải lại danh sách các trận đang diễn ra và hàng chờ để cập nhật
    Promise.all([
        apiCall('/api/matches/ongoing'),
        apiCall('/api/matches/queue'),
        apiCall('/api/players/available')
    ]).then(([matches, queue, players]) => {
        renderOngoingMatches(matches || []);
        renderMatchQueue(queue || []);
        renderAvailablePlayers(players || []);
    });
}

function handleMatchFinished(payload) {
    showToast(`Trận đấu tại sân ${payload.court_name} đã kết thúc!`, 'info');
     // Tải lại toàn bộ dữ liệu để đảm bảo tính nhất quán
    fetchInitialData();
}

async function handleAssignAndBeginClick(event) {
    if (!event.target.classList.contains('assign-and-begin-btn')) return;
    const matchId = event.target.dataset.matchId;
    if (matchId) {
        await openAssignCourtModal(matchId);
    }
}

async function handleSaveMatchResultFromModal() {
    const modal = document.getElementById('finish-match-modal');
    const matchId = modal.querySelector('#finish-match-id-input').value;
    const scoreA = parseInt(document.getElementById('score-a-input').value, 10);
    const scoreB = parseInt(document.getElementById('score-b-input').value, 10);
    await finishMatch(matchId, scoreA, scoreB);
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


// === DATA FETCHING ===
async function fetchInitialData() {
    console.log("Fetching initial data...");
    const [session, matches, queue, players, history, boards] = await Promise.all([
        apiCall('/api/sessions/current'),
        apiCall('/api/matches/ongoing'),
        apiCall('/api/matches/queued'),
        apiCall('/api/players/available'),
        apiCall('/api/matches/history'),
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

    currentSession = session;
    renderSessionStatus();
    renderOngoingMatches(matches || []);
    renderMatchQueue(queue || []);
    renderAvailablePlayers(players || []);
    renderDashboardHistory(history)
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


// === [MỚI] HÀM XỬ LÝ CÁC SỰ KIỆN REAL-TIME TỪ WEBSOCKET ===

async function openScoreboardManager() {
    const [scoreboards, courts] = await Promise.all([
        apiCall('/api/scoreboards'),
        apiCall('/api/courts')
    ]);
    renderScoreboardManager(scoreboards, courts);
    document.getElementById('scoreboard-manager-modal').style.display = 'block';
}

// === INITIALIZATION ===
export default function init() {
    document.getElementById('start-session-btn')?.addEventListener('click', handleStartSession);
    document.getElementById('end-session-btn')?.addEventListener('click', handleEndSession);
    document.getElementById('match-queue-container')?.addEventListener('click', handleDeleteQueueItem);
    document.getElementById('suggest-btn').addEventListener('click', () => { window.location.href = '/create'; });
    document.getElementById('export-history-btn').addEventListener('click', () => { window.location.href = '/history'; });
    document.getElementById('attendance-btn').addEventListener('click', async () => {
        if (allPlayers.length === 0) {
            allPlayers = await apiCall('/api/players') || [];
        }
        renderAttendanceModal();
        attendanceModal.style.display = 'block';
    });
    document.getElementById('manage-courts-btn').addEventListener('click', () => { window.location.href = '/manage-courts'; });
    document.getElementById('suggest-btn').addEventListener('click', () => { window.location.href = '/create'; });
    document.getElementById('export-history-btn').addEventListener('click', () => { window.location.href = '/history'; });
    document.getElementById('manage-scoreboards-btn').addEventListener('click', openScoreboardManager);
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
    const finishModal = document.getElementById('finish-match-modal');
    document.getElementById('close-finish-modal').addEventListener('click', () => finishModal.style.display = 'none');
    document.getElementById('save-match-result-btn').addEventListener('click', handleSaveMatchResultFromModal);
    const scoreboardModal = document.getElementById('scoreboard-manager-modal');
    document.getElementById('close-scoreboard-modal').addEventListener('click', () => scoreboardModal.style.display = 'none');
    const assignModal = document.getElementById('assign-court-modal');
    if(assignModal) {
        document.getElementById('close-assign-modal').addEventListener('click', () => assignModal.style.display = 'none');
        document.getElementById('confirm-assign-btn').addEventListener('click', handleConfirmAssignAndBegin);
    }

    window.addEventListener('click', (event) => {
        if (event.target == attendanceModal) attendanceModal.style.display = 'none';
        if (event.target == finishModal) finishModal.style.display = 'none';
        if (event.target == scoreboardModal) scoreboardModal.style.display = 'none';
        if (assignModal && event.target == assignModal) assignModal.style.display = 'none';
    });
    const activeCourtsContainer = document.getElementById('active-courts-container');
    activeCourtsContainer.addEventListener('click', handleRemoteControl);
    activeCourtsContainer.addEventListener('click', handleFinishMatchClick);
    document.getElementById('queue-container').addEventListener('click', handleAssignAndBeginClick);
    scoreboardModal.addEventListener('change', handleAssignScoreboard);

    fetchInitialData(); 

    onWebSocketEvent('score_updated', handleScoreUpdate);
    onWebSocketEvent('match_started', handleNewMatchStarted);
    onWebSocketEvent('match_finished', handleMatchFinished); // <-- Backend cần broadcast sự kiện này

}
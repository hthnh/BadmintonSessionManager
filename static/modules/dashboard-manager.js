// static/modules/dashboard-manager.js (Refactored with Toast and Confirm Modal)

import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';
import { on as onWebSocketEvent } from './websocket-client.js';

let currentSession = null;
const courtTimers = {};

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
    const statusDiv = document.getElementById('session-status');
    const startBtn = document.getElementById('start-session-btn');
    const endBtn = document.getElementById('end-session-btn');

    if (currentSession && currentSession.is_active) {
        const startTime = new Date(currentSession.start_time).toLocaleTimeString('vi-VN');
        statusDiv.innerHTML = `Phiên đang diễn ra. Bắt đầu lúc: <strong>${startTime}</strong>`;
        startBtn.style.display = 'none';
        endBtn.style.display = 'inline-block';
    } else {
        statusDiv.innerHTML = 'Chưa có phiên nào bắt đầu.';
        startBtn.style.display = 'inline-block';
        endBtn.style.display = 'none';
    }
}

function renderOngoingMatches(matches) {
    const container = document.getElementById('ongoing-matches-container');
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
    const container = document.getElementById('match-queue-container');
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
    const container = document.getElementById('available-players-container');
    container.innerHTML = '';
    if (!players || players.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Không có người chơi nào sẵn sàng.</p>';
        return;
    }
    const list = document.createElement('ul');
    list.className = 'player-list';
    players.forEach(player => {
        const item = document.createElement('li');
        item.textContent = `${player.name} (Level ${player.skill_level})`;
        list.appendChild(item);
    });
    container.appendChild(list);
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


// === DATA FETCHING ===
async function fetchInitialData() {
    console.log("Fetching initial data...");
    const [session, matches, queue, players] = await Promise.all([
        apiCall('/api/sessions/current'),
        apiCall('/api/matches/ongoing'),
        apiCall('/api/matches/queued'), // Đã có API này
        apiCall('/api/players/available')
    ]);

    currentSession = session;
    renderSessionStatus();
    renderOngoingMatches(matches || []);
    renderMatchQueue(queue || []);
    renderAvailablePlayers(players || []);
}


// === [MỚI] HÀM XỬ LÝ CÁC SỰ KIỆN REAL-TIME TỪ WEBSOCKET ===
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



// === INITIALIZATION ===
export default function init() {
    document.getElementById('start-session-btn')?.addEventListener('click', handleStartSession);
    document.getElementById('end-session-btn')?.addEventListener('click', handleEndSession);
    document.getElementById('match-queue-container')?.addEventListener('click', handleDeleteQueueItem);

    fetchInitialData(); 

    onWebSocketEvent('score_updated', handleScoreUpdate);
    onWebSocketEvent('match_started', handleNewMatchStarted);
    onWebSocketEvent('match_finished', handleMatchFinished); // <-- Backend cần broadcast sự kiện này

}
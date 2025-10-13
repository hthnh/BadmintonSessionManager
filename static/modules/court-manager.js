// static/modules/court-manager.js (Refactored with Toast and Confirm Modal)

import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';

const courtTimers = {};

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

function renderCourtList(courts, ongoingMatches) {
    const container = document.getElementById('courts-list-container');
    container.innerHTML = '';
    if (!courts || courts.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có sân nào.</div>';
        return;
    }

    courts.forEach(court => {
        const matchOnThisCourt = ongoingMatches.find(m => m.court_id === court.id);
        const courtCard = document.createElement('div');
        courtCard.className = 'court-card';
        courtCard.dataset.courtId = court.id;

        if (matchOnThisCourt) {
            courtCard.classList.add('status-ongoing');
            courtCard.innerHTML = createOngoingCourtCard(court, matchOnThisCourt);
            container.appendChild(courtCard);
            startTimer(matchOnThisCourt.id, matchOnThisCourt.start_time);

        } else {
            courtCard.classList.add('status-available');
            courtCard.innerHTML = createAvailableCourtCard(court);
            container.appendChild(courtCard);
        }
    });
}

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

async function fetchAndRenderData() {
    const [courts, ongoingMatches] = await Promise.all([
        apiCall('/api/courts'),
        apiCall('/api/matches/ongoing')
    ]);
    if (courts) {
        renderCourtList(courts, ongoingMatches || []);
    }
}

function createAvailableCourtCard(court) {
    return `
        <div class="court-card__header">
            <h3>${court.name}</h3>
            <div class="court-card__actions">
                <button class="button button--danger delete-court-btn">Xóa</button>
            </div>
        </div>
        <div class="court-card__body" style="background-image: none;">
            <div class="court-card__overlay">
                <div class="court-status">Sẵn sàng</div>
                <button class="button button--primary assign-match-btn">Tạo trận mới</button>
            </div>
        </div>
        <div class="court-card__footer">
            <span>Trạng thái: Trống</span>
            <span style="font-weight: 700;">Lượt trong phiên: ${court.session_turns}</span>
        </div>`;
}
function createOngoingCourtCard(court, match) {
    stopTimer(match.id);
    return `
        <div class="court-card__header">
            <h3>${court.name}</h3>
            <span class="card-header-badge">Lượt trong phiên: ${court.session_turns}</span>
        </div>
        <div class="court-card__body">
            <div class="player-slot">${match.team_A[0].name}</div><div class="player-slot">${match.team_B[0].name}</div>
            <div class="player-slot">${match.team_A[1].name}</div><div class="player-slot">${match.team_B[1].name}</div>
        </div>
        <div class="court-card__footer">
            <div class="court-timer" id="timer-${match.id}">00:00</div>
            <div class="court-actions">
                <button class="button button--primary finish-match-btn" data-match-id="${match.id}">Kết thúc</button>
            </div>
        </div>`;
}
async function handleContainerClick(e) {
    const target = e.target;
    const courtCard = target.closest('.court-card');
    if (!courtCard) return;
    const courtId = courtCard.dataset.courtId;

    if (target.classList.contains('delete-court-btn')) {
        const courtName = courtCard.querySelector('h3').textContent;
        // Replace confirm with showConfirm modal
        showConfirm(`Bạn có chắc muốn xóa vĩnh viễn sân "${courtName}"?`, async () => {
            const result = await apiCall(`/api/courts/${courtId}`, 'DELETE');
            if (result) {
                showToast(result.message, 'success');
                fetchAndRenderData();
            }
        });
    } else if (target.classList.contains('assign-match-btn')) {
        window.location.href = '/create';
    } else if (target.classList.contains('finish-match-btn')) {
        const matchId = target.dataset.matchId;
        const modal = document.getElementById('finish-match-modal');
        modal.querySelector('#finish-match-id-input').value = matchId;
        modal.style.display = 'block';
        document.getElementById('score-a-input').focus();
    }
}

async function handleSaveNewCourt() {
    const nameInput = document.getElementById('court-name-input');
    const courtName = nameInput.value.trim();
    if (!courtName) {
        showToast('Vui lòng nhập tên sân.', 'error');
        return;
    }
    const result = await apiCall('/api/courts', 'POST', { name: courtName });
    if (result) {
        showToast(result.message || 'Thêm sân thành công!', 'success');
        nameInput.value = '';
        document.getElementById('add-court-modal').style.display = 'none';
        fetchAndRenderData();
    }
}

async function handleSaveMatchResult() {
    const modal = document.getElementById('finish-match-modal');
    const matchId = modal.querySelector('#finish-match-id-input').value;
    const scoreA = parseInt(document.getElementById('score-a-input').value);
    const scoreB = parseInt(document.getElementById('score-b-input').value);
    const errorP = document.getElementById('finish-modal-error');

    if (isNaN(scoreA) || isNaN(scoreB) || scoreA === scoreB) {
        errorP.style.display = 'block';
        return;
    }
    errorP.style.display = 'none';

    const result = await apiCall(`/api/matches/${matchId}/finish`, 'POST', {
        score_A: scoreA,
        score_B: scoreB
    });

    if (result) {
        showToast(result.message, 'success');
        modal.style.display = 'none';
        document.getElementById('finish-match-form').reset();
        stopTimer(matchId);
        fetchAndRenderData();
    }
}

export default function init() {
    fetchAndRenderData();
    document.getElementById('courts-list-container').addEventListener('click', handleContainerClick);

    const addCourtModal = document.getElementById('add-court-modal');
    if (addCourtModal) {
        document.getElementById('show-add-court-modal-btn').addEventListener('click', () => { addCourtModal.style.display = 'block'; document.getElementById('court-name-input').focus(); });
        document.getElementById('close-add-court-modal').addEventListener('click', () => addCourtModal.style.display = 'none');
        document.getElementById('save-court-btn').addEventListener('click', handleSaveNewCourt);
        document.getElementById('add-court-form').addEventListener('submit', (e) => { e.preventDefault(); handleSaveNewCourt(); });
    }

    const finishModal = document.getElementById('finish-match-modal');
    if (finishModal) {
        document.getElementById('close-finish-modal').addEventListener('click', () => finishModal.style.display = 'none');
        document.getElementById('save-match-result-btn').addEventListener('click', handleSaveMatchResult);
    }

    window.addEventListener('click', (event) => {
        if (event.target == addCourtModal) addCourtModal.style.display = 'none';
        if (event.target == finishModal) finishModal.style.display = 'none';
    });
}
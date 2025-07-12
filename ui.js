// ui.js
import { getState } from './state.js';

// Lấy các DOM element một lần duy nhất (đã sửa lỗi trùng lặp)
const DOMElements = {
    playerListBody: document.getElementById('player-list-body'),
    currentMatchCourtsContainer: document.getElementById('current-match-courts'),
    suggestionOutputContainer: document.getElementById('suggestion-output'),
    attendanceListContainer: document.getElementById('attendance-list'),
    historyTableBody: document.getElementById('history-table-body'),
    confirmMatchBtn: document.getElementById('confirm-match-btn'),
    clockElement: document.getElementById('clock'),
};

function renderAttendanceList() {
    const { players } = getState();
    DOMElements.attendanceListContainer.innerHTML = '';
    [...players].sort((a, b) => a.name.localeCompare(b.name)).forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'attendance-player';
        const isPresent = player.status !== 'inactive';
        playerDiv.innerHTML = `
            <input type="checkbox" id="check-${player.id}" data-player-id="${player.id}" ${isPresent ? 'checked' : ''}>
            <label for="check-${player.id}">${player.name} (L${player.level})</label>
        `;
        DOMElements.attendanceListContainer.appendChild(playerDiv);
    });
}

function renderPlayerList() {
    const { players } = getState();
    DOMElements.playerListBody.innerHTML = '';
    const now = Date.now();
    const presentPlayers = players.filter(p => p.status === 'active' || p.status === 'resting');

    presentPlayers.forEach(player => {
        const row = document.createElement('tr');
        row.dataset.id = player.id;
        row.className = 'player-row';
        let restTimeText = 'N/A';
        if (player.lastMatchEndTime) {
            const restMinutes = Math.floor((now - player.lastMatchEndTime) / 60000);
            restTimeText = `${restMinutes} phút`;
        } else if (player.gamesPlayed === 0) {
            restTimeText = 'Chưa chơi';
        }
        let statusIcon, statusText;
        if (player.status === 'active') { [statusIcon, statusText] = ['status-active', 'Có mặt']; }
        else if (player.status === 'resting') { [statusIcon, statusText] = ['status-resting', 'Nghỉ lượt']; }
        else if (player.status === 'playing') { [statusIcon, statusText] = ['status-playing', 'Đang chơi']; }

        row.innerHTML = `
            <td>${player.name}</td>
            <td class="level-cell"><div class="editable-cell" contenteditable="true" data-player-id="${player.id}" data-field="level">${player.level}</div></td>
            <td class="clickable" data-action="toggle-status"><span class="status-icon ${statusIcon}"></span>${statusText}</td>
            <td>${player.gamesPlayed}</td>
            <td>${restTimeText}</td>
            <td class="clickable" data-action="toggle-type">${player.type}</td>
            <td><button class="delete-player-btn" data-action="delete-player">🗑️</button></td>
        `;
        DOMElements.playerListBody.appendChild(row);
    });
}

function renderCurrentCourts() {
    const { courts } = getState();
    DOMElements.currentMatchCourtsContainer.innerHTML = '';
    courts.forEach(court => {
        const courtDiv = document.createElement('div');
        courtDiv.className = 'court';
        courtDiv.dataset.courtId = court.id;
        let teamsHTML;
        if (court.players.length === 0) {
            teamsHTML = `<div class="teams"><div class="team-drop-zone" data-court-id="${court.id}">-- Kéo người chơi vào đây --</div></div>`;
        } else {
            const teamA = court.players.slice(0, 2);
            const teamB = court.players.slice(2, 4);
            teamsHTML = `
                <div class="teams">
                    <div class="team team-drop-zone has-players" data-court-id="${court.id}" data-team="A">${teamA.map(p => `<div class="player-in-court" data-id="${p.id}">${p.name} (L${p.level})</div>`).join('')}</div>
                    <div class="vs-divider">VS</div>
                    <div class="team team-drop-zone has-players" data-court-id="${court.id}" data-team="B">${teamB.map(p => `<div class="player-in-court" data-id="${p.id}">${p.name} (L${p.level})</div>`).join('')}</div>
                </div>
            `;
        }
        courtDiv.innerHTML = `<h3>Sân ${court.id}</h3> <button class="delete-court-btn" data-court-id="${court.id}">X</button> <div class="timer" id="court-timer-${court.id}">00:00</div> ${teamsHTML} <button class="finish-match-btn" data-court-id="${court.id}" ${court.players.length === 0 ? 'disabled' : ''}>Kết thúc trận</button>`;
        DOMElements.currentMatchCourtsContainer.appendChild(courtDiv);
        if (court.startTime) startTimerForCourt(court);
    });
}

function renderSuggestions() {
    const { currentSuggestions, courts } = getState();
    DOMElements.suggestionOutputContainer.innerHTML = '';
    for (const courtId in currentSuggestions) {
        const players = currentSuggestions[courtId];
        const court = courts.find(c => c.id == courtId);
        if (!court) continue;
        const teamA = players.slice(0, 2);
        const teamB = players.slice(2, 4);
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'court';
        suggestionDiv.innerHTML = `<h3>Gợi ý cho Sân ${court.id}</h3> <div class="teams"><div class="team">${teamA.map(p => `<div>${p.name} (L${p.level})</div>`).join('')}</div><div class="vs-divider">VS</div><div class="team">${teamB.map(p => `<div>${p.name} (L${p.level})</div>`).join('')}</div></div>`;
        DOMElements.suggestionOutputContainer.appendChild(suggestionDiv);
    }
    DOMElements.confirmMatchBtn.disabled = Object.keys(currentSuggestions).length === 0;
}

export function addToHistory(court, endTime) {
    const { matchHistoryCounter } = getState();
    const newRow = document.createElement('tr');
    const startTimeStr = new Date(court.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = new Date(endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    newRow.innerHTML = `<td>${matchHistoryCounter}</td><td>${startTimeStr} - ${endTimeStr}</td><td>Sân ${court.id}</td><td>${court.players.map(p => `${p.name}(L${p.level})`).join(', ')}</td>`;
    DOMElements.historyTableBody.prepend(newRow);
}

export function startTimerForCourt(court) {
    const timerElement = document.getElementById(`court-timer-${court.id}`);
    if (court.timerInterval) clearInterval(court.timerInterval);
    court.timerInterval = setInterval(() => {
        if (court.startTime && timerElement) {
            const elapsed = Date.now() - court.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            clearInterval(court.timerInterval);
        }
    }, 1000);
}

export function updateClock() {
    if (DOMElements.clockElement) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        DOMElements.clockElement.textContent = now.toLocaleDateString('vi-VN', options);
    }
}

// Hàm này giờ sẽ nhận một tham số là hàm xử lý sự kiện
function initDragAndDrop(onDropHandler) {
    const playerListBody = document.getElementById('player-list-body');
    const courtDropZones = document.querySelectorAll('.team-drop-zone');

    new Sortable(playerListBody, {
        group: {
            name: 'players',
            pull: 'clone',
            put: false
        },
        animation: 150,
        sort: false
    });

    courtDropZones.forEach(zone => {
        new Sortable(zone, {
            group: 'players',
            animation: 150,
            onAdd: onDropHandler // Sử dụng hàm được truyền vào
        });
    });
}

// Hàm render tổng hợp
export function renderAll(onDropHandler) {
    renderAttendanceList();
    renderPlayerList();
    renderCurrentCourts();
    renderSuggestions();
    // Khởi tạo lại kéo thả sau mỗi lần render và truyền handler vào
    initDragAndDrop(onDropHandler);
}
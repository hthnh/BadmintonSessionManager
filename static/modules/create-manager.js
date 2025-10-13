// static/modules/create-manager.js (Refactored with Toast)

import { showToast } from './toast.js';

// === STATE MANAGEMENT ===
let availablePlayers = [];
let courtSlots = {
    teamA: [],
    teamB: []
};
let draggedPlayerId = null;

// === API CALLS ===
async function apiCall(url, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        if (response.status === 204) return { success: true };
        return response.json();
    } catch (error) {
        console.error(`API call error to ${url}:`, error);
        // Replace alert with error toast
        showToast(`An error occurred: ${error.message}`, 'error');
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
            if (!player) return '';
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

function updateUIStates() {
    document.getElementById('player-count').textContent = `Sẵn sàng: ${availablePlayers.length}`;
    const confirmBtn = document.getElementById('confirm-match-btn');
    const validationMsg = document.getElementById('validation-message');
    const isTeamAValid = courtSlots.teamA.length >= 1 && courtSlots.teamA.length <= 2;
    const isTeamBValid = courtSlots.teamB.length >= 1 && courtSlots.teamB.length <= 2;

    if (!isTeamAValid || !isTeamBValid) {
        confirmBtn.disabled = true;
        validationMsg.textContent = 'Mỗi đội phải có 1 hoặc 2 người chơi.';
    } else {
        confirmBtn.disabled = false;
        validationMsg.textContent = '';
    }
    
    renderAvailablePlayerList();
    renderCourt();
}

// === EVENT HANDLERS ===

async function handleConfirmMatch() {
    const team_A = courtSlots.teamA.map(id => ({ id }));
    const team_B = courtSlots.teamB.map(id => ({ id }));
    const data = { team_A, team_B };

    const result = await apiCall('/api/matches/queue', 'POST', data);
    if (result) {
        // Replace alert with success toast
        showToast(result.message || 'Đã thêm trận vào hàng chờ!', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 1000); // Add a small delay so user can see the toast
    }
}

// === DRAG & DROP LOGIC ===

function handleDragStart(e) {
    const target = e.target.closest('[data-player-id]');
    if (!target) return;
    draggedPlayerId = parseInt(target.dataset.playerId, 10);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedPlayerId);
    setTimeout(() => {
        target.classList.add('dragging');
    }, 0);
}

function handleDragEnd(e) {
    e.target.closest('[data-player-id]')?.classList.remove('dragging');
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
    
    const droppedPlayerId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!droppedPlayerId) return;

    let newTeamA = courtSlots.teamA.filter(id => id !== droppedPlayerId);
    let newTeamB = courtSlots.teamB.filter(id => id !== droppedPlayerId);

    if (targetTeamName === 'A') {
        if (newTeamA.length < 2) {
            newTeamA.push(droppedPlayerId);
        } else {
            // Replace alert with info toast
            showToast("Đội A đã đủ 2 người chơi.", 'info');
            return;
        }
    } else if (targetTeamName === 'B') {
        if (newTeamB.length < 2) {
            newTeamB.push(droppedPlayerId);
        } else {
            // Replace alert with info toast
            showToast("Đội B đã đủ 2 người chơi.", 'info');
            return;
        }
    }

    courtSlots.teamA = newTeamA;
    courtSlots.teamB = newTeamB;
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

export default async function init() {
    const players = await apiCall('/api/players/available');
    availablePlayers = players || [];
    
    document.getElementById('confirm-match-btn').addEventListener('click', handleConfirmMatch);
    
    initializeDragDropListeners(); 
    
    updateUIStates();
}
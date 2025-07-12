// state.js
import { LOCAL_STORAGE_KEY } from './config.js';

// Nguồn dữ liệu duy nhất của ứng dụng
const state = {
    players: [],
    nextPlayerId: 1,
    courts: [],
    nextCourtId: 1,
    matchHistoryCounter: 1,
    currentSuggestions: {},
    pairHistory: new Map(),
};

// Hàm để các module khác có thể truy cập state một cách an toàn
export function getState() {
    return state;
}

// Các hàm cập nhật state
export function setPlayers(newPlayers) {
    state.players = newPlayers;
}

export function setNextPlayerId(id) {
    state.nextPlayerId = id;
}

export function addPlayer(player) {
    state.players.push(player);
}

export function setCourts(newCourts) {
    state.courts = newCourts;
}

export function addCourt(court) {
    state.courts.push(court);
}

export function setNextCourtId(id) {
    state.nextCourtId = id;
}

export function setSuggestions(suggestions) {
    state.currentSuggestions = suggestions;
}

export function updatePairHistory(p1, p2) {
    if (!p1 || !p2) return;
    const key = [p1.id, p2.id].sort((a, b) => a - b).join('-');
    const currentCount = state.pairHistory.get(key) || 0;
    state.pairHistory.set(key, currentCount + 1);
}

// Logic lưu và tải từ localStorage
export function saveState() {
    const appState = {
        players: state.players,
        nextPlayerId: state.nextPlayerId,
        courts: state.courts.map(c => ({ id: c.id, players: [], startTime: null, timerInterval: null })),
        nextCourtId: state.nextCourtId,
        matchHistoryCounter: state.matchHistoryCounter,
        pairHistory: Array.from(state.pairHistory.entries()),
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appState));
}

export function loadState() {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
        const appState = JSON.parse(savedState);
        state.players = appState.players;
        state.nextPlayerId = appState.nextPlayerId;
        state.courts = appState.courts;
        state.nextCourtId = appState.nextCourtId;
        state.matchHistoryCounter = appState.matchHistoryCounter;
        state.pairHistory = new Map(appState.pairHistory);
        
        state.players.forEach(p => { if (p.status === 'playing') p.status = 'active'; });
        state.courts.forEach(c => { c.players = []; c.startTime = null; c.timerInterval = null; });
    } else {
        // Dữ liệu mẫu ban đầu
        state.players = [ { id: 1, name: 'An', level: 4, status: 'active', gamesPlayed: 0, type: 'Cố định', lastMatchEndTime: null }, { id: 2, name: 'Bình', level: 5, status: 'inactive', gamesPlayed: 0, type: 'Cố định', lastMatchEndTime: null }, { id: 3, name: 'Cường', level: 3, status: 'active', gamesPlayed: 0, type: 'Vãng lai', lastMatchEndTime: null }];
        state.nextPlayerId = 4;
        state.courts = [{ id: 1, players: [], startTime: null, timerInterval: null }];
        state.nextCourtId = 2;
    }
}
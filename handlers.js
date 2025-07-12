// handlers.js
import * as state from './state.js';
import * as logic from './logic.js';

export function handleDropPlayerOnCourt(evt) {
    const playerRow = evt.item;
    const dropZone = evt.to;
    const courtId = parseInt(dropZone.dataset.courtId);
    const playerId = parseInt(playerRow.dataset.id);

    // Xóa phần tử ảo được clone vào vùng thả
    playerRow.remove();

    const { players, courts } = state.getState();
    const court = courts.find(c => c.id === courtId);
    const player = players.find(p => p.id === playerId);

    if (!court || !player) return;

    // Kiểm tra các điều kiện
    if (court.players.length >= 4) {
        alert("Sân này đã đủ người!");
        return;
    }
    if (court.players.some(p => p.id === playerId)) {
        // Không cần alert vì người chơi sẽ tự biến mất sau khi render lại
        return;
    }
    if (player.status === 'playing') {
        alert(`${player.name} đang thi đấu ở sân khác!`);
        return;
    }

    // Thêm người chơi vào sân và cập nhật trạng thái
    court.players.push(player);
    player.status = 'playing';

    // Nếu đủ 4 người, tự động cân bằng đội và chuẩn bị bắt đầu trận đấu
    if (court.players.length === 4) {
        const balancedGroup = logic.getBestPairing(court.players);
        court.players = balancedGroup; // Sắp xếp lại người chơi theo cặp đã cân bằng
        court.startTime = Date.now();
        // Thông báo cho người dùng sau khi giao diện đã cập nhật xong
        setTimeout(() => alert(`Sân ${court.id} đã đủ người và tự động bắt đầu!`), 0);
    }

    state.saveState();
}

// ===================================================================
// CÁC HÀM HANDLER KHÁC GIỮ NGUYÊN NHƯ TRONG TỆP CỦA BẠN
// (Bạn có thể giữ nguyên phần còn lại của tệp handlers.js)
// ===================================================================
export function handleAddPlayer(e) {
    e.preventDefault();
    const nameInput = document.getElementById('player-name-input');
    const levelInput = document.getElementById('player-level-input');
    const typeInput = document.getElementById('player-type-input');
    
    const name = nameInput.value.trim();
    const level = parseInt(levelInput.value);
    const type = typeInput.value;

    if (name && level >= 1 && level <= 5) {
        const { nextPlayerId } = state.getState();
        state.addPlayer({ id: nextPlayerId, name, level, status: 'active', gamesPlayed: 0, type, lastMatchEndTime: null });
        state.setNextPlayerId(nextPlayerId + 1);
        
        e.target.reset();
        nameInput.focus();
        state.saveState();
    }
}

export function handleInlineEdit(e) {
    const target = e.target;
    if (!target.classList.contains('editable-cell')) return;

    const playerId = parseInt(target.dataset.playerId);
    const field = target.dataset.field;
    const newValue = target.textContent.trim();
    
    const { players } = state.getState();
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    if (field === 'level') {
        const newLevel = parseInt(newValue);
        if (isNaN(newLevel) || newLevel < 1 || newLevel > 5) {
            alert("Trình độ phải là một số từ 1 đến 5!");
            target.textContent = player.level;
            return;
        }
        player.level = newLevel;
    }
    
    state.saveState();
}

export function handlePlayerTableClick(e) {
    const action = e.target.dataset.action || e.target.parentElement.dataset.action;
    if (!action || e.target.closest('.editable-cell')) return;

    const row = e.target.closest('tr');
    if (!row) return;
    const playerId = parseInt(row.dataset.id);
    const { players } = state.getState();
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    switch (action) {
        case 'toggle-status':
            if (player.status !== 'playing') {
                player.status = player.status === 'active' ? 'resting' : 'active';
            }
            break;
        case 'toggle-type':
            player.type = player.type === 'Cố định' ? 'Vãng lai' : 'Cố định';
            break;
        case 'delete-player':
            if (confirm(`Bạn có chắc muốn xóa vĩnh viễn người chơi "${player.name}" khỏi CLB?`)) {
                state.setPlayers(players.filter(p => p.id !== playerId));
            }
            break;
    }
    state.saveState();
}


export function handleAttendanceChange(e) {
    if(e.target.type !== 'checkbox') return;

    const playerId = parseInt(e.target.dataset.playerId);
    const { players } = state.getState();
    const player = players.find(p => p.id === playerId);
    if(!player) return;
    
    if (player.status === 'playing') {
        alert("Không thể thay đổi trạng thái của người đang chơi!");
        e.target.checked = true;
        return;
    }

    player.status = e.target.checked ? 'active' : 'inactive';
    
    state.saveState();
}

export function handleSuggestMatch() {
    const { players, courts, pairHistory } = state.getState();
    const suggestionRule = document.getElementById('suggestion-rule').value;
    const avoidDuplicates = document.getElementById('avoid-duplicate-pairs').checked;

    const suggestions = logic.suggestNextMatch(players, courts, suggestionRule, avoidDuplicates, pairHistory);
    state.setSuggestions(suggestions);
}

export function handleConfirmMatch() {
    const { currentSuggestions, players, courts } = state.getState();
    if (Object.keys(currentSuggestions).length === 0) return;

    for (const courtId in currentSuggestions) {
        const court = courts.find(c => c.id == courtId);
        const suggestedPlayers = currentSuggestions[courtId];
        if (court) {
            court.players = suggestedPlayers;
            court.startTime = Date.now();
            suggestedPlayers.forEach(p_suggest => {
                const playerInDb = players.find(p_db => p_db.id === p_suggest.id);
                if (playerInDb) playerInDb.status = 'playing';
            });
        }
    }
    state.setSuggestions({});
    state.saveState();
}

export function handleFinishMatch(courtId) {
    const { players, courts } = state.getState();
    const court = courts.find(c => c.id === courtId);
    if (!court || court.players.length === 0) return null;

    clearInterval(court.timerInterval);
    const now = Date.now();
    
    const finishedPlayers = [...court.players];
    finishedPlayers.forEach(p_finished => {
        const playerInDb = players.find(p_db => p_db.id === p_finished.id);
        if (playerInDb) {
            playerInDb.status = 'active';
            playerInDb.gamesPlayed++;
            playerInDb.lastMatchEndTime = now;
        }
    });

    const [teamA, teamB] = [finishedPlayers.slice(0, 2), finishedPlayers.slice(2, 4)];
    state.updatePairHistory(teamA[0], teamA[1]);
    state.updatePairHistory(teamB[0], teamB[1]);
    
    const finishedCourtData = { 
        id: court.id,
        players: finishedPlayers,
        startTime: court.startTime,
        endTime: now 
    };

    court.players = [];
    court.startTime = null;
    court.timerInterval = null;
    
    state.saveState();
    return finishedCourtData; 
}

export function handleAddCourt() {
    const { nextCourtId } = state.getState();
    state.addCourt({ id: nextCourtId, players: [], startTime: null, timerInterval: null });
    state.setNextCourtId(nextCourtId + 1);
    state.saveState();
}

export function handleRemoveCourt(courtId) {
    const { courts } = state.getState();
    if (courts.length <= 1) { alert("Phải có ít nhất 1 sân!"); return; }
    const court = courts.find(c => c.id === courtId);
    if (court && court.players.length > 0) { alert("Không thể xóa sân đang có người chơi!"); return; }
    
    state.setCourts(courts.filter(c => c.id !== courtId));
    state.saveState();
}


export function handleImportData(event) {
    const file = event.target.files[0];
    if (!file) return false;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedPlayers = JSON.parse(e.target.result);
            if (!Array.isArray(importedPlayers) || !importedPlayers.every(p => 'name' in p && 'level' in p && 'id' in p)) {
                throw new Error("Dữ liệu trong tệp không hợp lệ.");
            }
            if (confirm("Dữ liệu nhập vào sẽ THAY THẾ TOÀN BỘ danh sách người chơi hiện tại. Tiếp tục?")) {
                state.setPlayers(importedPlayers);
                const maxId = importedPlayers.length > 0 ? Math.max(...importedPlayers.map(p => p.id)) : 0;
                state.setNextPlayerId(maxId + 1);
                alert(`Đã nhập thành công ${importedPlayers.length} người chơi!`);
                state.saveState();
                // Gửi một sự kiện tùy chỉnh để báo cho main.js biết cần render lại
                document.dispatchEvent(new CustomEvent('datachanged'));
            }
        } catch (error) {
            alert("Lỗi khi đọc tệp: " + error.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
    return true;
}

export function handleExportData() {
    const { players } = state.getState();
    const dataStr = JSON.stringify(players, null, 2);
    const dataBlob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = 'danh_sach_cau_long.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    // Không cần alert ở đây để tránh làm gián đoạn luồng
}

export function handleClearAllData() {
    if(confirm("Bạn có chắc muốn xóa TOÀN BỘ dữ liệu?\nHành động này không thể hoàn tác!")) {
        localStorage.removeItem('badmintonSessionManager');
        location.reload();
    }
}
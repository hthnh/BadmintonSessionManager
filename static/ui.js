// ui.js (Phiên bản mới cho kiến trúc Backend/API)

// === Lấy các DOM element ===
const DOMElements = {
    playerListBody: document.getElementById('player-list-body'),
    attendanceListContainer: document.getElementById('attendance-list'), // Sẽ được sửa sau
    suggestionOutputContainer: document.getElementById('suggestion-output'),
    confirmMatchBtn: document.getElementById('confirm-match-btn'),
    currentMatchCourtsContainer: document.getElementById('current-match-courts'),
    historyTableBody: document.getElementById('history-table-body'),
    clockElement: document.getElementById('clock'),
};


// === Các hàm render thành phần ===

function renderPlayerList(players = []) {
    DOMElements.playerListBody.innerHTML = '';
    const now = Date.now();

    // Lọc những người chơi đang có mặt để hiển thị
    const presentPlayers = players.filter(p => p.is_active);

    presentPlayers.forEach(player => {
        const row = document.createElement('tr');
        row.dataset.id = player.id;
        row.className = 'player-row';

        // Tính toán thời gian nghỉ
        let restTimeText = 'N/A';
        if (player.last_played_date) {
            const restMinutes = Math.floor((now - new Date(player.last_played_date).getTime()) / 60000);
            restTimeText = `${restMinutes} phút`;
        } else if (player.total_matches_played === 0) {
            restTimeText = 'Chưa chơi';
        }

        // Xác định trạng thái
        const statusIcon = player.is_active ? 'status-active' : 'status-inactive';
        // Thêm class status-text để dễ dàng query trong handlers
        const statusText = `<span class="status-text">${player.is_active ? 'Có mặt' : 'Vắng'}</span>`;

        row.innerHTML = `
            <td>${player.name}</td>
            <td><strong>${Math.round(player.elo_rating)}</strong></td>
            <td class="clickable" data-action="toggle-status"><span class="status-icon ${statusIcon}"></span>${statusText}</td>
            <td>${player.total_matches_played}</td>
            <td>${restTimeText}</td>
            <td>${player.type}</td>
            <td><button class="delete-player-btn" data-action="delete-player">🗑️</button></td>
        `;
        DOMElements.playerListBody.appendChild(row);
    });
}

function renderSuggestions(suggestions = []) {
    DOMElements.suggestionOutputContainer.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const { court_name, team_A, team_B } = suggestion;
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'court';

        const teamAHtml = team_A.map(p => `<div>${p.name} (${Math.round(p.elo_rating)})</div>`).join('');
        const teamBHtml = team_B.map(p => `<div>${p.name} (${Math.round(p.elo_rating)})</div>`).join('');

        suggestionDiv.innerHTML = `
            <h3>Gợi ý cho ${court_name}</h3>
            <div class="teams">
                <div class="team">${teamAHtml}</div>
                <div class="vs-divider">VS</div>
                <div class="team">${teamBHtml}</div>
            </div>
        `;
        DOMElements.suggestionOutputContainer.appendChild(suggestionDiv);
    });

    // Bật/tắt nút xác nhận
    DOMElements.confirmMatchBtn.disabled = suggestions.length === 0;
}

// ui.js

// ... (Giữ nguyên các hàm render khác) ...

function renderCurrentCourts(courts = [], ongoingMatches = []) {
    DOMElements.currentMatchCourtsContainer.innerHTML = '';

    // Tạo một map để dễ dàng tìm trận đấu theo court_id
    const matchMap = new Map(ongoingMatches.map(match => [match.court_id, match]));

    courts.forEach(court => {
        const courtDiv = document.createElement('div');
        courtDiv.className = 'court';
        courtDiv.dataset.courtId = court.id;

        const matchOnThisCourt = matchMap.get(court.id);

        if (matchOnThisCourt) {
            // --- CÓ TRẬN ĐẤU ĐANG DIỄN RA TRÊN SÂN NÀY ---
            const { match_id, team_A, team_B } = matchOnThisCourt;
            
            const teamAHtml = team_A.map(p => `<div class="player-in-court">${p.name} (${Math.round(p.elo_before)})</div>`).join('');
            const teamBHtml = team_B.map(p => `<div class="player-in-court">${p.name} (${Math.round(p.elo_before)})</div>`).join('');

            courtDiv.innerHTML = `
                <h3>${court.name}</h3>
                <div class="timer" id="court-timer-${court.id}">00:00</div> <div class="teams">
                    <div class="team has-players">${teamAHtml}</div>
                    <div class="vs-divider">VS</div>
                    <div class="team has-players">${teamBHtml}</div>
                </div>
                <button class="finish-match-btn" data-match-id="${match_id}" data-court-name="${court.name}">Kết thúc trận</button>
            `;
        } else {
            // --- SÂN TRỐNG ---
            courtDiv.innerHTML = `
                <h3>${court.name}</h3>
                <div class="teams">
                    <div class="team-drop-zone">-- Sân trống --</div>
                </div>
                <button class="finish-match-btn" disabled>Kết thúc trận</button>
            `;
        }
        DOMElements.currentMatchCourtsContainer.appendChild(courtDiv);
    });
}
function renderAttendanceList(players = []) {
    // Sẽ cập nhật lại logic điểm danh sau, tạm thời giữ cấu trúc
    DOMElements.attendanceListContainer.innerHTML = '';
    [...players].sort((a, b) => a.name.localeCompare(b.name)).forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'attendance-player';
        playerDiv.innerHTML = `
            <input type="checkbox" id="check-${player.id}" data-player-id="${player.id}" ${player.is_active ? 'checked' : ''}>
            <label for="check-${player.id}">${player.name} (ELO: ${Math.round(player.elo_rating)})</label>
        `;
        DOMElements.attendanceListContainer.appendChild(playerDiv);
    });
}


// === Các hàm tiện ích ===

export function updateClock() {
    if (DOMElements.clockElement) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        DOMElements.clockElement.textContent = now.toLocaleDateString('vi-VN', options);
    }
}


// === Hàm Render Tổng Hợp ===

/**
 * Hàm duy nhất được gọi từ main.js để vẽ lại toàn bộ giao diện
 * @param {object} appState - Đối tượng chứa players, courts, suggestions
 */
export function renderAll(appState) {
    const { players, courts, suggestions } = appState;
    
    renderPlayerList(players);
    renderCurrentCourts(courts, ongoingMatches);
    renderSuggestions(suggestions);
    renderAttendanceList(players); // Cập nhật lại cả danh sách điểm danh
    
    // Không cần gọi initDragAndDrop nữa
}
// export function renderAll(...)
export { renderAll, renderSuggestions };
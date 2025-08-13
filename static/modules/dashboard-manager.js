// static/modules/dashboard-manager.js (ĐÃ SỬA LỖI)

// Biến toàn cục để lưu trữ danh sách người chơi, tránh gọi API nhiều lần
let allPlayers = [];

/**
 * Hàm trợ giúp chung để gọi API
 */
async function apiCall(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Lỗi server: ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        }
        return { success: true };
    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi: ${error.message}`);
        return null;
    }
}

// === CÁC HÀM RENDER GIAO DIỆN ===

/** Hiển thị danh sách người chơi đang có mặt */
function renderActivePlayers() {
    const container = document.getElementById('active-players-container');
    container.innerHTML = '';
    const activePlayers = allPlayers.filter(p => p.is_active);
    if (activePlayers.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có người chơi nào có mặt.</div>';
        return;
    }
    activePlayers.forEach(player => {
        const div = document.createElement('div');
        div.className = 'list-item-player';
        div.innerHTML = `<span>${player.name}</span> <span class="player-elo">ELO: ${Math.round(player.elo_rating)}</span>`;
        container.appendChild(div);
    });
}

/** Hiển thị các trận đang gợi ý */
function renderSuggestions(suggestions) {
    const container = document.getElementById('queue-container');
    container.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Không có gợi ý nào phù hợp.</div>';
        return;
    }

    suggestions.forEach(match => {
        const div = document.createElement('div');
        div.className = 'match-card suggested-match';
        div.innerHTML = `
            <div class="match-card__header">
                <strong>Sân ${match.court_name}</strong>
                <span class="balance-score">Cân bằng: ${match.balance_score}</span>
            </div>
            <div class="match-card__teams">
                <div class="team">
                    <span>${match.team_A[0].name}</span>
                    <span>${match.team_A[1].name}</span>
                </div>
                <div class="vs-divider">VS</div>
                <div class="team">
                    <span>${match.team_B[0].name}</span>
                    <span>${match.team_B[1].name}</span>
                </div>
            </div>
            <div class="match-card__actions">
                <button class="button button--primary start-match-btn" data-court-id="${match.court_id}" data-team-a='${JSON.stringify(match.team_A)}' data-team-b='${JSON.stringify(match.team_B)}'>Bắt đầu</button>
            </div>
        `;
        container.appendChild(div);
    });
}

/** Hiển thị các trận đang diễn ra */
function renderOngoingMatches(matches) {
    const container = document.getElementById('active-courts-container');
    container.innerHTML = '';

    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có sân nào hoạt động.</div>';
        return;
    }

    matches.forEach(match => {
        const div = document.createElement('div');
        div.className = 'match-card ongoing-match';
        div.innerHTML = `
            <div class="match-card__header">
                <strong>Sân ${match.court_name}</strong>
            </div>
            <div class="match-card__teams">
                <div class="team team-a"><span>${match.team_A[0].name}</span><span>${match.team_A[1].name}</span></div>
                <div class="vs-divider">VS</div>
                <div class="team team-b"><span>${match.team_B[0].name}</span><span>${match.team_B[1].name}</span></div>
            </div>
            <div class="match-card__actions finish-actions">
                <span>Đội thắng:</span>
                <button class="button button--secondary finish-match-btn" data-match-id="${match.id}" data-winning-team="A">Đội A</button>
                <button class="button button--secondary finish-match-btn" data-match-id="${match.id}" data-winning-team="B">Đội B</button>
            </div>
        `;
        container.appendChild(div);
    });
}

/** Hiển thị danh sách người chơi trong popup điểm danh */
function renderAttendanceModal() {
    const container = document.getElementById('attendance-list-container');
    container.innerHTML = '';
    // Sắp xếp người chơi theo tên để dễ tìm
    allPlayers.sort((a, b) => a.name.localeCompare(b.name)).forEach(player => {
        const div = document.createElement('div');
        div.className = 'attendance-item';
        div.innerHTML = `
            <input type="checkbox" id="player-${player.id}" data-player-id="${player.id}" ${player.is_active ? 'checked' : ''}>
            <label for="player-${player.id}">${player.name}</label>
        `;
        container.appendChild(div);
    });
}

// === CÁC HÀM XỬ LÝ SỰ KIỆN ===

/** Lấy và hiển thị lại toàn bộ dữ liệu trên dashboard */
async function refreshDashboard() {
    allPlayers = await apiCall('/api/players') || [];
    renderActivePlayers();

    const ongoingMatches = await apiCall('/api/matches/ongoing');
    renderOngoingMatches(ongoingMatches);

    document.getElementById('queue-container').innerHTML = '<div class="list-item-placeholder">Bấm "Tạo trận" để xem gợi ý.</div>';
}

/** Xử lý khi bấm nút "Tạo trận" */
async function handleSuggestClick() {
    const params = new URLSearchParams({
        prioritize_rest: true,
        avoid_rematch: true,
    }).toString();
    const data = await apiCall(`/api/suggestions?${params}`);
    if (data) {
        renderSuggestions(data.suggestions);
    }
}

/** Xử lý khi bấm nút "Bắt đầu" một trận đấu gợi ý */
async function handleStartMatchClick(event) {
    if (!event.target.classList.contains('start-match-btn')) return;
    const button = event.target;
    const matchData = {
        court_id: button.dataset.courtId,
        team_A: JSON.parse(button.dataset.teamA),
        team_B: JSON.parse(button.dataset.teamB),
    };
    const result = await apiCall('/api/matches/start', 'POST', matchData);
    if (result) {
        alert(result.message);
        refreshDashboard();
    }
}

/** Xử lý khi bấm nút chọn đội thắng để kết thúc trận */
async function handleFinishMatchClick(event) {
    if (!event.target.classList.contains('finish-match-btn')) return;
    const button = event.target;
    const matchId = button.dataset.matchId;
    const winningTeam = button.dataset.winningTeam;
    const result = await apiCall(`/api/matches/${matchId}/finish`, 'POST', { winning_team: winningTeam });
    if (result) {
        alert(result.message);
        refreshDashboard();
    }
}

/** Xử lý khi bấm nút lưu điểm danh */
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
        alert('Đã cập nhật điểm danh thành công!');
    }

    modal.style.display = 'none';
    refreshDashboard();
}

/**
 * Hàm khởi tạo chính cho module này
 */
export default function init() {
    // Tải dữ liệu lần đầu
    refreshDashboard();

    // Gán sự kiện cho các nút
    document.getElementById('manage-courts-btn').addEventListener('click', () => {
        window.location.href = '/manage-courts';
    });
    document.getElementById('suggest-btn').addEventListener('click', () => {
        window.location.href = '/create';
    });

    // [SỬA LỖI] Gán sự kiện cho popup điểm danh
    const modal = document.getElementById('attendance-modal');
    document.getElementById('attendance-btn').addEventListener('click', async () => {
        // Luôn đảm bảo dữ liệu mới nhất trước khi hiển thị
        if (allPlayers.length === 0) {
            allPlayers = await apiCall('/api/players') || [];
        }
        renderAttendanceModal();
        modal.style.display = 'block';
    });
    document.getElementById('close-attendance-modal').addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('save-attendance-btn').addEventListener('click', handleAttendanceSave);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    // Event delegation
    document.getElementById('queue-container').addEventListener('click', handleStartMatchClick);
    document.getElementById('active-courts-container').addEventListener('click', handleFinishMatchClick);
}
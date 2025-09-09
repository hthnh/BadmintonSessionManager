// static/modules/dashboard-manager.js (Phiên bản đã sửa lỗi và dọn dẹp)

let allPlayers = []; // Biến toàn cục
let socket;
// === [MỚI] CÁC HÀM QUẢN LÝ PHIÊN CHƠI ===

async function handleStartSession() {
    if (confirm('Bạn có chắc muốn bắt đầu một phiên chơi mới? Hành động này sẽ reset lại toàn bộ chỉ số tạm thời (số trận đã chơi, số trận thắng...) của tất cả người chơi.')) {
        const result = await apiCall('/api/sessions/start', 'POST');
        if (result) {
            alert(result.message);
            await checkSessionStatus(); // Cập nhật lại trạng thái
            await refreshDashboard();   // Tải lại toàn bộ dashboard
        }
    }
}

async function handleEndSession() {
    if (confirm('Bạn có chắc muốn kết thúc phiên chơi này? Tất cả người chơi sẽ được chuyển sang trạng thái "vắng mặt".')) {
        const result = await apiCall('/api/sessions/end', 'POST');
        if (result) {
            alert(result.message);
            await checkSessionStatus(); // Cập nhật lại trạng thái
            await refreshDashboard();   // Tải lại toàn bộ dashboard
        }
    }
}

async function checkSessionStatus() {
    const statusText = document.getElementById('session-status-text');
    const buttonsContainer = document.getElementById('session-action-buttons');
    buttonsContainer.innerHTML = ''; // Xóa các nút cũ

    const session = await apiCall('/api/sessions/current');

    if (session) {
        // Có phiên đang hoạt động
        const startTime = new Date(session.start_time).toLocaleString('vi-VN');
        statusText.innerHTML = `<span style="color: #198754; font-weight: 700;">ĐANG HOẠT ĐỘNG</span> (Bắt đầu lúc: ${startTime})`;
        const endButton = document.createElement('button');
        endButton.className = 'button button--danger';
        endButton.textContent = 'Kết thúc phiên';
        endButton.onclick = handleEndSession;
        buttonsContainer.appendChild(endButton);
    } else {
        // Không có phiên nào hoạt động
        statusText.innerHTML = `<span style="color: #6c757d; font-weight: 700;">CHƯA BẮT ĐẦU</span>`;
        const startButton = document.createElement('button');
        startButton.className = 'button button--primary';
        startButton.textContent = 'Bắt đầu phiên mới';
        startButton.onclick = handleStartSession;
        buttonsContainer.appendChild(startButton);
    }
}




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

/**
 * Render danh sách người chơi đang có mặt
 */
function renderActivePlayers() {
    const container = document.getElementById('active-players-container');
    container.innerHTML = '';
    const activePlayers = allPlayers.filter(p => p.is_active);
    if (activePlayers.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có người chơi nào có mặt.</div>';
        return;
    }

    // Sắp xếp người chơi theo tên để danh sách ổn định
    activePlayers.sort((a, b) => a.name.localeCompare(b.name));

    activePlayers.forEach(player => {
        const div = document.createElement('div');
        div.className = 'list-item-player';
        
        // [CẬP NHẬT Ở ĐÂY] Thêm thông tin số trận đã chơi trong phiên
        div.innerHTML = `
            <span>${player.name}</span> 
            <span class="player-elo">
                - Trận: 
                <strong style="color: var(--color-primary);">${player.session_matches_played}</strong> 
                - Level: ${player.skill_level}
            </span>
        `;
        container.appendChild(div);
    });
}

/**
 * Render các trận trong hàng chờ (queue)
 */
function renderQueuedMatches(matches) {
    const container = document.getElementById('queue-container');
    container.innerHTML = '';
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có trận đấu nào trong hàng chờ.</div>';
        return;
    }
    matches.forEach(match => {
        const div = document.createElement('div');
        div.className = 'history-item-v2 queued';
        const teamAPlayers = match.team_A.map(p => p.name.split(' ').pop()).join(' & ');
        const teamBPlayers = match.team_B.map(p => p.name.split(' ').pop()).join(' & ');
        div.innerHTML = `
            <div class="history-item-v2__header">
                <strong>Sân ${match.court_name}</strong>
                <span class="status-tag queued-tag">Đang chờ</span>
            </div>
            <div class="history-item-v2__body">
                <span class="team-name">${teamAPlayers}</span>
                <strong class="vs-separator-queue">VS</strong>
                <span class="team-name">${teamBPlayers}</span>
            </div>
            <div class="history-item-v2__footer">
                 <button class="button button--primary begin-match-btn" data-match-id="${match.id}">Bắt đầu trận</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// [CẬP NHẬT] Hàm render các trận đang diễn ra
// static/modules/dashboard-manager.js

// [CẬP NHẬT] Hàm render các trận đang diễn ra
function renderOngoingMatches(matches) {
    const container = document.getElementById('active-courts-container');
    container.innerHTML = '';
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có sân nào hoạt động.</div>';
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
                <strong>Sân ${match.court_name}</strong>
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
                    
                    <span class="score-divider">-</span>

                    <button class="button-control score-btn dec-btn" data-action="dec_b">-</button>
                    <span class="score-box realtime-score" id="score-b-${match.court_id}">0</span>
                    <button class="button-control score-btn inc-btn" data-action="inc_b">+</button>
                </div>

                <span class="team-name">${teamBPlayers}</span>
            </div>
            <div class="history-item-v2__footer">
                 <button class="button button--primary finish-match-btn" data-match-id="${match.id}">Kết thúc & Lưu</button>
            </div>
        `;
        container.appendChild(div);
    });
}
/**
 * Render lịch sử tóm tắt trên dashboard
 */
function renderDashboardHistory(matches) {
    const container = document.getElementById('match-history-container');
    container.innerHTML = '';
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có lịch sử trận đấu.</div>';
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
                <strong>Sân ${match.court_name}</strong>
                <span class="winner-tag winner-${match.winning_team}">
                    Đội ${match.winning_team} thắng
                </span>
            </div>
            <div class="history-item-v2__body">
                <span class="team-name ${match.winning_team === 'A' ? 'team-winner' : ''}">${teamAPlayers}</span>
                <span class="score-box">${match.score_A} - ${match.score_B}</span>
                <span class="team-name ${match.winning_team === 'B' ? 'team-winner' : ''}">${teamBPlayers}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

/**
 * Render danh sách người chơi trong popup điểm danh
 */
function renderAttendanceModal() {
    const container = document.getElementById('attendance-list-container');
    container.innerHTML = '';
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


// Hàm xử lý khi nhấn nút điều khiển từ xa (+, -, Reset)
async function handleRemoteControl(e) {
    // Tìm phần tử nút có class 'button-control' gần nhất với nơi được click
    const button = e.target.closest('.button-control');
    
    // Nếu không click vào nút thì không làm gì cả
    if (!button) return;

    // Tìm thẻ cha .ongoing để lấy courtId
    const ongoingMatchCard = button.closest('.ongoing');
    if (!ongoingMatchCard) return;

    const courtId = ongoingMatchCard.dataset.courtId;
    const action = button.dataset.action;

    // Ghi log để kiểm tra
    console.log(`Remote control triggered: Court ID=${courtId}, Action=${action}`);

    if (courtId && action) {
        // Vô hiệu hóa nút tạm thời để tránh click nhiều lần
        button.disabled = true;
        await apiCall('/api/scoreboards/control', 'POST', { court_id: parseInt(courtId), action: action });
        // Kích hoạt lại nút sau khi request hoàn tất
        button.disabled = false;
    }
}



// Hàm xử lý việc gán scoreboard
async function handleAssignScoreboard(e) {
    if (e.target.tagName !== 'SELECT') return;
    const courtId = e.target.dataset.courtId;
    const deviceId = e.target.value;

    if (deviceId === "none") {
        // (Tùy chọn) Thêm logic hủy gán ở đây nếu cần
        return;
    }
    
    const result = await apiCall('/api/scoreboards/assign', 'POST', { device_id: deviceId, court_id: parseInt(courtId) });
    if (result) {
        alert(result.message);
        openScoreboardManager(); // Tải lại nội dung modal
    }
}

// Hàm render nội dung cho modal quản lý
function renderScoreboardManager(scoreboards, ongoingMatches, courts) {
    const content = document.getElementById('scoreboard-manager-content');
    
    // Lọc ra các scoreboard chưa được gán
    const availableBoards = scoreboards.filter(b => b.court_id === null);

    let html = '<h4>Gán bảng điểm cho các sân đang hoạt động:</h4>';
    
    if (ongoingMatches.length === 0) {
        html += '<p>Không có sân nào đang hoạt động.</p>';
    } else {
        ongoingMatches.forEach(match => {
            const assignedBoard = scoreboards.find(b => b.court_id === match.court_id);
            
            html += `<div class="assignment-row">
                        <strong>Sân ${match.court_name}:</strong>`;

            if (assignedBoard) {
                html += `<span>✔️ Đã gán: ${assignedBoard.device_id}</span>`;
            } else {
                let options = '<option value="none">-- Chọn thiết bị --</option>';
                availableBoards.forEach(board => {
                    options += `<option value="${board.device_id}">${board.device_id}</option>`;
                });
                html += `<select class="scoreboard-assign-select" data-court-id="${match.court_id}">${options}</select>`;
            }
            html += `</div>`;
        });
    }

    html += '<hr><h4>Tất cả thiết bị trong hệ thống:</h4>';
    if (scoreboards.length === 0) {
        html += '<p>Chưa có thiết bị nào được kết nối.</p>';
    } else {
        scoreboards.forEach(b => {
             html += `<div class="device-row">
                        <strong>${b.device_id}</strong> - 
                        <span>Trạng thái: ${b.court_id ? `Đang gán cho ${b.court_name}` : 'Sẵn sàng'}</span>
                      </div>`;
        });
    }

    content.innerHTML = html;
}


// Hàm chính để mở modal
async function openScoreboardManager() {
    const [scoreboards, ongoingMatches, courts] = await Promise.all([
        apiCall('/api/scoreboards'),
        apiCall('/api/matches/ongoing'),
        apiCall('/api/courts')
    ]);
    renderScoreboardManager(scoreboards || [], ongoingMatches || [], courts || []);
    document.getElementById('scoreboard-manager-modal').style.display = 'block';
}



// === HÀM TRUNG TÂM ===

/**
 * Lấy và hiển thị lại toàn bộ dữ liệu trên dashboard
 */
async function refreshDashboard() {
    const [players, ongoing, history, queued] = await Promise.all([
        apiCall('/api/players'),
        apiCall('/api/matches/ongoing'),
        apiCall('/api/matches/history'),
        apiCall('/api/matches/queued') // Gọi API lấy hàng chờ
    ]);

    allPlayers = players || [];
    renderActivePlayers();
    renderOngoingMatches(ongoing);
    renderDashboardHistory(history);
    renderQueuedMatches(queued); // Render hàng chờ
}


// === CÁC HÀM XỬ LÝ SỰ KIỆN ===

/**
 * Xử lý khi bấm nút "Bắt đầu trận" từ hàng chờ
 */
async function handleBeginMatch(e) {
    if (!e.target.classList.contains('begin-match-btn')) return;
    const matchId = e.target.dataset.matchId;
    if (!matchId) return;

    if (confirm('Bạn có chắc muốn bắt đầu trận đấu này?')) {
        const result = await apiCall(`/api/matches/${matchId}/begin`, 'POST');
        if (result) {
            alert(result.message);
            await refreshDashboard();
        }
    }
}

/**
 * Xử lý khi bấm nút "Kết thúc & Lưu"
 */
function handleFinishMatchClick(event) {
    if (!event.target.classList.contains('finish-match-btn')) return;
    
    const matchId = event.target.dataset.matchId;
    const scoreA = document.getElementById(`score-a-${matchId}`).value;
    const scoreB = document.getElementById(`score-b-${matchId}`).value;

    const modal = document.getElementById('finish-match-modal');
    modal.querySelector('#finish-match-id-input').value = matchId;
    modal.querySelector('#score-a-input').value = scoreA;
    modal.querySelector('#score-b-input').value = scoreB;
    modal.style.display = 'block';
    document.getElementById('finish-modal-error').style.display = 'none';
    modal.querySelector('#score-a-input').focus();
}

/**
 * Xử lý khi lưu kết quả từ modal kết thúc trận
 */
async function handleSaveMatchResult() {
    const modal = document.getElementById('finish-match-modal');
    const matchId = modal.querySelector('#finish-match-id-input').value;
    const scoreA = parseInt(document.getElementById('score-a-input').value, 10);
    const scoreB = parseInt(document.getElementById('score-b-input').value, 10);
    const errorP = document.getElementById('finish-modal-error');

    if (isNaN(scoreA) || isNaN(scoreB) || scoreA === scoreB) {
        errorP.style.display = 'block';
        return;
    }
    errorP.style.display = 'none';

    const result = await apiCall(`/api/matches/${matchId}/finish`, 'POST', {
        score_A: scoreA,
        score_B: scoreB,
    });

    if (result) {
        alert(result.message);
        modal.style.display = 'none';
        document.getElementById('finish-match-form').reset();
        await refreshDashboard();
    }
}

/**
 * Xử lý khi lưu điểm danh
 */
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
    await refreshDashboard();
}

/**
 * [MỚI] Hàm kết nối WebSocket và lắng nghe sự kiện
 */
function connectWebSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server via WebSocket!');
    });

    socket.on('score_updated', (data) => {
        console.log('Score update received:', data);
        
        const scoreA_element = document.getElementById(`score-a-${data.court_id}`);
        const scoreB_element = document.getElementById(`score-b-${data.court_id}`);

        if (scoreA_element && scoreB_element) {
            // Sửa từ .value thành .textContent vì chúng là thẻ <span>
            scoreA_element.textContent = data.score_A;
            scoreB_element.textContent = data.score_B;
            
            const scoreA = parseInt(data.score_A, 10);
            const scoreB = parseInt(data.score_B, 10);
            const matchCard = document.querySelector(`.history-item-v2.ongoing[data-court-id="${data.court_id}"]`);
            if (!matchCard) return;

            const finishButton = matchCard.querySelector('.finish-match-btn');
            
            // Logic kiểm tra điều kiện thắng và thay đổi nút Kết thúc
            if ((scoreA >= 21 || scoreB >= 21) && Math.abs(scoreA - scoreB) >= 2) {
                finishButton.style.backgroundColor = '#198754';
                finishButton.style.borderColor = '#198754';
                finishButton.textContent = 'Kết thúc ngay!';
            } else {
                // Trả lại style cũ nếu điểm số bị giảm xuống
                finishButton.style.backgroundColor = '';
                finishButton.style.borderColor = '';
                finishButton.textContent = 'Kết thúc & Lưu';
            }
        }
    });
}




// === KHỞI TẠO ===

/**
 * Hàm khởi tạo chính cho module này
 */
export default function init() {
    checkSessionStatus();
    refreshDashboard();
    connectWebSocket();

    // --- Gán sự kiện cho các nút tĩnh ---
    document.getElementById('manage-courts-btn').addEventListener('click', () => { window.location.href = '/manage-courts'; });
    document.getElementById('suggest-btn').addEventListener('click', () => { window.location.href = '/create'; });
    document.getElementById('export-history-btn').addEventListener('click', () => { window.location.href = '/history'; });
    document.getElementById('manage-scoreboards-btn').addEventListener('click', openScoreboardManager);


    // --- Gán sự kiện cho các modal ---
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
    document.getElementById('save-match-result-btn').addEventListener('click', handleSaveMatchResult);

    const scoreboardModal = document.getElementById('scoreboard-manager-modal');
    document.getElementById('close-scoreboard-modal').addEventListener('click', () => scoreboardModal.style.display = 'none');
    

    window.addEventListener('click', (event) => {
        if (event.target == attendanceModal) attendanceModal.style.display = 'none';
        if (event.target == finishModal) finishModal.style.display = 'none';
    });

    // --- Sử dụng Event Delegation cho các nút động ---
    document.getElementById('active-courts-container').addEventListener('click', handleRemoteControl);
    document.getElementById('queue-container').addEventListener('click', handleBeginMatch);
    scoreboardModal.addEventListener('change', handleAssignScoreboard);
    document.getElementById('active-courts-container').addEventListener('click', handleFinishMatchClick);
}
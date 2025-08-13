// static/modules/court-manager.js (Đã cập nhật)
const courtTimers = {};

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
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.error || `Lỗi server: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi: ${error.message}`);
        return null;
    }
}

// === HÀM RENDER ===

/**
 * Hàm chính để render toàn bộ danh sách sân
 * @param {Array} courts - Danh sách sân từ API
 * @param {Array} ongoingMatches - Danh sách các trận đang diễn ra
 */


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
            startTimer(court.id, new Date(matchOnThisCourt.start_time));
        } else {
            courtCard.classList.add('status-available');
            courtCard.innerHTML = createAvailableCourtCard(court);
            stopTimer(court.id);
        }
        
        container.appendChild(courtCard);
    });
}



/** Tạo HTML cho card sân đang trống */
function createAvailableCourtCard(court) {
    return `
        <div class="court-card__header">
            <h3>${court.name}</h3>
            <div class="court-card__actions">
                <button class="button button--danger delete-court-btn">Xóa</button>
            </div>
        </div>
        <div class="court-card__body">
            <div class="court-card__overlay">
                <div class="court-status">Sẵn sàng</div>
                <button class="button button--primary assign-match-btn">Tạo trận mới</button>
            </div>
        </div>
        <div class="court-card__footer">
            <span>Trạng thái: Trống</span>
        </div>
    `;
}



/** Tạo HTML cho card sân đang có trận đấu */
function createOngoingCourtCard(court, match) {
    const teamA = match.team_A;
    const teamB = match.team_B;
    return `
        <div class="court-card__header">
            <h3>${court.name}</h3>
        </div>
        <div class="court-card__body">
            <div class="player-slot">${teamA[0].name}</div>
            <div class="player-slot">${teamB[0].name}</div>
            <div class="player-slot">${teamA[1].name}</div>
            <div class="player-slot">${teamB[1].name}</div>
        </div>
        <div class="court-card__footer">
            <div class="court-timer" id="timer-${court.id}">00:00</div>
            <div class="court-score">
                <button class="button score-btn" data-team="A" data-change="-1">-</button>
                <span id="score-A-${court.id}">0</span>
                <span>:</span>
                <span id="score-B-${court.id}">0</span>
                <button class="button score-btn" data-team="B" data-change="1">+</button>
            </div>
            <div class="court-actions">
                <button class="button button--secondary pause-btn">Tạm dừng</button>
                <button class="button button--danger finish-btn">Kết thúc</button>
            </div>
        </div>
    `;
}



// === CÁC HÀM LOGIC ===


async function fetchAndRenderData() {
    // Sử dụng Promise.all để tải dữ liệu song song, tăng hiệu suất
    const [courts, ongoingMatches] = await Promise.all([
        apiCall('/api/courts'),
        apiCall('/api/matches/ongoing')
    ]);
    
    if (courts) {
        renderCourtList(courts, ongoingMatches || []);
    }
}



function startTimer(courtId, startTime) {
    if (courtTimers[courtId]) clearInterval(courtTimers[courtId]);

    const timerElement = document.getElementById(`timer-${courtId}`);
    if (!timerElement) return;

    courtTimers[courtId] = setInterval(() => {
        const now = new Date();
        const diff = now - startTime; // Milliseconds
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

function stopTimer(courtId) {
    if (courtTimers[courtId]) {
        clearInterval(courtTimers[courtId]);
        delete courtTimers[courtId];
    }
}


function handleScoreChange(courtCard, team, change) {
    const scoreElement = courtCard.querySelector(`#score-${team}-${courtCard.dataset.courtId}`);
    let currentScore = parseInt(scoreElement.textContent);
    currentScore += change;
    if (currentScore < 0) currentScore = 0; // Điểm không thể âm
    scoreElement.textContent = currentScore;
}

// === HÀM XỬ LÝ SỰ KIỆN ===

async function handleSaveNewCourt() {
    const nameInput = document.getElementById('court-name-input');
    const courtName = nameInput.value.trim();
    if (!courtName) {
        alert('Vui lòng nhập tên sân.');
        return;
    }

    const result = await apiCall('/api/courts', 'POST', { name: courtName });
    if (result) {
        alert(result.message || 'Thêm sân thành công!');
        nameInput.value = ''; // Xóa input
        document.getElementById('add-court-modal').style.display = 'none'; // Đóng modal
        fetchAndRenderCourts(); // Tải lại danh sách sân
    }
}



async function handleContainerClick(e) {
    const target = e.target;
    const courtCard = target.closest('.court-card');
    if (!courtCard) return;

    // Xử lý nút Xóa
    if (target.classList.contains('delete-court-btn')) {
        const courtCard = target.closest('.court-card');
        const courtId = courtCard.dataset.courtId;
        const courtName = courtCard.querySelector('h3').textContent;

        if (confirm(`Bạn có chắc muốn xóa vĩnh viễn sân "${courtName}"?`)) {
            const result = await apiCall(`/api/courts/${courtId}`, 'DELETE');
            if (result) {
                alert(result.message);
                fetchAndRenderCourts();
            }
        }
    }

    // Xử lý nút tăng/giảm điểm
    if (target.classList.contains('score-btn')) {
        const team = target.dataset.team;
        const change = parseInt(target.dataset.change);
        handleScoreChange(courtCard, team, change);
    }
    
    // Xử lý nút Tạm dừng/Tiếp tục
    if (target.classList.contains('pause-btn')) {
        const courtId = courtCard.dataset.courtId;
        if (courtTimers[courtId]) {
            stopTimer(courtId);
            target.textContent = 'Tiếp tục';
            target.classList.remove('pause-btn');
            target.classList.add('resume-btn');
        }
    } else if (target.classList.contains('resume-btn')) {
        // Chức năng tiếp tục sẽ phức tạp hơn, tạm thời chỉ là UI
        alert('Chức năng "Tiếp tục" cần logic phức tạp hơn để tính toán lại thời gian. Tạm thời chỉ là giao diện.');
        target.textContent = 'Tạm dừng';
        target.classList.remove('resume-btn');
        target.classList.add('pause-btn');
    }


    // Xử lý nút Kết thúc
    if (target.classList.contains('finish-btn')) {
        alert('Chức năng "Kết thúc" sẽ gọi API để lưu điểm và giải phóng sân.');
        // Logic gọi API finish_match sẽ được thêm vào đây
    }

    // Xử lý nút Tạo trận mới
    if (target.classList.contains('assign-match-btn')) {
        alert('Chức năng "Tạo trận mới" sẽ mở một popup để chọn người chơi.');
        // Logic mở popup chọn người chơi sẽ ở đây
    }
}



// === HÀM KHỞI TẠO ===

export default function init() {
    // Tải dữ liệu lần đầu
    fetchAndRenderData();

    document.getElementById('courts-list-container').addEventListener('click', handleContainerClick);
    
    // Gán sự kiện cho modal
    const modal = document.getElementById('add-court-modal');
    document.getElementById('show-add-court-modal-btn').addEventListener('click', () => {
        modal.style.display = 'block';
        document.getElementById('court-name-input').focus();
    });
    document.getElementById('close-add-court-modal').addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('save-court-btn').addEventListener('click', handleSaveNewCourt);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
    // Cho phép nhấn Enter để lưu
    document.getElementById('add-court-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSaveNewCourt();
    });

    // Gán sự kiện cho danh sách sân
    document.getElementById('courts-list-container').addEventListener('click', handleCourtListClick);
}
// static/modules/court-manager.js (Đã cập nhật hoàn thiện chức năng)

// Biến lưu trữ các bộ đếm thời gian cho mỗi sân
const courtTimers = {};

/**
 * Hàm trợ giúp chung để gọi API
 * @param {string} url - Đường dẫn API
 * @param {string} method - Phương thức HTTP (GET, POST, PUT, DELETE)
 * @param {object|null} body - Dữ liệu gửi đi (nếu có)
 * @returns {Promise<any>}
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

// === CÁC HÀM RENDER ===

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
            startTimer(matchOnThisCourt.id, new Date(matchOnThisCourt.start_time));
        } else {
            courtCard.classList.add('status-available');
            courtCard.innerHTML = createAvailableCourtCard(court);
            // Không cần timer cho sân trống, hàm stopTimer sẽ được gọi nếu trước đó có timer
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
        <div class="court-card__body" style="background-image: none;">
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

/** Tạo HTML cho card sân đang có trận đấu (Đã cập nhật) */
function createOngoingCourtCard(court, match) {
    const teamA = match.team_A;
    const teamB = match.team_B;
    // Dừng timer cũ nếu có để tránh bị trùng lặp
    stopTimer(match.id); 
    
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
            <div class="court-timer" id="timer-${match.id}">00:00</div>
            <div class="court-actions">
                <span>Đội thắng:</span>
                <button class="button button--secondary finish-match-btn" data-match-id="${match.id}" data-winning-team="A">Đội A</button>
                <button class="button button--secondary finish-match-btn" data-match-id="${match.id}" data-winning-team="B">Đội B</button>
            </div>
        </div>
    `;
}

// === CÁC HÀM LOGIC VÀ XỬ LÝ SỰ KIỆN ===

/**
 * Tải dữ liệu từ server và render lại giao diện
 */
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

function startTimer(matchId, startTime) {
    if (courtTimers[matchId]) clearInterval(courtTimers[matchId]);

    const timerElement = document.getElementById(`timer-${matchId}`);
    if (!timerElement) return;

    courtTimers[matchId] = setInterval(() => {
        const now = new Date();
        const diff = now - startTime; // Lấy chênh lệch thời gian bằng mili giây
        
        // 1. Tính toán số phút và giây
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        // 2. Định dạng thành MM:SS và hiển thị
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

function stopTimer(matchId) {
    if (courtTimers[matchId]) {
        clearInterval(courtTimers[matchId]);
        delete courtTimers[matchId];
    }
}

/**
 * Xử lý sự kiện click trên toàn bộ container danh sách sân (Event Delegation)
 * @param {Event} e - Đối tượng sự kiện
 */
async function handleContainerClick(e) {
    const target = e.target;
    const courtCard = target.closest('.court-card');
    if (!courtCard) return;

    const courtId = courtCard.dataset.courtId;

    // Xử lý nút Xóa sân (khi sân trống)
    if (target.classList.contains('delete-court-btn')) {
        const courtName = courtCard.querySelector('h3').textContent;
        if (confirm(`Bạn có chắc muốn xóa vĩnh viễn sân "${courtName}"?`)) {
            const result = await apiCall(`/api/courts/${courtId}`, 'DELETE');
            if (result) {
                alert(result.message);
                fetchAndRenderData();
            }
        }
    }

    // [MỚI] Xử lý nút Tạo trận mới (khi sân trống)
    if (target.classList.contains('assign-match-btn')) {
        window.location.href = '/create';
    }

    // [MỚI] Xử lý nút Kết thúc trận đấu (khi sân đang bận)
    if (target.classList.contains('finish-match-btn')) {
        const matchId = target.dataset.matchId;
        const winningTeam = target.dataset.winningTeam;
        
        if (confirm(`Xác nhận Đội ${winningTeam} thắng trận này?`)) {
            const result = await apiCall(`/api/matches/${matchId}/finish`, 'POST', { winning_team: winningTeam });
            if (result) {
                alert(result.message);
                stopTimer(matchId); // Dừng bộ đếm thời gian
                fetchAndRenderData(); // Tải lại toàn bộ dữ liệu
            }
        }
    }
}

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
        nameInput.value = '';
        document.getElementById('add-court-modal').style.display = 'none';
        fetchAndRenderData();
    }
}

// === HÀM KHỞI TẠO ===

export default function init() {
    // Tải dữ liệu lần đầu
    fetchAndRenderData();

    // Gán sự kiện cho container chính
    document.getElementById('courts-list-container').addEventListener('click', handleContainerClick);
    
    // Gán sự kiện cho modal thêm sân mới
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
    document.getElementById('add-court-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSaveNewCourt();
    });
}
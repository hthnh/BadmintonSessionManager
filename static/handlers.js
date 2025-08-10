// handlers.js (Phiên bản mới cho kiến trúc Backend/API)

// Hàm trợ giúp để thực hiện các cuộc gọi API và xử lý lỗi chung
async function apiCall(url, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Lỗi server: ${response.status}`);
        }
        
        // Nếu là phương thức GET, trả về dữ liệu json, ngược lại trả về response
        return method === 'GET' ? await response.json() : response;

    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi: ${error.message}`);
        return null; // Trả về null nếu có lỗi
    }
}


// --- Các hàm xử lý sự kiện cụ thể ---

async function handleAddPlayer(e, refreshCallback) {
    e.preventDefault();
    const nameInput = document.getElementById('player-name-input');
    // Bỏ qua level input vì giờ chúng ta dùng ELO
    // const levelInput = document.getElementById('player-level-input');
    const typeInput = document.getElementById('player-type-input');

    const name = nameInput.value.trim();
    const type = typeInput.value;

    if (name) {
        const newPlayer = {
            name: name,
            type: type,
            // ELO mặc định sẽ được backend xử lý, không cần gửi lên
        };
        
        const result = await apiCall('/api/players', 'POST', newPlayer);
        if (result) {
            e.target.reset();
            nameInput.focus();
            await refreshCallback(); // Tải lại dữ liệu sau khi thêm thành công
        }
    }
}

async function handlePlayerTableClick(e, refreshCallback) {
    const action = e.target.dataset.action;
    if (!action) return;

    const row = e.target.closest('tr');
    if (!row) return;

    const playerId = parseInt(row.dataset.id);

    if (action === 'delete-player') {
        if (confirm(`Bạn có chắc muốn xóa vĩnh viễn người chơi này?`)) {
            const result = await apiCall(`/api/players/${playerId}`, 'DELETE');
            if (result) {
                await refreshCallback(); // Tải lại dữ liệu
            }
        }
    }
    
    if (action === 'toggle-status') {
        // Lấy trạng thái hiện tại từ chính DOM element (hoặc từ appState nếu muốn)
        const currentStatusText = row.querySelector('.status-text').textContent;
        const currentIsActive = currentStatusText.includes('Có mặt'); // Giả định 'Có mặt' là active
        
        const newIsActive = !currentIsActive; // Đảo ngược trạng thái
        
        const result = await apiCall(`/api/players/${playerId}`, 'PUT', { is_active: newIsActive ? 1 : 0 });
        if (result) {
            await refreshCallback();
        }
    }
}

async function handleSuggestMatch(e) {
    // Tạm thời để trống, sẽ làm ở bước sau
    // Lấy các quy tắc từ checkbox
    const prioritizeRest = document.getElementById('avoid-duplicate-pairs').checked; // Tạm dùng checkbox cũ
    
    const apiUrl = `/api/suggestions?prioritize_rest=${prioritizeRest}`;
    
    const data = await apiCall(apiUrl);
    if(data) {
        // Cần cập nhật appState và render lại chỉ phần suggestions
        console.log("Gợi ý nhận được từ server:", data.suggestions);
        // renderSuggestions(data.suggestions); // Hàm này sẽ được định nghĩa lại trong ui.js
    }
}


/**
 * Hàm chính để gán tất cả các trình lắng nghe sự kiện
 * @param {function} refreshCallback - Hàm để tải lại dữ liệu và render lại UI
 */
export function initializeEventHandlers(refreshCallback) {
    // Gán sự kiện cho form thêm người chơi
    document.getElementById('add-player-form').addEventListener('submit', (e) => handleAddPlayer(e, refreshCallback));

    // Sử dụng event delegation cho các nút trong bảng người chơi
    const playerListBody = document.getElementById('player-list-body');
    playerListBody.addEventListener('click', (e) => handlePlayerTableClick(e, refreshCallback));
    
    // Gán sự kiện cho nút gợi ý
    document.getElementById('suggest-btn').addEventListener('click', handleSuggestMatch);

    // Gán các sự kiện khác ở đây (thêm sân, xóa sân, kết thúc trận...)
    // Ví dụ:
    // document.getElementById('add-court-btn').addEventListener('click', (e) => handleAddCourt(e, refreshCallback));
}


async function handleSuggestMatch(appState, renderSuggestions) {
    const prioritizeRest = document.getElementById('avoid-duplicate-pairs').checked; // Vẫn dùng tạm checkbox cũ
    
    const apiUrl = `/api/suggestions?prioritize_rest=${prioritizeRest}`;
    
    const data = await apiCall(apiUrl);
    if(data) {
        // Lưu gợi ý vào trạng thái của ứng dụng
        appState.suggestions = data.suggestions;
        // Gọi hàm render chỉ cho phần suggestions
        renderSuggestions(appState.suggestions);
    }
}

async function handleConfirmMatch(appState, refreshCallback) {
    if (!appState.suggestions || appState.suggestions.length === 0) {
        alert("Không có gợi ý nào để xác nhận!");
        return;
    }

    // Gửi yêu cầu bắt đầu cho mỗi trận đấu được gợi ý
    for (const suggestion of appState.suggestions) {
        const payload = {
            court_id: suggestion.court_id,
            team_A: suggestion.team_A,
            team_B: suggestion.team_B,
        };
        // Gọi API mà không cần chờ, hoặc có thể dùng Promise.all nếu muốn
        apiCall('/api/matches/start', 'POST', payload);
    }

    // Xóa các gợi ý sau khi đã xác nhận
    appState.suggestions = [];
    
    // Chờ một chút để server xử lý rồi làm mới toàn bộ dữ liệu
    setTimeout(() => {
        alert("Các trận đấu đã bắt đầu!");
        refreshCallback();
    }, 500); // 0.5 giây
}

async function handleCourtAreaClick(e, refreshCallback) {
    if (e.target.classList.contains('finish-match-btn')) {
        const matchId = e.target.dataset.matchId;
        
        // Hỏi người dùng đội nào thắng
        const winningTeam = prompt(`Trận đấu trên sân ${e.target.dataset.courtName} kết thúc.\nNhập 'A' nếu đội A thắng, 'B' nếu đội B thắng:`);

        if (winningTeam && (winningTeam.toUpperCase() === 'A' || winningTeam.toUpperCase() === 'B')) {
            const result = await apiCall(`/api/matches/${matchId}/finish`, 'POST', { winning_team: winningTeam.toUpperCase() });
            if (result) {
                alert("Đã kết thúc trận đấu. ELO sẽ được cập nhật.");
                await refreshCallback();
            }
        } else if (winningTeam !== null) { // Nếu người dùng không nhấn Cancel
            alert("Lựa chọn không hợp lệ. Vui lòng nhập 'A' hoặc 'B'.");
        }
    }
    
    // Thêm logic xóa sân nếu cần
    // if (e.target.classList.contains('delete-court-btn')) { ... }
}


/**
 * Hàm chính để gán tất cả các trình lắng nghe sự kiện
 */
export function initializeEventHandlers(appState, refreshCallback, renderSuggestions) {
    // ... (Giữ nguyên các event listener cũ) ...

    document.getElementById('add-player-form').addEventListener('submit', (e) => handleAddPlayer(e, refreshCallback));
    document.getElementById('player-list-body').addEventListener('click', (e) => handlePlayerTableClick(e, refreshCallback));
    
    // Cập nhật lại các handler để truyền state và các hàm render cần thiết
    document.getElementById('suggest-btn').addEventListener('click', () => handleSuggestMatch(appState, renderSuggestions));
    document.getElementById('confirm-match-btn').addEventListener('click', () => handleConfirmMatch(appState, refreshCallback));

    // Dùng event delegation cho toàn bộ khu vực sân đấu
    document.getElementById('current-match-courts').addEventListener('click', (e) => handleCourtAreaClick(e, refreshCallback));
}
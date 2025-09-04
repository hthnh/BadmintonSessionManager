// static/modules/history-manager.js (Phiên bản cuối cùng)

async function apiCall(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Lỗi server: ${response.status}`);
        return response.json();
    } catch (error) {
        console.error(`Lỗi API call đến ${url}:`, error);
        alert(`Đã xảy ra lỗi khi tải dữ liệu: ${error.message}`);
        return null;
    }
}

/** [MỚI] Hàm điền dữ liệu người chơi vào modal */
function populatePlayerDetailModal(player) {
    const fields = [
    'id','name', 'join_date', 'type', 'gender', 'contact_info', 'is_active','skill_level',
    'total_matches_played', 'total_wins', 'win_rate',
    'last_played_date', 'total_sessions_attended'
];
    fields.forEach(field => {
        const element = document.getElementById(`detail-${field}`);
        if (element) {
            let value = player[field];
            // Định dạng lại một số giá trị cho dễ đọc
            if (field === 'is_active') value = value ? 'Có mặt' : 'Vắng';
            if (field.includes('date') && value) value = new Date(value).toLocaleString('vi-VN');
            else if (field.includes('date')) value = 'Chưa có';
            if (field === 'win_rate') value = `${(value * 100).toFixed(1)}%`;

            element.textContent = (value !== null && value !== undefined) ? value : 'N/A';
        }
    });
    document.getElementById('player-detail-modal').style.display = 'block';
}

/** [CẬP NHẬT] Hàm render danh sách lịch sử */
function renderHistoryList(matches) {
    const container = document.getElementById('history-list-container');
    container.innerHTML = '';
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="list-item-placeholder">Chưa có trận đấu nào trong lịch sử.</div>';
        return;
    }
    matches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'history-card';
        if (match.winning_team) card.classList.add(`winner-${match.winning_team}`);
        const matchDate = new Date(match.end_time).toLocaleString('vi-VN', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        const renderTeam = (team, teamLetter) => {
            const isWinner = match.winning_team === teamLetter;
            let playersHtml = team.map(p => `
                <div class="player-elo-info">
                    <div>
                        <span class="player-name-link" data-player-id="${p.id}">${p.name}</span>
                    </div>
                </div>
            `).join('');
            return `<div class="team-details ${isWinner ? 'winner' : ''}"><h4>Đội ${teamLetter} ${isWinner ? ' (Thắng)' : ''}</h4>${playersHtml}</div>`;
        };
        card.innerHTML = `
            <div class="history-card__header"><h3>Sân: ${match.court_name}</h3><span>${matchDate}</span></div>
            <div class="history-card__body">
                ${renderTeam(match.team_A, 'A')}
                <div class="vs-separator"><span class="score-display">${match.score_A} - ${match.score_B}</span></div>
                ${renderTeam(match.team_B, 'B')}
            </div>`;
        container.appendChild(card);
    });
}

/** [MỚI] Hàm xử lý khi click vào tên người chơi */
async function handlePlayerNameClick(event) {
    if (!event.target.classList.contains('player-name-link')) return;
    const playerId = event.target.dataset.playerId;
    if (!playerId) return;
    const playerData = await apiCall(`/api/players/${playerId}`);
    if (playerData) {
        populatePlayerDetailModal(playerData);
    }
}

async function fetchAndRenderHistory() {
    const historyData = await apiCall('/api/matches/history');
    if (historyData) renderHistoryList(historyData);
}

/** [CẬP NHẬT] Hàm khởi tạo */
export default function init() {
    fetchAndRenderHistory();

    // Sử dụng event delegation để xử lý click hiệu quả
    document.getElementById('history-list-container').addEventListener('click', handlePlayerNameClick);

    const modal = document.getElementById('player-detail-modal');
    if (modal) {
        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        });
    }
}
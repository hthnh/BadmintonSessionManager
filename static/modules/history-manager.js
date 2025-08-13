// static/modules/history-manager.js

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
        if (match.winning_team) {
            card.classList.add(`winner-${match.winning_team}`);
        }

        const matchDate = new Date(match.end_time).toLocaleString('vi-VN', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        const renderTeam = (team, teamLetter) => {
            const isWinner = match.winning_team === teamLetter;
            let playersHtml = '';
            team.forEach(p => {
                const changeSign = p.elo_change > 0 ? '+' : '';
                const changeClass = p.elo_change > 0 ? 'positive' : (p.elo_change < 0 ? 'negative' : '');
                playersHtml += `
                    <div class="player-elo-info">
                        <span>${p.name} (${p.elo_before} -> ${p.elo_after})</span>
                        <span class="elo-change ${changeClass}">${changeSign}${p.elo_change}</span>
                    </div>
                `;
            });
            return `
                <div class="team-details ${isWinner ? 'winner' : ''}">
                    <h4>Đội ${teamLetter} ${isWinner ? ' (Thắng)' : ''}</h4>
                    ${playersHtml}
                </div>
            `;
        };
        
        card.innerHTML = `
            <div class="history-card__header">
                <h3>Sân: ${match.court_name}</h3>
                <span>${matchDate}</span>
            </div>
            <div class="history-card__body">
                ${renderTeam(match.team_A, 'A')}
                <div class="vs-separator">VS</div>
                ${renderTeam(match.team_B, 'B')}
            </div>
        `;
        container.appendChild(card);
    });
}

async function fetchAndRenderHistory() {
    const historyData = await apiCall('/api/matches/history');
    if (historyData) {
        renderHistoryList(historyData);
    }
}

export default function init() {
    fetchAndRenderHistory();
}
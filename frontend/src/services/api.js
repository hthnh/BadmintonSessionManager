import axios from 'axios';

// Cấu hình một instance của axios với địa chỉ baseURL của server Flask
const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:5000/api', // Đảm bảo port này khớp với server Flask của bạn
  headers: {
    'Content-Type': 'application/json',
  },
});

export default {
  // === Players API (dựa trên players.py) ===
  getPlayers() {
    return apiClient.get('/players/');
  },
  getPlayerById(playerId) {
    return apiClient.get(`/players/${playerId}/`);
  },
  addPlayer(playerData) {
    return apiClient.post('/players/', playerData);
  },
  updatePlayer(playerId, playerData) {
    return apiClient.put(`/players/${playerId}/`, playerData);
  },
  deletePlayer(playerId) {
    return apiClient.delete(`/players/${playerId}/`);
  },
  getAvailablePlayers() {
    return apiClient.get('/players/available/');
  },
  checkInPlayers(playerIds) { // Nhận một mảng các ID
    return apiClient.post('/players/check-in/', { player_ids: playerIds });
  },
  checkOutPlayers(playerIds) { // Nhận một mảng các ID
    return apiClient.post('/players/check-out/', { player_ids: playerIds });
  },
  togglePlayerActive(playerId) {
    return apiClient.post(`/players/toggle-active/${playerId}/`);
  },

  // === Courts API (dựa trên courts.py) ===
  getCourts() {
    return apiClient.get('/courts/');
  },
  addCourt(courtData) {
    return apiClient.post('/courts/', courtData);
  },
  deleteCourt(courtId) {
    return apiClient.delete(`/courts/${courtId}/`);
  },

  // === Sessions API (dựa trên sessions.py) ===
  getCurrentSession() {
    return apiClient.get('/sessions/current/');
  },
  startSession() { // Không cần data theo file sessions.py mới
    return apiClient.post('/sessions/start/');
  },
  endSession() {
    return apiClient.post('/sessions/end/');
  },

  // === Matches API (dựa trên matches.py) ===
  queueMatch(matchData) { // team_A, team_B
    return apiClient.post('/matches/queue/', matchData);
  },
  assignMatchToCourt(matchId, courtId) {
    return apiClient.post('/matches/assign/', { match_id: matchId, court_id: courtId });
  },
  finishMatch(matchId, winningTeam) { // winningTeam là 'A' hoặc 'B'
    return apiClient.post('/matches/finish/', { match_id: matchId, winning_team: winningTeam });
  },
  getOngoingMatches() {
    return apiClient.get('/matches/ongoing/');
  },
  getMatchHistory() {
    return apiClient.get('/matches/history/');
  },

  // === Settings API (dựa trên settings.py) ===
  getSettings() {
    return apiClient.get('/settings/');
  },
  updateSettings(settingsData) {
    return apiClient.put('/settings/', settingsData); // Method là PUT
  },

  // === Suggestions API (dựa trên suggestions.py) ===
  getSuggestions(suggestionData) { // player_ids, prioritize_rest, ...
    return apiClient.post('/suggestions/', suggestionData);
  },

  // === Scoreboards API (dựa trên scoreboards.py) ===
  getScoreboards() {
    return apiClient.get('/scoreboards/');
  },
  assignScoreboard(deviceId, courtId) {
    return apiClient.post('/scoreboards/assign/', { device_id: deviceId, court_id: courtId });
  },
  unassignScoreboard(deviceId) {
    return apiClient.post('/scoreboards/unassign/', { device_id: deviceId });
  },
  swapScoreboardTeams(scoreboardId) {
    return apiClient.post('/scoreboards/swap/', { scoreboard_id: scoreboardId });
  },
  getUnassignedScoreboards() {
    return apiClient.get('/scoreboards/unassigned/');
  },
  getScoreboardByCourt(courtId) {
    return apiClient.get(`/scoreboards/by_court/${courtId}/`);
  },
  controlScoreboard(controlData) { // court_id, action
    return apiClient.post('/scoreboards/control/', controlData);
  },
};
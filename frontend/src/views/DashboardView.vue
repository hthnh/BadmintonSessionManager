<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import api from '../services/api';
import { socketService } from '../services/socket';
import CourtCard from '../components/CourtCard.vue'; // Import component con

const activeSession = ref(null);
const courts = ref([]);
const availablePlayers = ref([]);
const isLoading = ref(true);

// Lấy trạng thái phiên hoạt động
async function fetchActiveSession() {
  try {
    isLoading.value = true;
    const response = await api.getActiveSession();
    if (response.data && response.data.session) {
      activeSession.value = response.data.session;
      courts.value = response.data.courts;
      availablePlayers.value = response.data.available_players;
    } else {
      activeSession.value = null;
    }
  } catch (error) {
    console.error("Failed to fetch active session:", error);
    activeSession.value = null;
  } finally {
    isLoading.value = false;
  }
}

// Bắt đầu một phiên mới
async function handleStartSession() {
  const numPlayers = prompt("Enter number of players for the session:", 4);
  const numCourts = prompt("Enter number of courts for the session:", 1);
  if (numPlayers && numCourts) {
    await api.startSession({
      num_players: parseInt(numPlayers),
      num_courts: parseInt(numCourts)
    });
    fetchActiveSession(); // Tải lại dữ liệu sau khi bắt đầu
  }
}

// Kết thúc phiên
async function handleEndSession() {
  if (confirm("Are you sure you want to end the current session?")) {
    await api.endSession();
    fetchActiveSession(); // Tải lại dữ liệu
  }
}

// Xử lý khi có cập nhật điểm số từ server
function handleScoreboardUpdate(data) {
  console.log('Scoreboard update received:', data);
  const update = JSON.parse(data);

  // Tìm đúng sân cần cập nhật
  const courtToUpdate = courts.value.find(c => c.id === update.court_id);
  if (courtToUpdate && courtToUpdate.current_match) {
    // Cập nhật điểm số, Vue sẽ tự động render lại giao diện
    courtToUpdate.current_match.team1_score = update.team1_score;
    courtToUpdate.current_match.team2_score = update.team2_score;
  }
}

// onMounted: Chạy khi component được tải
onMounted(() => {
  fetchActiveSession();
  socketService.connect(); // Kết nối Socket.IO
  socketService.listen('scoreboard_update', handleScoreboardUpdate); // Lắng nghe sự kiện
});

// onUnmounted: Chạy khi component bị hủy (khi chuyển trang khác)
onUnmounted(() => {
  socketService.disconnect(); // Ngắt kết nối để tránh rò rỉ bộ nhớ
});
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Dashboard</h1>
      <div v-if="activeSession">
        <button @click="handleEndSession" class="btn-danger">End Session</button>
      </div>
    </header>

    <div v-if="isLoading">Loading dashboard...</div>

    <div v-else-if="!activeSession" class="content-card">
      <h2>No Active Session</h2>
      <p>Start a new session to begin managing matches.</p>
      <button @click="handleStartSession" class="btn-primary">Start New Session</button>
    </div>

    <div v-else class="dashboard-grid">
      <div class="courts-container">
        <CourtCard
          v-for="court in courts"
          :key="court.id"
          :court="court"
        />
      </div>
      <div class="players-queue content-card">
        <h3>Available Players</h3>
        <ul>
          <li v-for="player in availablePlayers" :key="player.id">
            {{ player.name }} - (Level {{ player.skill_level }})
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 2rem;
}
.courts-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}
.players-queue ul {
  list-style: none;
  padding: 0;
}
.players-queue li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}
</style>
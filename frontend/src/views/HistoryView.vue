<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api';

const sessions = ref([]);
const isLoading = ref(true);

// Hàm để định dạng ngày tháng cho dễ đọc
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleString('vi-VN'); // Định dạng theo kiểu Việt Nam
}

async function fetchHistory() {
  try {
    isLoading.value = true;
    const response = await api.getSessionHistory();
    if (response.data && response.data.sessions) {
      sessions.value = response.data.sessions;
    }
  } catch (error) {
    console.error("Failed to fetch session history:", error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchHistory);
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Session History</h1>
    </header>

    <div class="content-card">
      <div v-if="isLoading">Loading history...</div>
      <table v-else class="styled-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Player Count</th>
            <th>Total Cost</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="sessions.length === 0">
            <td colspan="6">No session history found.</td>
          </tr>
          <tr v-for="session in sessions" :key="session.id">
            <td>{{ formatDate(session.date) }}</td>
            <td>{{ formatDate(session.start_time) }}</td>
            <td>{{ formatDate(session.end_time) }}</td>
            <td>{{ session.player_count }}</td>
            <td>{{ session.total_cost.toLocaleString('vi-VN') }} VND</td>
            <td>
              <button class="btn-secondary">View Details</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
  /* Bạn có thể copy và điều chỉnh style từ PlayersView.vue */
  /* ... */
  .btn-secondary {
    background-color: #95a5a6;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
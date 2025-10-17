<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api';

// Dùng ref để chứa một object settings
const settings = ref({});
const isLoading = ref(true);
const notification = ref(''); // Để hiển thị thông báo "Lưu thành công"

async function fetchSettings() {
  try {
    isLoading.value = true;
    const response = await api.getSettings();
    if (response.data && response.data.settings) {
      settings.value = response.data.settings;
    }
  } catch (error) {
    console.error("Failed to fetch settings:", error);
  } finally {
    isLoading.value = false;
  }
}

async function handleSaveSettings() {
  notification.value = '';
  try {
    await api.updateSettings(settings.value);
    notification.value = 'Settings saved successfully!';
    // Tự động ẩn thông báo sau 3 giây
    setTimeout(() => {
      notification.value = '';
    }, 3000);
  } catch (error) {
    notification.value = 'Failed to save settings.';
    console.error("Failed to save settings:", error);
  }
}

// Lấy settings khi component được tải
onMounted(fetchSettings);
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Application Settings</h1>
    </header>

    <div v-if="isLoading">Loading settings...</div>
    <form v-else @submit.prevent="handleSaveSettings" class="content-card settings-form">
      <h2>General Settings</h2>

      <div class="form-grid">
        <div class="form-group">
          <label for="session_cost">Session Cost (per hour)</label>
          <input id="session_cost" v-model.number="settings.session_cost" type="number" />
        </div>
        <div class="form-group">
          <label for="guest_fee">Guest Fee</label>
          <input id="guest_fee" v-model.number="settings.guest_fee" type="number" />
        </div>
         <div class="form-group">
          <label for="max_players_per_court">Max Players per Court</label>
          <input id="max_players_per_court" v-model.number="settings.max_players_per_court" type="number" />
        </div>
        <div class="form-group">
          <label for="max_consecutive_matches">Max Consecutive Matches</label>
          <input id="max_consecutive_matches" v-model.number="settings.max_consecutive_matches" type="number" />
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary">Save Settings</button>
        <div v-if="notification" class="notification">{{ notification }}</div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.settings-form {
  max-width: 800px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}
.form-group {
  display: flex;
  flex-direction: column;
}
.form-group label {
  margin-bottom: 0.5rem;
}
input {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.notification {
  color: green;
  font-weight: bold;
}
</style>
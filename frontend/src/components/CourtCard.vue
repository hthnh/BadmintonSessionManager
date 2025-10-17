<script setup>
// Component này nhận dữ liệu từ component cha qua 'props'
const props = defineProps({
  court: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <div class="court-card">
    <div class="court-header">
      <h3>{{ court.name }}</h3>
    </div>
    <div class="court-body">
      <div v-if="court.current_match">
        <div class="team">
          <span>{{ court.current_match.team1_players[0].name }} & {{ court.current_match.team1_players[1].name }}</span>
        </div>
        <div class="score">
          <span>{{ court.current_match.team1_score }} - {{ court.current_match.team2_score }}</span>
        </div>
        <div class="team">
          <span>{{ court.current_match.team2_players[0].name }} & {{ court.current_match.team2_players[1].name }}</span>
        </div>
      </div>
      <div v-else class="no-match">
        <p>Sân trống</p>
        <button class="btn-primary">Tạo trận</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.court-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}
.court-header {
  background-color: #2c3e50;
  color: white;
  padding: 0.75rem;
  text-align: center;
}
.court-body {
  padding: 1rem;
  text-align: center;
}
.team {
  font-size: 0.9rem;
  margin: 0.5rem 0;
}
.score {
  font-size: 2rem;
  font-weight: bold;
  margin: 0.5rem 0;
  color: #e67e22;
}
.no-match {
  padding: 2rem 0;
}
</style>
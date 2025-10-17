<script setup>
// ...
import { ref, onMounted } from 'vue'; // <--- ĐẢM BẢO DÒNG NÀY TỒN TẠI
import api from '../services/api';
const courts = ref([]);
const newCourtName = ref('');
const newCourtFee = ref(0);
// ...

async function fetchCourts() {
  // ...
  const response = await api.getCourts();
  courts.value = response.data.courts; // Giả sử API trả về { courts: [...] }
  // ...
}

async function handleAddCourt() {
  // ...
  const newCourt = {
    name: newCourtName.value,
    court_fee: parseInt(newCourtFee.value),
  };
  await api.addCourt(newCourt);
  fetchCourts();
  // ...
}
// ...
</script>
<template>
  <h1>Manage Courts</h1>
  <h2>Add New Court</h2>
  <form @submit.prevent="handleAddCourt">
    <label>Name</label>
    <input v-model="newCourtName" />
    <label>Fee</label>
    <input v-model="newCourtFee" type="number" />
    <button type="submit">Add Court</button>
  </form>
  <h2>Court List</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Fee</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="court in courts" :key="court.id">
        <td>{{ court.id }}</td>
        <td>{{ court.name }}</td>
        <td>{{ court.court_fee }}</td>
        <td><button @click="handleDeleteCourt(court.id)">Delete</button></td>
      </tr>
    </tbody>
  </table>
</template>
<style scoped> /* ... Giữ nguyên hoặc chỉnh sửa nếu cần ... */ </style>
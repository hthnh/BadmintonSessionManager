<script setup>
import Sidebar from './components/Sidebar.vue';
</script>

<template>
  <div class="app-container">
    <Sidebar />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>
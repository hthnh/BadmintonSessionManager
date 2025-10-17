<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2>Badminton SM</h2>
    </div>
    <nav class="sidebar-nav">
      <ul>
        <li><router-link to="/">Dashboard</router-link></li>
        <li><router-link to="/players">Players</router-link></li>
        <li><router-link to="/courts">Courts</router-link></li>
        <li><router-link to="/history">History</router-link></li>
        <li><router-link to="/settings">Settings</router-link></li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
/* Scoped styles only apply to this component */
.sidebar {
  width: 250px;
  background-color: #2c3e50;
  color: white;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.5rem;
  text-align: center;
  border-bottom: 1px solid #34495e;
}

.sidebar-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-nav li a {
  display: block;
  padding: 1rem 1.5rem;
  color: #bdc3c7;
  text-decoration: none;
  transition: background-color 0.2s, color 0.2s;
}

.sidebar-nav li a:hover {
  background-color: #34495e;
  color: white;
}
.router-link-exact-active {
    background-color: #34495e;
    color: white;
    font-weight: bold;
  }
</style>
import { createRouter, createWebHistory } from 'vue-router';
import PlayersView from '../views/PlayersView.vue';

// Sắp tới chúng ta sẽ import các View khác ở đây

const routes = [
  {
    path: '/players',
    name: 'Players',
    component: PlayersView
  },
  {
    path: '/courts',
    name: 'Courts',
    component: () => import('../views/CourtsView.vue') // Lazy load
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue')
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/HistoryView.vue')
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
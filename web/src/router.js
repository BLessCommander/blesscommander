import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';

// Routing in modalità hash: funziona su GitHub Pages e dentro le app Capacitor.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', name: 'home', component: HomeView }],
});

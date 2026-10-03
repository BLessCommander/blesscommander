import { createRouter, createWebHashHistory } from 'vue-router';
import { APP_NAME } from './config/environment.js';
import { it } from './i18n/it.js';
import { NAV_ITEMS } from './navigation.js';

// Le pagine si caricano a richiesta (SPEC 05 §5.3, criterio 9). Quelle senza vista dedicata
// usano il segnaposto finché non arriva la loro voce del piano.
const views = {
  dashboard: () => import('./views/DashboardView.vue'),
  decks: () => import('./views/DecksView.vue'),
  importDeck: () => import('./views/ImportDeckView.vue'),
  group: () => import('./views/GroupView.vue'),
  rules: () => import('./views/RulesView.vue'),
  profile: () => import('./views/ProfileView.vue'),
  environment: () => import('./views/EnvironmentView.vue'),
};
const placeholder = () => import('./views/PlaceholderView.vue');

const routes = NAV_ITEMS.map((item) => ({
  path: item.path,
  name: item.name,
  component: views[item.name] ?? placeholder,
  meta: { title: it.pages[item.name].title },
}));
// La pagina di accesso non sta nei menu: ci si arriva dal Profilo, dall'Ambiente e dall'avviso.
routes.push({
  path: '/accesso',
  name: 'access',
  component: () => import('./views/AccessView.vue'),
  meta: { title: it.pages.access.title },
});
routes.push({
  path: '/notifiche',
  name: 'notifications',
  component: () => import('./views/NotificationsView.vue'),
  meta: { title: it.pages.notifications.title },
});
routes.push({
  path: '/mazzi/:id',
  name: 'deck',
  component: () => import('./views/DeckDetailView.vue'),
  meta: { title: it.pages.decks.title },
});
routes.push({ path: '/:pathMatch(.*)*', redirect: '/' });

// Routing in modalità hash: funziona su GitHub Pages e dentro le app Capacitor.
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.afterEach((to) => {
  if (globalThis.document) {
    document.title = to.meta.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME;
  }
});

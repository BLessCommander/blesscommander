import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/cinzel/600.css';
import './styles/main.scss';
import App from './App.vue';
import { router } from './router';
import { useThemeStore } from './stores/theme.js';

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router);
useThemeStore(pinia).init();
app.mount('#app');

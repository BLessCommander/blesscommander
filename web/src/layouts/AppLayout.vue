<script setup>
import { onMounted } from 'vue';
import { ENVIRONMENT } from '../config/environment.js';
import { useDataStore } from '../stores/data.js';
import { useUiStore } from '../stores/ui.js';
import AppDrawer from '../components/layout/AppDrawer.vue';
import AppHeader from '../components/layout/AppHeader.vue';
import AppSidebar from '../components/layout/AppSidebar.vue';
import BottomNav from '../components/layout/BottomNav.vue';
import SyncBanner from '../components/layout/SyncBanner.vue';

const ui = useUiStore();
const data = useDataStore();

onMounted(() => data.load());
</script>

<template>
  <div class="shell" :class="{ 'is-collapsed': ui.sidebarCollapsed }">
    <div class="env-banner" role="status">{{ ENVIRONMENT.label }}</div>
    <div class="shell__body">
      <AppSidebar />
      <div class="shell__main">
        <AppHeader />
        <SyncBanner />
        <main id="main" class="page">
          <RouterView />
        </main>
      </div>
    </div>
    <BottomNav />
    <AppDrawer />
  </div>
</template>

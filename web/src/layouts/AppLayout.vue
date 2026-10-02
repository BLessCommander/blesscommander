<script setup>
import { ENVIRONMENT } from '../config/environment.js';
import { useUiStore } from '../stores/ui.js';
import AppDrawer from '../components/layout/AppDrawer.vue';
import AppHeader from '../components/layout/AppHeader.vue';
import AppSidebar from '../components/layout/AppSidebar.vue';
import BottomNav from '../components/layout/BottomNav.vue';

const ui = useUiStore();
</script>

<template>
  <div class="shell" :class="{ 'is-collapsed': ui.sidebarCollapsed }">
    <div class="env-banner" role="status">{{ ENVIRONMENT.label }}</div>
    <div class="shell__body">
      <AppSidebar />
      <div class="shell__main">
        <AppHeader />
        <main id="main" class="page">
          <RouterView />
        </main>
      </div>
    </div>
    <BottomNav />
    <AppDrawer />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { ENVIRONMENT } from '../config/environment.js';
import { it } from '../i18n/it.js';
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
    <div
      class="env-banner"
      :class="{ 'env-banner--test': data.actingAsOptions.testMode }"
      role="status"
    >
      <strong v-if="data.actingAsOptions.testMode" data-testid="test-banner">
        {{ it.actingAs.banner }}
      </strong>
      <span v-else>{{ ENVIRONMENT.label }}</span>
    </div>
    <div class="shell__body">
      <AppSidebar />
      <div class="shell__main">
        <AppHeader />
        <SyncBanner />
        <p
          v-if="ENVIRONMENT.mode === 'github' && ['auth', 'forbidden'].includes(data.errorCode)"
          class="notice notice--error"
          role="alert"
          data-testid="session-expired"
        >
          {{ it.access.expired }}
          <RouterLink to="/accesso" class="link-btn">{{ it.access.expiredAction }}</RouterLink>
        </p>
        <main id="main" class="page">
          <RouterView />
        </main>
      </div>
    </div>
    <BottomNav />
    <AppDrawer />
  </div>
</template>

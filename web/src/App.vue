<script setup>
import { ENVIRONMENT } from './config/environment.js';
import AppLayout from './layouts/AppLayout.vue';
import AccessView from './views/AccessView.vue';
</script>

<template>
  <main v-if="ENVIRONMENT.mode === 'signed-out'" id="main" class="page" data-testid="signed-out">
    <AccessView />
  </main>
  <AppLayout v-else />
</template>

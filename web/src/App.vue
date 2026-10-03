<script setup>
import { APP_NAME, ENVIRONMENT } from './config/environment.js';
import AppLayout from './layouts/AppLayout.vue';
import AccessView from './views/AccessView.vue';
</script>

<template>
  <main
    v-if="ENVIRONMENT.mode === 'signed-out'"
    id="main"
    class="page signed-out"
    data-testid="signed-out"
  >
    <p class="signed-out__brand">{{ APP_NAME }}</p>
    <AccessView />
  </main>
  <AppLayout v-else />
</template>

<style scoped>
/* Senza menu la pagina di accesso sta da sola: la restringo alla larghezza delle sue schede e la centro. */
.signed-out {
  max-width: calc(70ch + 2 * var(--space));
  padding-top: calc(var(--space) * 2 + env(safe-area-inset-top));
  padding-bottom: calc(var(--space) * 2);
}
.signed-out__brand {
  margin: 0 0 var(--space);
  font-family: var(--font-title);
  font-size: 1.25rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--accent);
}
</style>

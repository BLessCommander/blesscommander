<script setup>
import { ENVIRONMENT } from './config/environment.js';
</script>

<template>
  <div class="app">
    <div class="env-banner" role="status">{{ ENVIRONMENT.label }}</div>
    <RouterView />
  </div>
</template>

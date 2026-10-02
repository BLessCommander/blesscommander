<script setup>
import { useRoute } from 'vue-router';
import { it } from '../i18n/it.js';

const route = useRoute();
</script>

<template>
  <div class="stack">
    <h1>{{ route.meta.title }}</h1>
    <section class="card">
      <p>{{ it.placeholder.soon }}</p>
      <p class="muted">{{ it.placeholder.detail }}</p>
    </section>
  </div>
</template>

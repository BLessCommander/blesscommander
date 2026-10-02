<script setup>
defineProps({
  title: { type: String, required: true },
  value: { type: String, default: '—' },
  hint: { type: String, default: '' },
  /** Percentuale 0–100 per la barra di avanzamento; senza valore la barra non compare. */
  progress: { type: Number, default: null },
});
</script>

<template>
  <article class="kpi">
    <h3 class="kpi__title">{{ title }}</h3>
    <p class="kpi__value">{{ value }}</p>
    <p v-if="hint" class="kpi__hint">{{ hint }}</p>
    <div
      v-if="progress !== null"
      class="progress"
      role="progressbar"
      :aria-label="title"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="progress"
    >
      <div class="progress__bar" :style="{ width: `${progress}%` }"></div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { cardImageUrl, IMAGE_SIZES } from '../platform/card-images.js';

/** Immagine di una carta: carica solo quando serve, riserva lo spazio, ripiega sul nome. */
const props = defineProps({
  scryfallId: { type: String, default: null },
  name: { type: String, required: true },
  version: { type: String, default: 'small' },
});

const url = computed(() => cardImageUrl(props.scryfallId, { version: props.version }));
const failed = ref(false);
watch(url, () => {
  failed.value = false;
});
const size = computed(() => IMAGE_SIZES[props.version] ?? IMAGE_SIZES.small);
</script>

<template>
  <span
    class="card-image"
    :style="{ aspectRatio: `${size.width} / ${size.height}` }"
    data-testid="card-image"
  >
    <img
      v-if="url && !failed"
      :src="url"
      :alt="name"
      :width="size.width"
      :height="size.height"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="card-image__fallback">{{ name }}</span>
  </span>
</template>

<style scoped>
.card-image {
  display: block;
  width: 100%;
  overflow: hidden;
  background: var(--surface-alt, var(--surface));
  border: 1px solid var(--border);
  border-radius: 6%/4.3%;
  box-shadow: 0 1px 4px rgb(0 0 0 / 25%);
}

.card-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-image__fallback {
  display: grid;
  place-items: center;
  height: 100%;
  padding: 0.5rem;
  font-size: 0.8125rem;
  text-align: center;
  overflow-wrap: anywhere;
  color: var(--text-muted);
}
</style>

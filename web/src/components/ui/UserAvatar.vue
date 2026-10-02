<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  src: { type: String, default: '' },
});

const failed = ref(false);
const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?');
</script>

<template>
  <span class="avatar" aria-hidden="true">
    <img v-if="src && !failed" :src="src" alt="" @error="failed = true" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<script setup>
import { it } from '../../i18n/it.js';
import { useDataStore } from '../../stores/data.js';
import AppIcon from '../ui/AppIcon.vue';

const data = useDataStore();

defineProps({
  /** @type {import('vue').PropType<readonly import('../../navigation.js').NavItem[]>} */
  items: { type: Array, required: true },
});
</script>

<template>
  <ul class="nav-list">
    <li v-for="item in items" :key="item.name">
      <RouterLink
        :to="item.path"
        class="nav-item"
        active-class="is-active"
        exact-active-class="is-active"
      >
        <AppIcon :name="item.icon" />
        <span class="nav-item__label">{{ item.label }}</span>
        <span
          v-if="item.name === 'liveGames' && data.openGames.length"
          class="nav-badge"
          data-testid="live-badge"
          :aria-label="it.liveGames.badge(data.openGames.length)"
          >{{ data.openGames.length }}</span
        >
      </RouterLink>
    </li>
  </ul>
</template>

<style scoped>
.nav-item {
  position: relative;
}

/* Numero a destra della riga, centrato in verticale; nel menu a sole icone sta sull'angolo (_layout.scss). */
.nav-badge {
  display: inline-grid;
  flex: none;
  margin-left: auto;
  place-items: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  color: var(--surface);
  background: var(--accent);
  border-radius: 999px;
}
</style>

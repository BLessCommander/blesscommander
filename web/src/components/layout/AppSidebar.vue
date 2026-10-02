<script setup>
import { computed } from 'vue';
import { APP_NAME } from '../../config/environment.js';
import { it } from '../../i18n/it.js';
import { NAV_ITEMS } from '../../navigation.js';
import { useUiStore } from '../../stores/ui.js';
import AppIcon from '../ui/AppIcon.vue';
import NavList from './NavList.vue';

const ui = useUiStore();
const mainItems = NAV_ITEMS.filter((item) => item.group === 'main');
const moreItems = NAV_ITEMS.filter((item) => item.group === 'more');
const toggleLabel = computed(() =>
  ui.sidebarCollapsed ? it.nav.expandSidebar : it.nav.collapseSidebar,
);
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="sidebar__logo" aria-hidden="true">B</span>
      <span class="sidebar__name">{{ APP_NAME }}</span>
    </div>
    <nav class="sidebar__nav" :aria-label="it.nav.main">
      <p class="sidebar__group">{{ it.nav.groupMain }}</p>
      <NavList :items="mainItems" />
      <p class="sidebar__group">{{ it.nav.groupMore }}</p>
      <NavList :items="moreItems" />
    </nav>
    <button
      type="button"
      class="sidebar__toggle"
      :aria-label="toggleLabel"
      :aria-pressed="ui.sidebarCollapsed"
      @click="ui.toggleSidebar()"
    >
      <AppIcon :name="ui.sidebarCollapsed ? 'chevron-right' : 'chevron-left'" />
    </button>
  </aside>
</template>

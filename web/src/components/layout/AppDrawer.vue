<script setup>
import { ref } from 'vue';
import { APP_NAME } from '../../config/environment.js';
import { useDialog } from '../../composables/use-dialog.js';
import { useOverlay } from '../../composables/use-overlay.js';
import { it } from '../../i18n/it.js';
import { NAV_ITEMS } from '../../navigation.js';
import AppIcon from '../ui/AppIcon.vue';
import NavList from './NavList.vue';

// Menu a scomparsa del telefono: contiene tutte le voci, anche quelle non nella barra in basso.
const { isOpen, close } = useOverlay('menu');
const panel = ref(null);
useDialog(isOpen, panel, close);

const mainItems = NAV_ITEMS.filter((item) => item.group === 'main');
const moreItems = NAV_ITEMS.filter((item) => item.group === 'more');
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="drawer">
      <div class="drawer__backdrop" @click="close"></div>
      <div
        ref="panel"
        class="drawer__panel"
        role="dialog"
        aria-modal="true"
        :aria-label="it.nav.menuTitle"
        tabindex="-1"
      >
        <div class="drawer__header">
          <span class="sidebar__brand">
            <span class="sidebar__logo" aria-hidden="true">B</span>
            <span class="sidebar__name">{{ APP_NAME }}</span>
          </span>
          <button type="button" class="icon-btn" :aria-label="it.nav.closeMenu" @click="close">
            <AppIcon name="close" />
          </button>
        </div>
        <nav :aria-label="it.nav.main" class="drawer__nav">
          <p class="sidebar__group">{{ it.nav.groupMain }}</p>
          <NavList :items="mainItems" />
          <p class="sidebar__group">{{ it.nav.groupMore }}</p>
          <NavList :items="moreItems" />
        </nav>
      </div>
    </div>
  </Teleport>
</template>

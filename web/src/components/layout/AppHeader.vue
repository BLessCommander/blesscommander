<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { APP_NAME } from '../../config/environment.js';
import { useOverlay } from '../../composables/use-overlay.js';
import { it } from '../../i18n/it.js';
import { useThemeStore } from '../../stores/theme.js';
import AppIcon from '../ui/AppIcon.vue';

const route = useRoute();
const theme = useThemeStore();
const menu = useOverlay('menu');

const pageTitle = computed(() => String(route.meta.title ?? ''));
const themeLabel = computed(() =>
  theme.effective === 'dark' ? it.theme.toLight : it.theme.toDark,
);
</script>

<template>
  <header class="header">
    <button
      type="button"
      class="icon-btn header__menu"
      :aria-label="it.nav.openMenu"
      :aria-expanded="menu.isOpen.value"
      @click="menu.open()"
    >
      <AppIcon name="menu" />
    </button>
    <nav class="breadcrumb" :aria-label="it.nav.breadcrumb">
      <ol>
        <li class="breadcrumb__root">{{ APP_NAME }}</li>
        <li aria-current="page">{{ pageTitle }}</li>
      </ol>
    </nav>
    <div class="header__actions">
      <button type="button" class="icon-btn" :aria-label="themeLabel" @click="theme.toggle()">
        <AppIcon :name="theme.effective === 'dark' ? 'sun' : 'moon'" />
      </button>
      <RouterLink to="/profilo" class="icon-btn header__profile" :aria-label="it.pages.profile.nav">
        <AppIcon name="user" />
      </RouterLink>
    </div>
  </header>
</template>

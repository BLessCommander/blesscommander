<script setup>
import { it } from '../../i18n/it.js';
import { NAV_ITEMS } from '../../navigation.js';
import AppIcon from '../ui/AppIcon.vue';

const items = NAV_ITEMS.filter((item) => item.quick);
</script>

<template>
  <nav class="bottom-nav" :aria-label="it.nav.quick">
    <RouterLink
      v-for="item in items"
      :key="item.name"
      :to="item.path"
      class="bottom-nav__item"
      :class="{ 'bottom-nav__item--center': item.center }"
      active-class="is-active"
      exact-active-class="is-active"
    >
      <span class="bottom-nav__icon"><AppIcon :name="item.icon" /></span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

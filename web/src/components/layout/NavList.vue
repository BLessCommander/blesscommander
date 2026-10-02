<script setup>
import AppIcon from '../ui/AppIcon.vue';

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
      </RouterLink>
    </li>
  </ul>
</template>

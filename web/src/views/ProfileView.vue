<script setup>
import AppModal from '../components/ui/AppModal.vue';
import { APP_NAME, ENVIRONMENT } from '../config/environment.js';
import { useOverlay } from '../composables/use-overlay.js';
import { it } from '../i18n/it.js';
import { useThemeStore } from '../stores/theme.js';

const theme = useThemeStore();
const about = useOverlay('about');
const options = [
  { value: 'system', label: it.theme.system },
  { value: 'light', label: it.theme.light },
  { value: 'dark', label: it.theme.dark },
];
</script>

<template>
  <div class="stack">
    <h1>{{ it.pages.profile.title }}</h1>

    <section class="card">
      <fieldset class="choice">
        <legend class="choice__legend">{{ it.theme.legend }}</legend>
        <label v-for="option in options" :key="option.value" class="choice__option">
          <input
            type="radio"
            name="theme"
            :value="option.value"
            :checked="theme.preference === option.value"
            @change="theme.setPreference(option.value)"
          />
          <span>{{ option.label }}</span>
        </label>
      </fieldset>
    </section>

    <section class="card">
      <button type="button" class="btn" @click="about.open()">{{ it.profile.about }}</button>
    </section>

    <AppModal name="about" :title="it.profile.aboutTitle">
      <p>{{ APP_NAME }}</p>
      <p class="muted">{{ it.profile.aboutEnvironment }}: {{ ENVIRONMENT.label }}</p>
      <template #footer>
        <button type="button" class="btn" @click="about.close()">{{ it.profile.close }}</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { APP_NAME, BASE_PATH, ENVIRONMENT, TEST_REPO } from '../config/environment.js';
import { checkFakeGithub } from '../data/connection-check.js';
import { it } from '../i18n/it.js';

const t = it.environment;
/** @type {import('vue').Ref<'idle' | 'checking' | 'ok' | 'error'>} */
const connection = ref(ENVIRONMENT.mode === 'fake-github' ? 'checking' : 'idle');
const connectedLogin = ref('');

async function test() {
  connection.value = 'checking';
  const result = await checkFakeGithub(ENVIRONMENT.fakeGithubUrl, ENVIRONMENT.fakeLogin);
  connectedLogin.value = result.login ?? '';
  connection.value = result.ok ? 'ok' : 'error';
}

onMounted(() => {
  if (ENVIRONMENT.mode === 'fake-github') test();
});

const rows = [
  [t.mode, ENVIRONMENT.label],
  [t.app, APP_NAME],
  [t.data, ENVIRONMENT.mode === 'demo' ? t.dataDemo : `${TEST_REPO} (${t.dataFake})`],
  [t.basePath, BASE_PATH],
];
</script>

<template>
  <div class="stack">
    <h1>{{ it.pages.environment.title }}</h1>
    <section class="card" aria-labelledby="env-info">
      <h2 id="env-info">{{ t.info }}</h2>
      <dl class="env-list">
        <template v-for="[name, value] in rows" :key="name">
          <dt>{{ name }}</dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
      <p class="muted">{{ ENVIRONMENT.mode === 'demo' ? t.demoHelp : t.fakeHelp }}</p>
    </section>

    <section v-if="ENVIRONMENT.mode === 'fake-github'" class="card" aria-labelledby="env-conn">
      <h2 id="env-conn">{{ t.connection }}</h2>
      <p role="status" data-testid="connection-status">
        <template v-if="connection === 'checking'">{{ t.checking }}</template>
        <template v-else-if="connection === 'ok'">{{ t.connected }} {{ connectedLogin }}</template>
        <template v-else>{{ t.failed }}</template>
      </p>
      <button type="button" class="btn" @click="test">{{ t.retry }}</button>
    </section>
  </div>
</template>

<style scoped>
.env-list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1rem;
  margin: 0 0 1rem;
}
.env-list dt {
  font-weight: 600;
}
.env-list dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>

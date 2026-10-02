<script setup>
import { onMounted, ref } from 'vue';
import {
  APP_NAME,
  BASE_PATH,
  DATA_REPO,
  ENVIRONMENT,
  ORG,
  TEST_REPO,
} from '../config/environment.js';
import { checkFakeGithub, checkRepository } from '../data/connection-check.js';
import { reloadApp } from '../platform/app-lifecycle.js';
import { clearToken, saveToken } from '../platform/secure-storage.js';
import { it } from '../i18n/it.js';

const t = it.environment;
/** @type {import('vue').Ref<'idle' | 'checking' | 'ok' | 'error'>} */
const connection = ref(ENVIRONMENT.mode === 'fake-github' ? 'checking' : 'idle');
const connectedLogin = ref('');
const token = ref('');
/** @type {import('vue').Ref<'idle' | 'checking' | 'error'>} */
const realState = ref('idle');
const realReason = ref('auth');

async function connectReal() {
  realState.value = 'checking';
  const result = await checkRepository({ token: token.value.trim(), owner: ORG, repo: DATA_REPO });
  if (!result.ok) {
    realReason.value = result.reason;
    realState.value = 'error';
    return;
  }
  saveToken(token.value.trim());
  token.value = '';
  reloadApp();
}

function disconnectReal() {
  clearToken();
  reloadApp();
}

async function test() {
  connection.value = 'checking';
  const result = await checkFakeGithub(ENVIRONMENT.fakeGithubUrl, ENVIRONMENT.fakeLogin);
  connectedLogin.value = result.login ?? '';
  connection.value = result.ok ? 'ok' : 'error';
}

onMounted(() => {
  if (ENVIRONMENT.mode === 'fake-github') test();
});

function dataText() {
  if (ENVIRONMENT.mode === 'demo') return t.dataDemo;
  if (ENVIRONMENT.mode === 'github') return `${ORG}/${DATA_REPO} (${t.dataReal})`;
  return `${TEST_REPO} (${t.dataFake})`;
}

const help = { demo: t.demoHelp, 'fake-github': t.fakeHelp, github: t.realHelp };

const rows = [
  [t.mode, ENVIRONMENT.label],
  [t.app, APP_NAME],
  [t.data, dataText()],
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
      <p class="muted">{{ help[ENVIRONMENT.mode] }}</p>
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

    <section class="card" aria-labelledby="env-real">
      <h2 id="env-real">{{ t.realTitle }}</h2>
      <p v-if="ENVIRONMENT.mode === 'fake-github'" class="muted" data-testid="real-locked">
        {{ t.realLocked }}
      </p>
      <template v-else-if="ENVIRONMENT.mode === 'github'">
        <p data-testid="real-linked">{{ t.linked }} {{ ORG }}/{{ DATA_REPO }}</p>
        <button type="button" class="btn" @click="disconnectReal">{{ t.disconnect }}</button>
      </template>
      <form v-else class="stack" @submit.prevent="connectReal">
        <p class="muted">{{ t.realIntro }}</p>
        <label class="token-field">
          <span>{{ t.tokenLabel }}</span>
          <input
            v-model="token"
            type="password"
            name="token"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            required
          />
        </label>
        <p v-if="realState === 'error'" role="alert" data-testid="real-error">
          {{ t.realFailed[realReason] }}
        </p>
        <p v-else-if="realState === 'checking'" role="status">{{ t.connecting }}</p>
        <button type="submit" class="btn" :disabled="realState === 'checking' || !token.trim()">
          {{ t.connect }}
        </button>
      </form>
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
@media (max-width: 575px) {
  .env-list {
    grid-template-columns: 1fr;
    gap: 0.125rem;
  }
  .env-list dd {
    margin-bottom: 0.5rem;
  }
}
.token-field {
  display: grid;
  gap: 0.375rem;
  font-weight: 600;
}
.token-field input {
  min-height: var(--tap);
  padding: 0 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.env-list dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>

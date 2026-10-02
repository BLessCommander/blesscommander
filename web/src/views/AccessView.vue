<script setup>
import { ref } from 'vue';
import { DATA_REPO, ENVIRONMENT, LINKED_REPO, ORG } from '../config/environment.js';
import { signIn, signOut } from '../domain/session.js';
import { it } from '../i18n/it.js';
import { openExternal } from '../platform/external-link.js';

const t = it.access;
const TOKEN_PAGE = 'https://github.com/settings/personal-access-tokens/new';
const token = ref('');
const testRepo = ref(false);
/** @type {import('vue').Ref<'idle' | 'checking' | 'error'>} */
const state = ref('idle');
const reason = ref('auth');

async function submit() {
  state.value = 'checking';
  const result = await signIn(token.value, { testRepo: testRepo.value });
  if (result.ok) {
    token.value = '';
    return;
  }
  reason.value = result.reason;
  state.value = 'error';
}
</script>

<template>
  <div class="stack">
    <h1>{{ it.pages.access.title }}</h1>

    <section v-if="ENVIRONMENT.mode === 'fake-github'" class="card">
      <p class="muted" data-testid="access-locked">{{ t.fakeLocked }}</p>
    </section>

    <section v-else-if="ENVIRONMENT.mode === 'github'" class="card">
      <p data-testid="access-linked">{{ t.linked }} {{ ORG }}/{{ LINKED_REPO }}</p>
      <button type="button" class="btn" @click="signOut()">{{ t.signOut }}</button>
    </section>

    <template v-else>
      <section class="card stack access-card" aria-labelledby="access-guide">
        <p>{{ t.intro }}</p>
        <h2 id="access-guide">{{ t.guideTitle }}</h2>
        <ol class="guide">
          <li v-for="step in t.guideSteps(ORG, DATA_REPO)" :key="step">{{ step }}</li>
        </ol>
        <p class="muted">{{ t.notOrgMember }}</p>
        <button type="button" class="btn" @click="openExternal(TOKEN_PAGE)">
          {{ t.openGithub }}
        </button>
      </section>

      <form class="card stack access-card" @submit.prevent="submit">
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
        <label class="test-repo-field">
          <input v-model="testRepo" type="checkbox" name="testRepo" />
          <span>
            {{ t.testRepoLabel }}
            <small class="muted">{{ t.testRepoHelp }}</small>
          </span>
        </label>
        <div
          v-if="state === 'error'"
          class="notice notice--error"
          role="alert"
          data-testid="access-error"
        >
          <strong>{{ t.failed[reason].title }}</strong>
          <p>{{ t.failed[reason].action }}</p>
        </div>
        <p v-else-if="state === 'checking'" role="status">{{ t.checking }}</p>
        <button type="submit" class="btn" :disabled="state === 'checking' || !token.trim()">
          {{ t.submit }}
        </button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.access-card {
  max-width: 70ch;
}
.guide {
  margin: 0;
  padding-left: 1.25rem;
  display: grid;
  gap: 0.5rem;
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
.test-repo-field {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--tap);
}
.test-repo-field input {
  appearance: none;
  flex: none;
  display: grid;
  place-items: center;
  width: var(--tap);
  height: var(--tap);
  margin: 0;
  cursor: pointer;
}
.test-repo-field input::before {
  content: '';
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--text-muted);
  border-radius: 0.375rem;
  background: var(--surface);
}
.test-repo-field input::before,
.test-repo-field input::after {
  grid-area: 1 / 1;
}
.test-repo-field input:checked::before {
  border-color: var(--accent);
  background: var(--accent);
}
.test-repo-field input:checked::after {
  content: '';
  width: 0.4rem;
  height: 0.75rem;
  margin-bottom: 0.15rem;
  border: solid var(--on-accent);
  border-width: 0 3px 3px 0;
  transform: rotate(45deg);
}
.test-repo-field input:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: -2px;
  border-radius: var(--radius-sm);
}
.test-repo-field small {
  display: block;
  font-size: 0.875rem;
}
.notice p {
  margin: 0.25rem 0 0;
}
</style>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { importDecks } from '../domain/import-decks.js';
import { ImportRequestError, requestAndWait } from '../domain/import-request.js';
import { it } from '../i18n/it.js';
import { createScryfall } from '../platform/scryfall.js';
import { useDataStore } from '../stores/data.js';

const t = it.importDeck.user;
const TIERS = ['F1', 'F2', 'F3', 'F4', 'F5'];
const DEFAULT_TIER = 'F3';
const data = useDataStore();
const scryfall = createScryfall();

const POLL_MS = 3000;
const POLL_LIMIT = 70;

const nick = ref('');
const phase = ref('idle'); // idle | searching | list | importing | done
const error = ref('');
const decks = ref([]);
const selected = ref([]); // id dei mazzi spuntati
const tiers = ref({}); // id → fascia dichiarata
const progress = ref({ done: 0, total: 0 });
const outcomes = ref([]);

let stopped = false;
onBeforeUnmount(() => {
  stopped = true;
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ask = (source, url) =>
  requestAndWait({
    create: (s, u) => data.write('requestImport', s, u),
    get: (id) => data.getImportRequest(id),
    source,
    url,
    wait,
    pollMs: POLL_MS,
    limit: POLL_LIMIT,
    isStopped: () => stopped,
  });

const allSelected = computed(
  () => decks.value.length > 0 && selected.value.length === decks.value.length,
);
const someSelected = computed(() => selected.value.length > 0 && !allSelected.value);

function toggleAll() {
  selected.value = allSelected.value ? [] : decks.value.map((d) => d.id);
}

function failureText(e) {
  if (e instanceof ImportRequestError) {
    if (e.kind === 'failed') return t.failed(e.message);
    if (e.kind === 'timeout') return t.timeout;
  }
  return t.requestFailed;
}

async function search() {
  error.value = '';
  const value = nick.value.trim();
  if (!value) return;
  phase.value = 'searching';
  try {
    const state = await ask('archidekt-user', value);
    decks.value = state.decks ?? [];
    selected.value = [];
    tiers.value = Object.fromEntries(decks.value.map((d) => [d.id, DEFAULT_TIER]));
    outcomes.value = [];
    phase.value = 'list';
  } catch (e) {
    if (stopped) return;
    error.value = failureText(e);
    phase.value = 'idle';
  }
}

async function importSelected() {
  const chosen = decks.value
    .filter((d) => selected.value.includes(d.id))
    .map((d) => ({ ...d, tier: tiers.value[d.id] ?? DEFAULT_TIER }));
  if (!chosen.length) return;
  error.value = '';
  phase.value = 'importing';
  progress.value = { done: 0, total: chosen.length };
  outcomes.value = await importDecks({
    decks: chosen,
    declaredTier: DEFAULT_TIER,
    requestDeck: (url) => ask('archidekt', url),
    lookup: (names) => scryfall.lookup(names),
    save: async (deck, version) => {
      const saved = await data.write('saveDeck', deck);
      await data.write('saveDeckVersion', saved.id, version);
    },
    now: () => new Date().toISOString(),
    onProgress: (done, total) => {
      progress.value = { done, total };
    },
  });
  if (!stopped) phase.value = 'done';
}

const reasonText = (outcome) => {
  if (outcome.status === 'review') {
    return outcome.reason?.includes('not-found') ? t.reviewNotFound : t.reviewNoCommander;
  }
  return outcome.reason || t.requestFailed;
};
const importedCount = computed(() => outcomes.value.filter((o) => o.status === 'imported').length);
const problems = computed(() => outcomes.value.filter((o) => o.status !== 'imported'));
</script>

<template>
  <div class="user-import" data-testid="import-user">
    <template v-if="phase === 'idle' || phase === 'searching'">
      <label class="field">
        <span>{{ t.nickLabel }}</span>
        <input
          v-model="nick"
          type="text"
          name="archidektNick"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="phase === 'searching'"
          @keydown.enter.prevent="search"
        />
        <small v-if="phase === 'idle'" class="muted">{{ t.nickHelp }}</small>
      </label>
      <p v-if="error" class="notice notice--error" role="alert" data-testid="import-error">
        {{ error }}
      </p>
      <p
        v-if="phase === 'searching'"
        class="import-waiting"
        role="status"
        aria-live="polite"
        data-testid="import-waiting"
      >
        <span class="import-waiting__spinner" aria-hidden="true"></span>
        {{ t.searching }}
      </p>
      <button
        type="button"
        class="btn"
        :disabled="phase !== 'idle' || !nick.trim()"
        @click="search"
      >
        {{ phase === 'searching' ? t.searchingButton : t.search }}
      </button>
    </template>

    <template v-else-if="phase === 'list'">
      <header class="user-import__head">
        <h2>{{ t.listTitle(nick.trim(), decks.length) }}</h2>
        <p class="muted">{{ t.listHelp }}</p>
      </header>

      <div class="deck-pick__bar">
        <label class="deck-pick__all">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="someSelected"
            @change="toggleAll"
          />
          <span class="deck-pick__box" aria-hidden="true"></span>
          <span>{{ t.selectAll }}</span>
        </label>
        <span class="muted" aria-live="polite">{{
          t.selectedCount(selected.length, decks.length)
        }}</span>
      </div>

      <ul class="deck-pick" data-testid="user-decks">
        <li
          v-for="deck in decks"
          :key="deck.id"
          class="deck-pick__row"
          :class="{ 'deck-pick__row--on': selected.includes(deck.id) }"
        >
          <label class="deck-pick__main">
            <input v-model="selected" type="checkbox" :value="deck.id" name="userDeck" />
            <span class="deck-pick__box" aria-hidden="true"></span>
            <span class="deck-pick__text">
              <span class="deck-pick__name">{{ deck.name }}</span>
              <span class="deck-pick__meta muted">{{ t.cards(deck.size) }}</span>
            </span>
          </label>
          <label class="deck-pick__tier">
            <span class="sr-only">{{ t.tierOf(deck.name) }}</span>
            <span class="deck-pick__tier-label" aria-hidden="true">{{ t.tierShort }}</span>
            <select v-model="tiers[deck.id]" :name="`tier-${deck.id}`">
              <option v-for="tier in TIERS" :key="tier" :value="tier">{{ tier }}</option>
            </select>
          </label>
        </li>
      </ul>
      <p class="muted">{{ t.tierHelp }}</p>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <div class="user-import__actions">
        <button type="button" class="btn" :disabled="!selected.length" @click="importSelected">
          {{ t.importSelected(selected.length) }}
        </button>
        <button type="button" class="btn btn--secondary" @click="phase = 'idle'">
          {{ t.otherNick }}
        </button>
      </div>
    </template>

    <template v-else-if="phase === 'importing'">
      <p class="import-waiting" role="status" aria-live="polite" data-testid="import-waiting">
        <span class="import-waiting__spinner" aria-hidden="true"></span>
        {{ t.importing(progress.done, progress.total) }}
      </p>
    </template>

    <template v-else>
      <div class="user-import" data-testid="import-summary">
        <p class="notice" role="status">{{ t.summary(importedCount, outcomes.length) }}</p>
        <div v-if="problems.length" class="notice notice--error" data-testid="import-problems">
          <strong>{{ t.problemsTitle }}</strong>
          <ul>
            <li v-for="o in problems" :key="o.name">{{ o.name }}: {{ reasonText(o) }}</li>
          </ul>
        </div>
        <div class="user-import__actions">
          <RouterLink to="/mazzi" class="btn">{{ t.goToDecks }}</RouterLink>
          <button type="button" class="btn btn--secondary" @click="phase = 'list'">
            {{ t.backToList }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.user-import {
  display: grid;
  gap: var(--space);
}

.field {
  display: grid;
  gap: 0.375rem;
  font-weight: 600;
}

.field small {
  font-weight: 400;
}

.field input {
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color-scheme: light dark;
}

.field input:disabled {
  opacity: 0.7;
}

.user-import__head h2 {
  margin: 0 0 4px;
}

.user-import__head p {
  margin: 0;
}

.user-import__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.deck-pick__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: var(--tap);
  padding: 0 4px;
}

.deck-pick__all {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap);
  cursor: pointer;
  font-weight: 600;
}

.deck-pick {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.deck-pick__row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px 12px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.deck-pick__row--on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.deck-pick__main {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap);
  min-width: 0;
  cursor: pointer;
}

/* La casella vera copre tutta la riga (zona di tocco ≥ 44 px); il quadratino è solo disegno. */
.deck-pick input[type='checkbox'],
.deck-pick__all input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.deck-pick__box {
  position: relative;
  flex: none;
  width: 24px;
  height: 24px;
  border: 2px solid var(--text-muted);
  border-radius: 6px;
  background: var(--surface);
}

input:checked + .deck-pick__box,
input:indeterminate + .deck-pick__box {
  border-color: var(--accent);
  background: var(--accent);
}

input:checked + .deck-pick__box::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 7px;
  width: 6px;
  height: 11px;
  border: solid var(--on-accent);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

input:indeterminate + .deck-pick__box::after {
  content: '';
  position: absolute;
  top: 9px;
  left: 4px;
  width: 12px;
  height: 2px;
  background: var(--on-accent);
}

input:focus-visible + .deck-pick__box {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

.deck-pick__text {
  display: grid;
  min-width: 0;
}

.deck-pick__name {
  overflow-wrap: anywhere;
  font-weight: 600;
}

.deck-pick__meta {
  font-size: 0.875rem;
}

.deck-pick__tier {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 36px;
}

.deck-pick__tier-label {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.deck-pick__tier select {
  min-height: var(--tap);
  min-width: 84px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

@media (min-width: 576px) {
  .deck-pick__row {
    grid-template-columns: 1fr auto;
  }

  .deck-pick__tier {
    padding-left: 0;
  }
}

.import-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
}

.import-waiting__spinner {
  flex: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: import-spin 0.9s linear infinite;
}

@keyframes import-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .import-waiting__spinner {
    animation: none;
  }
}
</style>

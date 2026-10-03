<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import DeckWizard from './DeckWizard.vue';
import { buildPreparedDeck, prepareDeck } from '../domain/import-decks.js';
import { ImportRequestError, requestAndWait } from '../domain/import-request.js';
import { it } from '../i18n/it.js';
import { createScryfall } from '../platform/scryfall.js';
import { useDataStore } from '../stores/data.js';

const t = it.importDeck.user;
const data = useDataStore();
const scryfall = createScryfall();

const POLL_MS = 3000;
const POLL_LIMIT = 70;

const nick = ref('');
const phase = ref('idle'); // idle | searching | list | importing | wizard | done
const error = ref('');
const decks = ref([]);
const selected = ref([]); // id dei mazzi spuntati
const chosen = ref([]); // mazzi scelti, nell'ordine
const results = ref([]); // esito della preparazione di ogni mazzo scelto (vuoto finché non è pronto)
const cursor = ref(0); // mazzo che sta guardando il wizard
const saving = ref(false);
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
    outcomes.value = [];
    phase.value = 'list';
  } catch (e) {
    if (stopped) return;
    error.value = failureText(e);
    phase.value = 'idle';
  }
}

/** Dopo ogni mazzo preparato o deciso: mostra il wizard del prossimo mazzo pronto, oppure il riepilogo. */
function step() {
  if (stopped) return;
  while (cursor.value < chosen.value.length) {
    const result = results.value[cursor.value];
    if (!result) {
      phase.value = 'importing';
      return;
    }
    if (result.status === 'ready') {
      phase.value = 'wizard';
      return;
    }
    cursor.value++;
  }
  phase.value = 'done';
}

/** Prepara i mazzi uno dopo l'altro (le richieste all'Action non vanno in parallelo). */
async function prepareAll() {
  for (const [index, entry] of chosen.value.entries()) {
    const result = await prepareDeck({
      entry,
      requestDeck: (url) => ask('archidekt', url),
      lookup: (names) => scryfall.lookup(names),
      requestCombos: (deckJson) => ask('spellbook', deckJson),
    });
    if (stopped) return;
    results.value[index] = result;
    if (result.status !== 'ready') outcomes.value.push(result);
    progress.value = { done: index + 1, total: chosen.value.length };
    step();
  }
}

function importSelected() {
  chosen.value = decks.value.filter((d) => selected.value.includes(d.id));
  if (!chosen.value.length) return;
  error.value = '';
  outcomes.value = [];
  results.value = [];
  cursor.value = 0;
  progress.value = { done: 0, total: chosen.value.length };
  phase.value = 'importing';
  prepareAll();
}

const current = computed(() => results.value[cursor.value]);
const preparing = computed(() => progress.value.done < progress.value.total);

function decided(outcome) {
  outcomes.value.push(outcome);
  cursor.value++;
  step();
}

async function confirmDeck(choice) {
  const prepared = current.value;
  saving.value = true;
  try {
    const { deck, version } = buildPreparedDeck(prepared, choice, new Date().toISOString());
    const saved = await data.write('saveDeck', deck);
    await data.write('saveDeckVersion', saved.id, version);
    decided({ name: prepared.entry.name, status: 'imported' });
  } catch (e) {
    decided({ name: prepared.entry.name, status: 'failed', reason: e?.message || '' });
  } finally {
    saving.value = false;
  }
}

const skipDeck = () => decided({ name: current.value.entry.name, status: 'skipped' });

const reasonText = (outcome) => {
  if (outcome.status === 'review') {
    return outcome.reason?.includes('not-found') ? t.reviewNotFound : t.reviewNoCommander;
  }
  if (outcome.status === 'skipped') return t.skipped;
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
        </li>
      </ul>
      <p class="muted">{{ t.wizardHelp }}</p>

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

    <template v-else-if="phase === 'wizard' && current">
      <p class="wizard-progress" role="status" data-testid="wizard-progress">
        {{ t.wizardOf(cursor + 1, chosen.length, current.name) }}
      </p>
      <DeckWizard
        :key="cursor"
        :game-changers="current.gameChangers"
        :combos="current.combos"
        :suspects="current.suspects"
        :busy="saving"
        :back-label="t.skipDeck"
        @back="skipDeck"
        @confirm="confirmDeck"
      />
      <p v-if="preparing" class="muted" role="status" aria-live="polite">
        {{ t.preparingOthers(progress.done, progress.total) }}
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

.wizard-progress {
  margin: 0;
  padding: 8px 12px;
  border-left: 4px solid var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius-sm);
  font-weight: 700;
  overflow-wrap: anywhere;
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

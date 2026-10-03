<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { archidektDeckId } from '../domain/archidekt-link.js';
import { buildDeckFromImport, checkImport } from '../domain/deck-import.js';
import {
  commanderNames,
  deckCards,
  mergeDuplicates,
  parseDeckText,
  toggleCommander,
} from '../domain/deck-parser.js';
import { findDeckCombos, wizardInput } from '../domain/deck-features.js';
import DeckWizard from '../components/DeckWizard.vue';
import ImportArchidektUser from '../components/ImportArchidektUser.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { it } from '../i18n/it.js';
import { requestAndWait } from '../domain/import-request.js';
import { cardKey, createScryfall } from '../platform/scryfall.js';
import { useDataStore } from '../stores/data.js';

const t = it.importDeck;
const data = useDataStore();
const router = useRouter();
const scryfall = createScryfall();

const POLL_MS = 3000;
const POLL_LIMIT = 70; // circa 3 minuti e mezzo

const source = ref('text'); // text | archidekt
const archidektUrl = ref('');
const sourceUrl = ref(''); // link usato per il mazzo che si sta guardando
const name = ref('');
const text = ref('');
const step = ref('edit'); // edit | waiting | reading | preview | analyzing | wizard | saving
const combos = ref(null); // combo a due carte; null = Commander Spellbook non ha risposto
const error = ref('');
watch(source, () => {
  sourceUrl.value = '';
});
let stopped = false;
onBeforeUnmount(() => {
  stopped = true;
});
const lines = ref([]);
const lookup = ref(null);

const cards = computed(() => mergeDuplicates(deckCards(lines.value)));
const commanders = computed(() => commanderNames(lines.value));
const notFound = computed(() =>
  (lookup.value?.notFound ?? []).filter((n) =>
    cards.value.some((c) => cardKey(c.name) === cardKey(n)),
  ),
);
const wizardData = computed(() =>
  lookup.value
    ? wizardInput(cards.value, lookup.value)
    : { gameChangers: [], suspects: { massLand: [], extraTurns: [] } },
);
const gameChangerNames = computed(() => wizardData.value.gameChangers);
const gameChangers = computed(() => gameChangerNames.value.length);
const suspects = computed(() => wizardData.value.suspects);
const check = computed(() => checkImport(lines.value, lookup.value));
const isCommander = (card) => card.section === 'commander';

async function read() {
  error.value = '';
  const parsed = parseDeckText(text.value);
  if (!parsed.length) {
    error.value = t.reasons.empty;
    return;
  }
  step.value = 'reading';
  try {
    lookup.value = await scryfall.lookup(deckCards(parsed).map((l) => l.name));
    lines.value = parsed;
    step.value = 'preview';
  } catch {
    error.value = t.readFailed;
    step.value = 'edit';
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Chiede il mazzo all'Action `import` e aspetta l'esito, poi prosegue come per il testo incollato. */
async function fetchArchidekt() {
  error.value = '';
  const url = archidektUrl.value.trim();
  if (!archidektDeckId(url)) {
    error.value = t.archidektInvalid;
    return;
  }
  step.value = 'waiting';
  try {
    const request = await data.write('requestImport', 'archidekt', url);
    for (let i = 0; i < POLL_LIMIT && !stopped; i++) {
      const state = await data.getImportRequest(request.id);
      if (state.status === 'done') {
        sourceUrl.value = url;
        name.value = state.deckName ?? ''; // il nome è quello di Archidekt
        text.value = state.result;
        await read();
        return;
      }
      if (state.status === 'error') {
        error.value = t.archidektFailed(String(state.error ?? '').replace(/\.$/, ''));
        step.value = 'edit';
        return;
      }
      await wait(POLL_MS);
    }
    if (!stopped) {
      error.value = t.archidektTimeout;
      step.value = 'edit';
    }
  } catch {
    error.value = t.archidektRequestFailed;
    step.value = 'edit';
  }
}

const submit = () => {
  if (source.value === 'archidekt') return fetchArchidekt();
  if (source.value === 'text') return read();
};

const toggle = (card) => {
  lines.value = toggleCommander(lines.value, card.name);
};

/** Cerca le combo e apre il wizard. Se Spellbook non risponde, il wizard le fa dichiarare a mano. */
async function analyze() {
  if (!check.value.ok) return;
  error.value = '';
  step.value = 'analyzing';
  // Dal browser Spellbook non risponde (CORS): la richiesta passa dall'Action `import`, come Archidekt.
  combos.value = await findDeckCombos({
    commanders: commanders.value,
    cards: cards.value,
    lookup: lookup.value,
    request: (deckJson) =>
      requestAndWait({
        create: (s, u) => data.write('requestImport', s, u),
        get: (id) => data.getImportRequest(id),
        source: 'spellbook',
        url: deckJson,
        wait,
        pollMs: POLL_MS,
        limit: POLL_LIMIT,
        isStopped: () => stopped,
      }),
  });
  step.value = 'wizard';
}

async function save({ declaredTier, assessment }) {
  if (!check.value.ok) return;
  step.value = 'saving';
  error.value = '';
  try {
    const { deck, version } = buildDeckFromImport({
      name: name.value.trim() || commanders.value[0],
      lines: lines.value,
      lookup: lookup.value,
      declaredTier,
      assessment,
      importedAt: new Date().toISOString(),
      sourceUrl: sourceUrl.value || undefined,
    });
    const saved = await data.write('saveDeck', deck);
    await data.write('saveDeckVersion', saved.id, version);
    await router.push('/mazzi');
  } catch {
    error.value = t.saveFailed;
    step.value = 'wizard';
  }
}
</script>

<template>
  <div class="stack">
    <header>
      <h1>{{ it.pages.importDeck.title }}</h1>
      <p class="muted lead">{{ t.intro }}</p>
    </header>

    <form
      v-if="step === 'edit' || step === 'reading' || step === 'waiting'"
      class="card stack import-card"
      @submit.prevent="submit"
    >
      <fieldset class="choice" :disabled="step !== 'edit'">
        <legend class="choice__legend">{{ t.sourceLabel }}</legend>
        <label class="choice__option">
          <input v-model="source" type="radio" name="importSource" value="text" />
          <span>{{ t.sourceText }}</span>
        </label>
        <label class="choice__option">
          <input v-model="source" type="radio" name="importSource" value="archidekt" />
          <span>{{ t.sourceArchidekt }}</span>
        </label>
        <label class="choice__option">
          <input v-model="source" type="radio" name="importSource" value="archidekt-user" />
          <span>{{ t.sourceUser }}</span>
        </label>
      </fieldset>
      <label v-if="source === 'text'" class="field">
        <span>{{ t.nameLabel }}</span>
        <input v-model="name" type="text" name="deckName" autocomplete="off" />
        <small class="muted">{{ t.nameHelp }}</small>
      </label>
      <label v-if="source === 'archidekt'" class="field">
        <span>{{ t.archidektLabel }}</span>
        <input
          v-model="archidektUrl"
          type="url"
          name="archidektUrl"
          inputmode="url"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <small v-if="step !== 'waiting'" class="muted">{{ t.archidektHelp }}</small>
      </label>
      <label v-else-if="source === 'text'" class="field">
        <span>{{ t.textLabel }}</span>
        <textarea
          v-model="text"
          name="deckText"
          rows="10"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        ></textarea>
        <small class="muted">{{ t.textHelp }}</small>
      </label>
      <ImportArchidektUser v-if="source === 'archidekt-user'" />
      <p
        v-if="error && source !== 'archidekt-user'"
        class="notice notice--error"
        role="alert"
        data-testid="import-error"
      >
        {{ error }}
      </p>
      <p v-if="step === 'reading'" role="status">{{ t.reading }}</p>
      <p
        v-if="step === 'waiting' && source === 'archidekt'"
        class="import-waiting"
        role="status"
        aria-live="polite"
        data-testid="import-waiting"
      >
        <span class="import-waiting__spinner" aria-hidden="true"></span>
        {{ t.archidektWaiting }}
      </p>
      <template v-if="source === 'archidekt'">
        <p v-if="!archidektUrl.trim()" class="muted">{{ t.archidektRequired }}</p>
        <button type="submit" class="btn" :disabled="step !== 'edit' || !archidektUrl.trim()">
          {{ step === 'waiting' ? t.archidektReading : t.archidektRead }}
        </button>
      </template>
      <template v-else-if="source === 'text'">
        <p v-if="!text.trim()" class="muted">{{ t.textRequired }}</p>
        <button type="submit" class="btn" :disabled="step !== 'edit' || !text.trim()">
          {{ t.read }}
        </button>
      </template>
    </form>

    <p v-else-if="step === 'analyzing'" role="status" data-testid="import-analyzing">
      {{ t.analyzing }}
    </p>

    <div v-else-if="step === 'wizard' || step === 'saving'" class="stack">
      <DeckWizard
        :game-changers="gameChangerNames"
        :combos="combos"
        :suspects="suspects"
        :busy="step === 'saving'"
        @back="step = 'preview'"
        @confirm="save"
      />
      <p v-if="step === 'saving'" role="status">{{ t.saving }}</p>
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
    </div>

    <section v-else class="stack" data-testid="import-preview" :aria-label="t.previewTitle">
      <div v-if="notFound.length" class="notice notice--error" role="alert" data-testid="not-found">
        <strong>{{ t.notFoundTitle }}</strong>
        <p>{{ t.notFoundHelp }}</p>
        <ul>
          <li v-for="n in notFound" :key="n">{{ n }}</li>
        </ul>
      </div>

      <div class="card stack" data-testid="commanders">
        <h2>{{ t.commandersTitle }}</h2>
        <p v-if="!commanders.length" class="muted">{{ t.commandersEmpty }}</p>
        <ul v-else class="chips">
          <li v-for="c in commanders" :key="c" class="chip">{{ c }}</li>
        </ul>
        <p class="muted">{{ t.commandersHelp }}</p>
      </div>

      <div class="card stack">
        <h2>{{ t.cardsTitle }}</h2>
        <p class="muted">
          {{ t.cardCount(cards.reduce((sum, c) => sum + c.qty, 0)) }} ·
          {{ t.gameChangersFound(gameChangers) }}
        </p>
        <ul class="card-list">
          <li
            v-for="card in cards"
            :key="card.name"
            class="card-row"
            :class="{ 'card-row--commander': isCommander(card) }"
            data-testid="card-row"
            @dblclick="toggle(card)"
          >
            <span class="card-row__name">
              <span class="muted">{{ card.qty }}×</span> {{ card.name }}
              <span
                v-if="lookup.cards[cardKey(card.name)]?.isGameChanger"
                class="chip chip--accent"
                >{{ t.gameChanger }}</span
              >
            </span>
            <button
              type="button"
              class="btn btn--secondary crown-btn"
              :aria-label="t.setCommander"
              :aria-pressed="isCommander(card)"
              :title="isCommander(card) ? t.unsetCommander : t.setCommander"
              @click="toggle(card)"
            >
              <AppIcon name="crown" :size="22" />
            </button>
          </li>
        </ul>
      </div>

      <ul v-if="!check.ok" class="notice notice--error reasons" data-testid="import-reasons">
        <li v-for="reason in check.reasons" :key="reason">{{ t.reasons[reason] }}</li>
      </ul>
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <div class="actions">
        <button type="button" class="btn btn--secondary" @click="step = 'edit'">
          {{ t.back }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!check.ok"
          data-testid="to-wizard"
          @click="analyze"
        >
          {{ t.next }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
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

.import-card {
  max-width: 70ch;
}
.field {
  display: grid;
  gap: 0.375rem;
  font-weight: 600;
}
.field small {
  font-weight: 400;
}
.field input,
.field textarea,
.field select {
  color-scheme: light dark;
  color-scheme: light dark;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.field textarea {
  font-family: ui-monospace, monospace;
  resize: vertical;
}
.chips,
.card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.card-list {
  display: grid;
  gap: 0.25rem;
}
.chip {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-weight: 600;
}
.chip--accent {
  margin-left: 0.5rem;
  font-size: 0.8em;
}
.card-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border);
}
.card-row__name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.crown-btn {
  flex: none;
  width: var(--tap);
  min-width: var(--tap);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.crown-btn[aria-pressed='true'] {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
}
.crown-btn[aria-pressed='true'] :deep(path:first-child) {
  fill: currentColor;
}
.reasons {
  margin: 0;
  padding-left: 1.5rem;
}
.card-row--commander {
  font-weight: 700;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { buildDeckFromImport, checkImport } from '../domain/deck-import.js';
import {
  commanderNames,
  deckCards,
  mergeDuplicates,
  parseDeckText,
  toggleCommander,
} from '../domain/deck-parser.js';
import AppIcon from '../components/ui/AppIcon.vue';
import { it } from '../i18n/it.js';
import { cardKey, createScryfall } from '../platform/scryfall.js';
import { useDataStore } from '../stores/data.js';

const t = it.importDeck;
const data = useDataStore();
const router = useRouter();
const scryfall = createScryfall();

const name = ref('');
const text = ref('');
const declaredTier = ref('F3');
const step = ref('edit'); // edit | reading | preview | saving
const error = ref('');
const lines = ref([]);
const lookup = ref(null);

const cards = computed(() => mergeDuplicates(deckCards(lines.value)));
const commanders = computed(() => commanderNames(lines.value));
const notFound = computed(() =>
  (lookup.value?.notFound ?? []).filter((n) =>
    cards.value.some((c) => cardKey(c.name) === cardKey(n)),
  ),
);
const gameChangers = computed(
  () => cards.value.filter((c) => lookup.value?.cards[cardKey(c.name)]?.isGameChanger).length,
);
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

const toggle = (card) => {
  lines.value = toggleCommander(lines.value, card.name);
};

async function save() {
  if (!check.value.ok) return;
  step.value = 'saving';
  error.value = '';
  try {
    const { deck, version } = buildDeckFromImport({
      name: name.value.trim() || commanders.value[0],
      lines: lines.value,
      lookup: lookup.value,
      declaredTier: declaredTier.value,
      importedAt: new Date().toISOString(),
    });
    const saved = await data.write('saveDeck', deck);
    await data.write('saveDeckVersion', saved.id, version);
    await router.push('/mazzi');
  } catch {
    error.value = t.saveFailed;
    step.value = 'preview';
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
      v-if="step === 'edit' || step === 'reading'"
      class="card stack import-card"
      @submit.prevent="read"
    >
      <label class="field">
        <span>{{ t.nameLabel }}</span>
        <input v-model="name" type="text" name="deckName" autocomplete="off" />
        <small class="muted">{{ t.nameHelp }}</small>
      </label>
      <label class="field">
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
      <label class="field">
        <span>{{ t.tierLabel }}</span>
        <select v-model="declaredTier" name="declaredTier">
          <option v-for="tier in ['F1', 'F2', 'F3', 'F4', 'F5']" :key="tier" :value="tier">
            {{ tier }}
          </option>
        </select>
        <small class="muted">{{ t.tierHelp }}</small>
      </label>
      <p v-if="error" class="notice notice--error" role="alert" data-testid="import-error">
        {{ error }}
      </p>
      <p v-if="step === 'reading'" role="status">{{ t.reading }}</p>
      <p v-if="!text.trim()" class="muted">{{ t.textRequired }}</p>
      <button type="submit" class="btn" :disabled="step === 'reading' || !text.trim()">
        {{ t.read }}
      </button>
    </form>

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
      <p v-if="step === 'saving'" role="status">{{ t.saving }}</p>
      <div class="actions">
        <button
          type="button"
          class="btn btn--secondary"
          :disabled="step === 'saving'"
          @click="step = 'edit'"
        >
          {{ t.back }}
        </button>
        <button type="button" class="btn" :disabled="!check.ok || step === 'saving'" @click="save">
          {{ t.save }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
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

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useOverlay } from '../composables/use-overlay.js';
import {
  combosOfCard,
  detailCards,
  groupCards,
  GROUP_BY,
  SORT_BY,
  UNKNOWN,
} from '../domain/deck-cards.js';
import { it } from '../i18n/it.js';
import { readStorage, writeStorage } from '../platform/storage.js';
import { watchMinWidth } from '../platform/viewport.js';
import CardDetail from './CardDetail.vue';
import CardImage from './CardImage.vue';
import AppModal from './ui/AppModal.vue';

/** Le carte di un mazzo in quattro viste, con raggruppamento, ordine e filtro (C-08c). */
const props = defineProps({
  /** Carte della versione salvata: `{ name, qty, scryfallId?, isGameChanger? }`. */
  cards: { type: Array, required: true },
  /** Combo salvate nella versione: `{ cards: string[], produces?: string[] }`. */
  combos: { type: Array, default: () => [] },
  /** Dati di Scryfall per id (vedi `useCardData`). */
  info: { type: Object, required: true },
  /** `loading`, `ready` o `failed`. */
  dataState: { type: String, default: 'ready' },
});
const t = it.deckCards;

const STORAGE_KEY = 'bracketeer.deck-cards';
const VIEWS = ['piles', 'list', 'grid', 'table'];

const media = watchMinWidth(768, (value) => {
  wide.value = value;
});
const wide = ref(media.wide);
onBeforeUnmount(media.stop);

function saved() {
  try {
    return JSON.parse(readStorage(STORAGE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}
const stored = saved();
const view = ref(VIEWS.includes(stored.view) ? stored.view : wide.value ? 'piles' : 'list');
const groupBy = ref(GROUP_BY.includes(stored.groupBy) ? stored.groupBy : 'type');
const sortBy = ref(SORT_BY.includes(stored.sortBy) ? stored.sortBy : 'name');
const desc = ref(stored.desc === true);
const query = ref('');
watch([view, groupBy, sortBy, desc], () => {
  writeStorage(
    STORAGE_KEY,
    JSON.stringify({
      view: view.value,
      groupBy: groupBy.value,
      sortBy: sortBy.value,
      desc: desc.value,
    }),
  );
});

// Le pile servono lo spazio di uno schermo largo: sul telefono si usa la lista.
const shownView = computed(() => (view.value === 'piles' && !wide.value ? 'list' : view.value));
const viewOptions = computed(() => (wide.value ? VIEWS : VIEWS.filter((v) => v !== 'piles')));
const selectedView = computed({
  get: () => shownView.value,
  set: (value) => {
    view.value = value;
  },
});

const detailed = computed(() => detailCards(props.cards, props.info));
const groups = computed(() =>
  groupCards(detailed.value, {
    groupBy: groupBy.value,
    sortBy: sortBy.value,
    desc: desc.value,
    query: query.value,
  }),
);
const total = computed(() => props.cards.reduce((sum, c) => sum + (c.qty ?? 1), 0));
const shown = computed(() => groups.value.reduce((sum, g) => sum + g.count, 0));

// Dettaglio di una carta: una sola finestra (`?overlay=card`); le frecce scorrono le carte mostrate.
const overlay = useOverlay('card');
const selectedName = ref(null);
const flat = computed(() => groups.value.flatMap((g) => g.cards));
const selectedIndex = computed(() => flat.value.findIndex((c) => c.name === selectedName.value));
const selected = computed(() => flat.value[selectedIndex.value] ?? null);
const selectedInfo = computed(() =>
  selected.value?.scryfallId ? (props.info[selected.value.scryfallId] ?? null) : null,
);
const selectedCombos = computed(() =>
  selected.value ? combosOfCard(selected.value.name, props.combos) : [],
);
function show(card) {
  selectedName.value = card.name;
  overlay.open();
}
function step(delta) {
  const next = flat.value[selectedIndex.value + delta];
  if (next) selectedName.value = next.name;
}
// Aperta con un link diretto o dopo un ricaricamento non c'è nessuna carta scelta: si richiude.
watch(
  () => [overlay.isOpen.value, selected.value],
  ([open, card]) => {
    if (open && !card) overlay.close();
  },
  { immediate: true },
);

// Ordine e direzione in un solo menu: sul telefono due menu affiancati non entrano.
const SORT_CHOICES = SORT_BY.flatMap((by) => [`${by}-asc`, `${by}-desc`]);
const sortChoice = computed({
  get: () => `${sortBy.value}-${desc.value ? 'desc' : 'asc'}`,
  set: (value) => {
    const [by, direction] = value.split('-');
    sortBy.value = by;
    desc.value = direction === 'desc';
  },
});

function groupName(key) {
  if (key === UNKNOWN) return props.dataState === 'failed' ? t.title : t.unknown;
  if (groupBy.value === 'type') return t.types[key];
  if (groupBy.value === 'color') return t.colors[key];
  return t.cmc(key);
}
const costText = (card) =>
  card.manaCost ? card.manaCost.replace(/\{([^}]+)\}/g, '$1 ').trim() : '—';
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
const colorText = (card) => COLOR_ORDER.filter((c) => card.colors.includes(c)).join(' ') || '—';
</script>

<template>
  <div class="dc" data-testid="deck-cards">
    <div class="dc__controls">
      <label class="dc__field">
        <span>{{ t.viewLabel }}</span>
        <select v-model="selectedView" data-testid="cards-view">
          <option v-for="v in viewOptions" :key="v" :value="v">{{ t.views[v] }}</option>
        </select>
      </label>
      <label class="dc__field">
        <span>{{ t.groupLabel }}</span>
        <select v-model="groupBy" data-testid="cards-group">
          <option v-for="g in GROUP_BY" :key="g" :value="g">{{ t.groups[g] }}</option>
        </select>
      </label>
      <label class="dc__field">
        <span>{{ t.sortLabel }}</span>
        <select v-model="sortChoice" data-testid="cards-sort">
          <option v-for="s in SORT_CHOICES" :key="s" :value="s">{{ t.sorts[s] }}</option>
        </select>
      </label>
      <label class="dc__field dc__search">
        <span>{{ t.search }}</span>
        <input
          v-model="query"
          type="search"
          :placeholder="t.searchPlaceholder"
          autocomplete="off"
          data-testid="cards-search"
        />
      </label>
    </div>

    <p class="muted" data-testid="cards-count">
      {{ query.trim() ? t.countFiltered(shown, total) : t.count(total) }}
    </p>
    <p v-if="dataState === 'failed'" class="muted">{{ t.noData }}</p>
    <p v-if="dataState === 'loading'" class="muted" role="status">{{ t.loading }}</p>
    <p v-else-if="cards.length === 0" class="muted">{{ t.empty }}</p>
    <p v-else-if="groups.length === 0" class="muted" role="status">{{ t.none }}</p>

    <!-- Pile: una colonna per gruppo, carte sovrapposte (si vede la parte alta di ciascuna). -->
    <div
      v-else-if="shownView === 'piles'"
      class="piles"
      role="region"
      :aria-label="t.pilesLabel"
      tabindex="0"
      data-testid="view-piles"
    >
      <section v-for="g in groups" :key="g.key" class="pile" :data-group="g.key">
        <h3 class="dc__heading dc__heading--line" :title="groupName(g.key)">
          {{ groupName(g.key) }} <span class="muted">· {{ g.count }}</span>
        </h3>
        <ul class="pile__list">
          <li v-for="c in g.cards" :key="c.name" class="pile__card" data-testid="card-item">
            <button type="button" class="hit" data-testid="card-open" @click="show(c)">
              <CardImage :scryfall-id="c.scryfallId" :name="c.name" top />
            </button>
            <span v-if="c.qty > 1" class="qty-badge">×{{ c.qty }}</span>
          </li>
        </ul>
      </section>
    </div>

    <!-- Lista: un gruppo apribile per volta, righe compatte. -->
    <div v-else-if="shownView === 'list'" class="lists" data-testid="view-list">
      <details v-for="g in groups" :key="g.key" class="dc__group" open :data-group="g.key">
        <summary>
          <span class="dc__heading">{{ groupName(g.key) }}</span>
          <span class="muted">{{ g.count }}</span>
        </summary>
        <ul class="rows">
          <li v-for="c in g.cards" :key="c.name" class="row" data-testid="card-item">
            <button type="button" class="hit row__btn" data-testid="card-open" @click="show(c)">
              <span class="row__qty">{{ c.qty }}×</span>
              <span class="row__name">{{ c.name }}</span>
              <span class="row__cost muted">{{ costText(c) }}</span>
            </button>
          </li>
        </ul>
      </details>
    </div>

    <!-- Griglia: le immagini delle carte. -->
    <div v-else-if="shownView === 'grid'" class="grids" data-testid="view-grid">
      <section v-for="g in groups" :key="g.key" :data-group="g.key">
        <h3 class="dc__heading">
          {{ groupName(g.key) }} <span class="muted">· {{ g.count }}</span>
        </h3>
        <ul class="grid">
          <li v-for="c in g.cards" :key="c.name" class="grid__card" data-testid="card-item">
            <button type="button" class="hit" data-testid="card-open" @click="show(c)">
              <CardImage :scryfall-id="c.scryfallId" :name="c.name" />
            </button>
            <span v-if="c.qty > 1" class="qty-badge">×{{ c.qty }}</span>
          </li>
        </ul>
      </section>
    </div>

    <!-- Tabella: su telefono ogni riga diventa una scheda. -->
    <div v-else class="tables" data-testid="view-table">
      <table v-for="g in groups" :key="g.key" class="table" :data-group="g.key">
        <caption class="dc__heading">
          {{
            groupName(g.key)
          }}
          <span class="muted">· {{ g.count }}</span>
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ t.cols.qty }}</th>
            <th scope="col">{{ t.cols.name }}</th>
            <th scope="col">{{ t.cols.type }}</th>
            <th scope="col">{{ t.cols.cmc }}</th>
            <th scope="col">{{ t.cols.colors }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in g.cards" :key="c.name" data-testid="card-item">
            <td :data-label="t.cols.qty">{{ c.qty }}</td>
            <th scope="row" :data-label="t.cols.name">
              <button type="button" class="hit hit--text" data-testid="card-open" @click="show(c)">
                {{ c.name }}
              </button>
            </th>
            <td :data-label="t.cols.type">{{ c.typeLine || '—' }}</td>
            <td :data-label="t.cols.cmc">{{ costText(c) }}</td>
            <td :data-label="t.cols.colors">{{ colorText(c) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppModal name="card" :title="selected?.name ?? ''">
      <CardDetail v-if="selected" :card="selected" :info="selectedInfo" :combos="selectedCombos" />
      <template #footer>
        <div v-if="selected" class="dc__pager">
          <button
            type="button"
            class="btn btn--secondary"
            data-testid="card-prev"
            :disabled="selectedIndex <= 0"
            @click="step(-1)"
          >
            {{ t.detail.prev }}
          </button>
          <span class="muted" data-testid="card-position">{{
            t.detail.position(selectedIndex + 1, flat.length)
          }}</span>
          <button
            type="button"
            class="btn btn--secondary"
            data-testid="card-next"
            :disabled="selectedIndex >= flat.length - 1"
            @click="step(1)"
          >
            {{ t.detail.next }}
          </button>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.dc {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.dc__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: end;
}

.dc__field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
  font-weight: 600;
}

.dc__field select,
.dc__field input {
  width: 100%;
  min-width: 0;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  font-weight: 400;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--text-muted);
  border-radius: var(--radius-sm);
  color-scheme: light dark;
}

.dc__search {
  grid-column: 1 / -1;
}

.dc__field input::placeholder {
  color: var(--text-muted);
  opacity: 1;
}

@media (min-width: 768px) {
  .dc__controls {
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }

  .dc__search {
    grid-column: auto;
  }
}

.dc__heading--line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc__heading {
  margin: 0;
  font-family: var(--font-body, inherit);
  font-size: 1rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
}

/* Pile */
.piles:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

.piles {
  display: flex;
  gap: 1rem;
  padding-bottom: 0.75rem;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}

.pile {
  flex: none;
  width: 9.125rem;
  scroll-snap-align: start;
}

.pile__list {
  padding: 0;
  margin: 0.5rem 0 0;
  list-style: none;
}

.pile__card {
  position: relative;
  height: 2.75rem;
  overflow: hidden;
  border-radius: 8px 8px 0 0;
}

.pile__card:last-child {
  height: auto;
  border-radius: 8px;
}

.qty-badge {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  padding: 0 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 999px;
}

/* Lista */
.lists {
  display: grid;
  gap: 0.5rem;
}

.dc__group {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.dc__group summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: var(--tap);
  padding: 0.25rem 0.75rem;
  cursor: pointer;
}

.rows {
  padding: 0 0.75rem 0.5rem;
  margin: 0;
  list-style: none;
}

.row {
  border-top: 1px solid var(--border);
}

.row__btn {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  min-height: var(--tap);
}

/* Ogni carta è un pulsante: tutta la sua area (riga, striscia, immagine) si può toccare. */
.hit {
  display: block;
  width: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: inherit;
}

.hit:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: -3px;
}

.hit--text {
  min-height: var(--tap);
  font-weight: inherit;
  overflow-wrap: anywhere;
}

.pile__card .hit {
  height: 100%;
}

.dc__pager {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  width: 100%;
}

/* Il contatore sta in una riga sopra i due pulsanti, che si dividono la larghezza. */
.dc__pager > span {
  flex: 1 0 100%;
  order: -1;
  text-align: center;
  white-space: nowrap;
}

.dc__pager > .btn {
  flex: 1 1 0;
  min-width: 0;
}

.row__qty {
  font-variant-numeric: tabular-nums;
}

.row__name {
  overflow-wrap: anywhere;
}

/* Griglia */
.grids {
  display: grid;
  gap: 1.25rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 0;
  margin: 0.5rem 0 0;
  list-style: none;
}

.grid__card {
  position: relative;
}

@media (min-width: 576px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  }
}

/* Tabella */
.tables {
  display: grid;
  gap: 1.25rem;
}

.table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.table th:nth-child(1),
.table td:nth-child(1) {
  width: 4rem;
}

.table th:nth-child(4),
.table td:nth-child(4) {
  width: 7rem;
}

.table th:nth-child(5),
.table td:nth-child(5) {
  width: 6rem;
}

.table caption {
  padding-bottom: 0.5rem;
  text-align: left;
}

.table th,
.table td {
  padding: 0.5rem;
  text-align: left;
  border-top: 1px solid var(--border);
}

@media (max-width: 767px) {
  .table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .table tr {
    display: grid;
    gap: 0.25rem;
    padding: 0.5rem 0;
    border-top: 1px solid var(--border);
  }

  .table th,
  .table td {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0 0.5rem;
    border: 0;
  }

  .table th[scope='row'] {
    order: -1;
    justify-content: flex-start;
    font-size: 1rem;
    font-weight: 700;
  }

  .table th[scope='row']::before {
    content: none;
  }

  .table td::before {
    content: attr(data-label);
    color: var(--text-muted);
    font-weight: 400;
  }
}
</style>

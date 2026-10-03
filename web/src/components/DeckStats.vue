<script setup>
import { computed, ref } from 'vue';
import { detailCards } from '../domain/deck-cards.js';
import {
  colorBalance,
  COLORS,
  curveByColor,
  CURVE_MAX,
  deckSize,
  drawOdds,
  MANA_COLORS,
  manaCurve,
  SALT_BUCKETS,
  SALT_MAX,
  saltSummary,
  typeBreakdown,
} from '../domain/deck-metrics.js';
import { it } from '../i18n/it.js';
import BarChart from './BarChart.vue';

/** Statistiche del mazzo a schede: panoramica, curva di mana, colori e probabilità di pescata (C-08g). */
const props = defineProps({
  /** Carte della versione salvata: `{ name, qty, scryfallId?, isGameChanger? }`. */
  cards: { type: Array, required: true },
  /** Dati di Scryfall per id (vedi `useCardData`). */
  info: { type: Object, required: true },
  /** `loading`, `ready` o `failed`. */
  dataState: { type: String, default: 'ready' },
  /** Salt score per carta (nome → punteggio EDHREC 0–4), se il mazzo viene da Archidekt. */
  salt: { type: Object, default: () => ({}) },
});
const t = it.deckStats;
const names = it.deckCards;

const TABS = ['overview', 'curve', 'colors', 'draw', 'salt'];
const tab = ref('overview');
function onTabKey(event, index) {
  const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (!move) return;
  event.preventDefault();
  tab.value = TABS[(index + move + TABS.length) % TABS.length];
  document.getElementById(`stats-tab-${tab.value}`)?.focus();
}

const detailed = computed(() => detailCards(props.cards, props.info));
const size = computed(() => deckSize(detailed.value));
const unknownCount = computed(() =>
  detailed.value.filter((c) => !c.known).reduce((sum, c) => sum + (c.qty ?? 1), 0),
);
const curve = computed(() => manaCurve(detailed.value));
const byColor = computed(() => curveByColor(detailed.value));
const balance = computed(() => colorBalance(detailed.value));
const types = computed(() => typeBreakdown(detailed.value));
const knownTotal = computed(() => types.value.reduce((sum, row) => sum + row.count, 0));
const lands = computed(() => types.value.find((row) => row.type === 'Land')?.count ?? 0);
const gameChangers = computed(() =>
  props.cards.filter((c) => c.isGameChanger).reduce((sum, c) => sum + (c.qty ?? 1), 0),
);

const saltInfo = computed(() => saltSummary(detailed.value, props.salt));
const saltItems = computed(() =>
  SALT_BUCKETS.map((bucket, i) => ({
    label: t.saltBuckets[bucket.key],
    value: saltInfo.value.buckets[i],
  })),
);
const saltLabel = computed(() => t.saltSummary(saltItems.value));
const saltPercent = (value) => Math.round((value / SALT_MAX) * 100);

const curveItems = (counts) =>
  counts.map((value, i) => ({ label: i === CURVE_MAX ? `${CURVE_MAX}+` : String(i), value }));
const curveLabel = computed(() => t.curveSummary(curve.value.counts));
const colorCurves = computed(() =>
  MANA_COLORS.filter((c) => byColor.value[c].some((n) => n > 0)).map((c) => ({
    color: c,
    items: curveItems(byColor.value[c]),
    total: byColor.value[c].reduce((a, b) => a + b, 0),
  })),
);

const BAR_COLORS = {
  W: '#d9c25a',
  U: '#4f93d8',
  B: '#80808f',
  R: '#d9534f',
  G: '#3fa66a',
  C: '#9a9aa6',
};
const totalPips = computed(() => COLORS.reduce((sum, c) => sum + balance.value[c].pips, 0));
const totalSources = computed(() =>
  MANA_COLORS.reduce((sum, c) => sum + balance.value[c].sources, 0),
);
const percent = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

// Probabilità di pescata.
const mode = ref('atLeast');
const by = ref('type');
const wanted = ref(1);
const draws = ref(7);
const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const odds = computed(() =>
  drawOdds(detailed.value, {
    by: by.value,
    mode: mode.value,
    wanted: clamp(Math.floor(wanted.value), 0, 99),
    draws: clamp(Math.floor(draws.value), 1, Math.max(1, size.value)),
  }),
);
const categoryName = (key) => {
  if (key === 'gameChanger') return names.gameChanger;
  if (by.value === 'type') return names.types[key];
  if (by.value === 'color') return names.colors[key];
  return t.cmcLabel(key);
};
const oddsText = (value) => {
  const pct = value * 100;
  if (pct > 0 && pct < 0.5) return t.lessThanOne;
  if (pct > 99.5 && pct < 100) return t.moreThan99;
  return `${Math.round(pct)}%`;
};
</script>

<template>
  <div class="stats" data-testid="deck-stats">
    <p v-if="dataState === 'loading'" class="muted" role="status">{{ names.loading }}</p>
    <p v-else-if="dataState === 'failed'" class="muted">{{ t.noData }}</p>
    <p v-if="unknownCount > 0 && dataState !== 'loading'" class="muted" data-testid="stats-unknown">
      {{ t.unknownNote(unknownCount) }}
    </p>

    <div class="tabs" role="tablist" :aria-label="t.tabsLabel">
      <button
        v-for="(id, index) in TABS"
        :id="`stats-tab-${id}`"
        :key="id"
        type="button"
        role="tab"
        class="tabs__tab"
        :aria-selected="tab === id"
        :aria-controls="`stats-panel-${id}`"
        :tabindex="tab === id ? 0 : -1"
        :data-testid="`stats-tab-${id}`"
        @click="tab = id"
        @keydown="onTabKey($event, index)"
      >
        {{ t.tabs[id] }}
      </button>
    </div>

    <!-- Panoramica -->
    <div
      v-show="tab === 'overview'"
      id="stats-panel-overview"
      role="tabpanel"
      aria-labelledby="stats-tab-overview"
      data-testid="stats-overview"
    >
      <dl class="facts">
        <div>
          <dt>{{ t.cards }}</dt>
          <dd data-testid="stat-cards">{{ size }}</dd>
        </div>
        <div>
          <dt>{{ t.spells }}</dt>
          <dd data-testid="stat-spells">{{ curve.total }}</dd>
        </div>
        <div>
          <dt>{{ t.lands }}</dt>
          <dd data-testid="stat-lands">{{ lands }}</dd>
        </div>
        <div>
          <dt>{{ t.average }}</dt>
          <dd data-testid="stat-average">
            {{ curve.average === null ? '—' : t.decimal(curve.average) }}
          </dd>
        </div>
        <div>
          <dt>{{ names.gameChanger }}</dt>
          <dd data-testid="stat-game-changers">{{ gameChangers }}</dd>
        </div>
        <div>
          <dt>{{ t.saltTotal }}</dt>
          <dd data-testid="stat-salt">
            {{ saltInfo.available ? t.decimal(saltInfo.total) : '—' }}
          </dd>
        </div>
      </dl>
      <h3>{{ t.typesTitle }}</h3>
      <ul class="rows">
        <li v-for="row in types" :key="row.type" class="rows__item" data-testid="stat-type">
          <span class="rows__name">{{ names.types[row.type] }}</span>
          <span class="meter" aria-hidden="true">
            <span
              class="meter__fill"
              :style="{ width: `${percent(row.count, knownTotal)}%` }"
            ></span>
          </span>
          <strong class="rows__value">{{ row.count }}</strong>
        </li>
      </ul>
    </div>

    <!-- Curva di mana -->
    <div
      v-show="tab === 'curve'"
      id="stats-panel-curve"
      role="tabpanel"
      aria-labelledby="stats-tab-curve"
      data-testid="stats-curve"
    >
      <p class="muted">{{ t.curveIntro }}</p>
      <div class="chart">
        <BarChart :items="curveItems(curve.counts)" :label="curveLabel" />
      </div>
      <h3>{{ t.curveByColor }}</h3>
      <div class="small-multiples">
        <figure v-for="c in colorCurves" :key="c.color" class="small">
          <figcaption>
            {{ names.colors[c.color] }} <span class="muted">· {{ c.total }}</span>
          </figcaption>
          <BarChart
            :items="c.items"
            :color="BAR_COLORS[c.color]"
            :label="`${names.colors[c.color]}: ${t.curveSummary(byColor[c.color])}`"
            compact
          />
        </figure>
      </div>
    </div>

    <!-- Colori -->
    <div
      v-show="tab === 'colors'"
      id="stats-panel-colors"
      role="tabpanel"
      aria-labelledby="stats-tab-colors"
      data-testid="stats-colors"
    >
      <p class="muted">{{ t.colorsIntro }}</p>
      <ul class="colors">
        <li
          v-for="c in MANA_COLORS"
          :key="c"
          class="colors__item"
          :data-color="c"
          data-testid="stat-color"
        >
          <h3 class="colors__name">{{ names.colors[c] }}</h3>
          <div v-if="c !== 'C'" class="colors__row">
            <span class="colors__label">{{ t.cost }}</span>
            <span class="meter" aria-hidden="true">
              <span
                class="meter__fill"
                :style="{
                  width: `${percent(balance[c].pips, totalPips)}%`,
                  background: BAR_COLORS[c],
                }"
              ></span>
            </span>
            <span class="colors__value" data-testid="color-cost">
              {{ percent(balance[c].pips, totalPips) }}% ·
              {{ t.pips(balance[c].pips, balance[c].costCards) }}
            </span>
          </div>
          <div class="colors__row">
            <span class="colors__label">{{ t.production }}</span>
            <span class="meter" aria-hidden="true">
              <span
                class="meter__fill"
                :style="{
                  width: `${percent(balance[c].sources, totalSources)}%`,
                  background: BAR_COLORS[c],
                }"
              ></span>
            </span>
            <span class="colors__value" data-testid="color-production">
              {{ percent(balance[c].sources, totalSources) }}% · {{ t.sources(balance[c].sources) }}
            </span>
          </div>
        </li>
      </ul>
    </div>

    <!-- Saltiness -->
    <div
      v-show="tab === 'salt'"
      id="stats-panel-salt"
      role="tabpanel"
      aria-labelledby="stats-tab-salt"
      data-testid="stats-salt"
    >
      <p v-if="!saltInfo.available" class="empty" data-testid="salt-none">{{ t.saltNone }}</p>
      <template v-else>
        <p class="muted">{{ t.saltIntro }}</p>
        <dl class="facts">
          <div>
            <dt>{{ t.saltTotal }}</dt>
            <dd data-testid="salt-total">{{ t.decimal(saltInfo.total) }}</dd>
          </div>
          <div>
            <dt>{{ t.saltAverage }}</dt>
            <dd data-testid="salt-average">{{ t.decimal(saltInfo.average) }}</dd>
          </div>
          <div>
            <dt>{{ t.saltCoverage }}</dt>
            <dd data-testid="salt-covered">{{ saltInfo.covered }} / {{ saltInfo.size }}</dd>
          </div>
        </dl>
        <div class="salt-grid">
          <div>
            <h3>{{ t.saltDistribution }}</h3>
            <div class="chart chart--narrow">
              <BarChart :items="saltItems" :label="saltLabel" :step="64" />
            </div>
          </div>
          <div>
            <h3>{{ t.saltTop }}</h3>
            <ul class="rows rows--salt">
              <li
                v-for="card in saltInfo.top"
                :key="card.name"
                class="rows__item"
                data-testid="salt-top"
              >
                <span class="rows__name rows__name--wide">{{ card.name }}</span>
                <span class="meter" aria-hidden="true">
                  <span class="meter__fill" :style="{ width: `${saltPercent(card.salt)}%` }"></span>
                </span>
                <strong class="rows__value">{{ t.decimal(card.salt) }}</strong>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </div>

    <!-- Probabilità di pescata -->
    <div
      v-show="tab === 'draw'"
      id="stats-panel-draw"
      role="tabpanel"
      aria-labelledby="stats-tab-draw"
      data-testid="stats-draw"
    >
      <div class="draw-controls">
        <label class="field">
          <span>{{ t.probability }}</span>
          <select v-model="mode" data-testid="draw-mode">
            <option value="atLeast">{{ t.modes.atLeast }}</option>
            <option value="exactly">{{ t.modes.exactly }}</option>
            <option value="atMost">{{ t.modes.atMost }}</option>
          </select>
        </label>
        <label class="field">
          <span>{{ t.wanted }}</span>
          <input
            v-model.number="wanted"
            type="number"
            inputmode="numeric"
            min="0"
            max="99"
            data-testid="draw-wanted"
          />
        </label>
        <label class="field">
          <span>{{ t.categoryBy }}</span>
          <select v-model="by" data-testid="draw-by">
            <option value="type">{{ t.by.type }}</option>
            <option value="cmc">{{ t.by.cmc }}</option>
            <option value="color">{{ t.by.color }}</option>
          </select>
        </label>
        <label class="field">
          <span>{{ t.draws }}</span>
          <input
            v-model.number="draws"
            type="number"
            inputmode="numeric"
            min="1"
            :max="Math.max(1, size)"
            data-testid="draw-draws"
          />
        </label>
      </div>
      <p class="muted" data-testid="draw-summary">
        {{ t.drawSummary(t.modes[mode], clamp(Math.floor(wanted), 0, 99), odds.draws, odds.size) }}
      </p>
      <table class="odds">
        <caption class="sr-only">
          {{
            t.oddsCaption
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ t.colCategory }}</th>
            <th scope="col" class="num">{{ t.colQty }}</th>
            <th scope="col" class="num">{{ t.colOdds }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in odds.rows" :key="row.key" data-testid="odds-row" :data-key="row.key">
            <th scope="row">{{ categoryName(row.key) }}</th>
            <td class="num">{{ row.qty }}</td>
            <td class="num" data-testid="odds-value">{{ oddsText(row.odds) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.stats h3 {
  margin: 1rem 0 0.5rem;
  font-family: var(--font-body, inherit);
  font-size: 1rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  max-width: 40rem;
}

/* Cinque schede: su telefono la quinta occupa tutta la riga. */
.tabs__tab:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

@media (min-width: 576px) {
  .tabs {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .tabs__tab:last-child:nth-child(odd) {
    grid-column: auto;
  }
}

.tabs__tab {
  min-height: var(--tap);
  padding: 0.5rem 1rem;
  font: inherit;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.tabs__tab[aria-selected='true'] {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.tabs__tab:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  gap: 1rem;
  margin: 0;
}

/* Su telefono l'ultimo indicatore, se resta solo, occupa tutta la riga. */
@media (max-width: 575px) {
  .facts > div:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
}

.facts dt {
  font-size: 0.9375rem;
  color: var(--text-muted);
}

.facts dd {
  margin: 0.125rem 0 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.rows {
  display: grid;
  max-width: 36rem;
  gap: 0.5rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.rows__item {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr) 2.5rem;
  gap: 0.75rem;
  align-items: center;
}

.rows__value {
  text-align: right;
}

.rows--salt {
  max-width: 44rem;
}

.rows--salt .rows__item {
  grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 3rem;
}

.rows__name--wide {
  overflow-wrap: anywhere;
}

.meter {
  display: block;
  height: 0.75rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--text) 12%, transparent);
  border-radius: 999px;
}

.meter__fill {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
}

.chart {
  max-width: 48rem;
}

.chart--narrow {
  max-width: 18rem;
}

/* Su schermi larghi grafico e carte più salate stanno affiancati. */
.salt-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0 2rem;
}

@media (min-width: 768px) {
  .salt-grid {
    grid-template-columns: 18rem minmax(0, 1fr);
    align-items: start;
  }
}

.empty {
  padding: 1rem;
  margin: 0;
  border: 1px dashed var(--text-muted);
  border-radius: var(--radius-sm);
}

.small-multiples {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 1rem;
}

.small {
  margin: 0;
}

.small figcaption {
  margin-bottom: 0.25rem;
  font-weight: 600;
}

.colors {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.colors__item {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.colors__name {
  margin: 0 0 0.5rem;
}

.colors__row {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.25rem 0.75rem;
  align-items: center;
  margin-top: 0.25rem;
}

.colors__value {
  grid-column: 1 / -1;
  font-size: 0.9375rem;
  color: var(--text-muted);
}

.draw-controls {
  display: grid;
  margin-bottom: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: end;
}

@media (min-width: 768px) {
  .draw-controls {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
  font-weight: 600;
}

.field select,
.field input {
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

.odds {
  width: 100%;
  max-width: 40rem;
  border-collapse: collapse;
}

.odds th,
.odds td {
  padding: 0.5rem;
  text-align: left;
  border-top: 1px solid var(--border);
}

.odds thead th {
  font-size: 0.9375rem;
  color: var(--text-muted);
  border-top: 0;
}

.odds .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>

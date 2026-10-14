<script setup>
import { buildConfig } from '@blesscommander/tier-engine';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { activeFilterCount, filterGames, filterOptions, gameRows } from '../domain/game-history.js';
import { it } from '../i18n/it.js';
import { watchMinWidth } from '../platform/viewport.js';
import { useDataStore } from '../stores/data.js';

const t = it.matches;
const data = useDataStore();

const emptyFilters = () => ({
  from: '',
  to: '',
  deckId: '',
  login: '',
  formatId: '',
  tier: '',
  winType: '',
  result: '',
});
const filters = reactive(emptyFilters());
const reset = () => Object.assign(filters, emptyFilters());

// Su schermo largo i filtri sono già aperti; sul telefono stanno chiusi per non occupare la pagina.
const open = ref(false);
let watcher = null;
onMounted(() => {
  data.loadMembers().catch(() => {});
  watcher = watchMinWidth(768, () => {});
  open.value = watcher.wide;
});
onBeforeUnmount(() => watcher?.stop());

const formatNames = Object.fromEntries(buildConfig({}).formats.map((f) => [f.id, f.nome]));
const formatName = (id) => formatNames[id] ?? id;
const winTypeName = (id) => it.closeGame.winTypes[id] ?? id;
const nameOf = (login) => data.members?.[login]?.displayName ?? login;

const all = computed(() => (data.snapshotWithPending ? gameRows(data.snapshotWithPending) : []));
const options = computed(() => filterOptions(all.value));
const shown = computed(() => filterGames(all.value, filters, data.user?.login ?? ''));
const activeCount = computed(() => activeFilterCount(filters));

const winnersOf = (row) =>
  row.players
    .filter((p) => p.won)
    .map((p) => `${nameOf(p.login)} (${p.deckName})`)
    .join(', ');
</script>

<template>
  <div class="stack matches">
    <header>
      <h1>{{ it.pages.matches.title }}</h1>
      <p class="muted lead">{{ t.intro }}</p>
    </header>

    <p v-if="data.error" class="notice notice--error" role="alert">
      {{ it.dashboard.loadFailed }} {{ data.error }}
    </p>
    <p v-else-if="!data.snapshot" class="muted" role="status">{{ it.dashboard.loading }}</p>

    <section v-else-if="!all.length" class="card empty" data-testid="matches-empty">
      <p>
        <strong>{{ t.empty }}</strong>
      </p>
      <p class="muted">{{ t.emptyHint }}</p>
    </section>

    <template v-else>
      <details class="card filters" :open="open" data-testid="matches-filters">
        <summary class="filters__summary" @click.prevent="open = !open">
          {{ activeCount ? t.filtersActive(activeCount) : t.filters }}
        </summary>
        <div class="filters__grid">
          <label class="field">
            <span>{{ t.from }}</span>
            <input v-model="filters.from" type="date" data-testid="filter-from" />
          </label>
          <label class="field">
            <span>{{ t.to }}</span>
            <input v-model="filters.to" type="date" data-testid="filter-to" />
          </label>
          <label class="field">
            <span>{{ t.deck }}</span>
            <select v-model="filters.deckId" data-testid="filter-deck">
              <option value="">{{ t.all }}</option>
              <option v-for="d in options.decks" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t.player }}</span>
            <select v-model="filters.login" data-testid="filter-player">
              <option value="">{{ t.all }}</option>
              <option v-for="l in options.logins" :key="l" :value="l">{{ nameOf(l) }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t.format }}</span>
            <select v-model="filters.formatId" data-testid="filter-format">
              <option value="">{{ t.all }}</option>
              <option v-for="f in options.formats" :key="f" :value="f">{{ formatName(f) }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t.tier }}</span>
            <select v-model="filters.tier" data-testid="filter-tier">
              <option value="">{{ t.allFem }}</option>
              <option v-for="x in options.tiers" :key="x" :value="x">{{ x }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t.winType }}</span>
            <select v-model="filters.winType" data-testid="filter-wintype">
              <option value="">{{ t.all }}</option>
              <option v-for="w in options.winTypes" :key="w" :value="w">
                {{ winTypeName(w) }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>{{ t.result }}</span>
            <select v-model="filters.result" data-testid="filter-result">
              <option value="">{{ t.allFem }}</option>
              <option value="won">{{ t.won }}</option>
              <option value="lost">{{ t.lost }}</option>
            </select>
          </label>
        </div>
        <div v-if="activeCount" class="actions">
          <button
            type="button"
            class="btn btn--secondary"
            data-testid="filters-reset"
            @click="reset"
          >
            {{ t.reset }}
          </button>
        </div>
      </details>

      <p class="muted" role="status" data-testid="matches-count">
        {{ t.count(shown.length, all.length) }}
      </p>

      <p v-if="!shown.length" class="card empty" data-testid="matches-no-results">
        {{ t.noResults }}
      </p>
      <ul v-else class="list" data-testid="matches-list">
        <li v-for="g in shown" :key="g.id" class="card match" data-testid="match">
          <RouterLink :to="`/partite/${g.id}`" class="match__link" :aria-label="t.open">
            <span class="match__head">
              <strong>{{ g.date }}</strong>
              <span class="muted">{{ formatName(g.formatId) }}</span>
              <span v-if="g.tier" class="tier-badge">{{ g.tier }}</span>
            </span>
            <span class="match__line">
              <strong>{{ t.winner }}:</strong> {{ winnersOf(g) || t.noValue }}
            </span>
            <span class="match__line muted">
              <template v-if="g.turn">{{ t.turn(g.turn, g.estimatedTurn) }}</template>
              <template v-if="g.winType"> · {{ winTypeName(g.winType) }}</template>
            </span>
            <span class="match__chevron" aria-hidden="true">›</span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.matches > header,
.list,
.empty,
.filters {
  max-width: 48rem;
}

.empty {
  display: grid;
  gap: 0.75rem;
  padding: calc(var(--space) * 1.5);
}

.filters {
  display: grid;
  gap: 0.5rem;
  padding: var(--space) calc(var(--space) * 1.5);
}

.filters__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-title);
  font-size: 1.125rem;
  min-height: var(--tap);
  font-weight: 600;
  cursor: pointer;
}

.filters__summary::after {
  content: '▾';
  color: var(--text-muted);
}

.filters:not([open]) .filters__summary::after {
  content: '▸';
}

.filters__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  margin-block: 0.75rem;
}

@media (min-width: 768px) {
  .filters__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--text-muted);
  border-radius: var(--radius-sm);
  color-scheme: light dark;
}

.list {
  display: grid;
  gap: var(--space);
  margin: 0;
  padding: 0;
  list-style: none;
}

.match {
  padding: 0;
}

.match__link {
  position: relative;
  display: grid;
  gap: 0.375rem;
  min-height: var(--tap);
  padding: calc(var(--space) * 1.25) 3rem calc(var(--space) * 1.25) calc(var(--space) * 1.25);
  color: inherit;
  text-decoration: none;
}

.match__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.match__chevron {
  position: absolute;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  font-size: 1.75rem;
  color: var(--text-muted);
}

.match__link:hover,
.match__link:focus-visible {
  background: var(--accent-soft);
  border-radius: var(--radius);
}

.match__line {
  overflow-wrap: anywhere;
}
</style>

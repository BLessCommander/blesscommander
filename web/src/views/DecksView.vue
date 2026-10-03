<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import DeckResync from '../components/DeckResync.vue';
import { filterGroups, groupDecksByOwner } from '../domain/deck-groups.js';
import { sortedDecks } from '../domain/snapshot-stats.js';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const t = it.decks;
const data = useDataStore();
const decks = computed(() =>
  data.snapshotWithPending ? sortedDecks(data.snapshotWithPending) : [],
);
// L'aggiornamento da Archidekt serve ai mazzi importati da lì, a chi li ha importati o a un admin.
const canResync = (deck) =>
  deck.source?.type === 'archidekt' &&
  Boolean(deck.source.url) &&
  (deck.ownerLogin === data.user?.login || data.user?.role === 'admin');
// Nomi dei giocatori: se non si riescono a leggere si usa il login.
onMounted(() => {
  data.loadMembers().catch(() => {});
});
const nameOf = (login) => data.members?.[login]?.displayName ?? login;

const groups = computed(() =>
  groupDecksByOwner(decks.value, { me: data.user?.login ?? null, nameOf }),
);
const mineGroup = computed(() => groups.value.find((g) => g.mine) ?? null);
const filter = ref('all'); // `all` oppure il login di un giocatore
const shownGroups = computed(() => filterGroups(groups.value, filter.value));
// Aperto/chiuso scelto dall'utente; senza scelta è aperto solo il gruppo dei miei mazzi.
const overrides = reactive({});
const isOpen = (group) =>
  filter.value !== 'all' && shownGroups.value.length === 1
    ? true
    : (overrides[group.login] ?? group.mine);
const toggle = (group) => {
  overrides[group.login] = !isOpen(group);
};
const setAll = (open) => {
  for (const group of groups.value) overrides[group.login] = open;
};
const groupLabel = (group) => (group.mine ? t.groups.mineTitle : group.label);
const tmv = (deck) => (typeof deck.tier?.tmv === 'number' ? deck.tier.tmv.toFixed(1) : '—');
</script>

<template>
  <div class="stack">
    <header>
      <h1>{{ it.pages.decks.title }}</h1>
      <p class="muted lead">{{ t.intro }}</p>
      <RouterLink to="/importa" class="btn">{{ t.import }}</RouterLink>
    </header>

    <p v-if="data.error" class="notice notice--error" role="alert">
      {{ it.dashboard.loadFailed }} {{ data.error }}
    </p>
    <p v-else-if="!data.snapshot" class="muted" role="status">{{ it.dashboard.loading }}</p>
    <p v-else-if="decks.length === 0" class="muted">{{ t.empty }}</p>

    <template v-else>
      <div class="deck-filter">
        <label class="deck-filter__field">
          <span>{{ t.groups.show }}</span>
          <select v-model="filter" name="deckFilter" data-testid="deck-filter">
            <option value="all">{{ t.groups.all(decks.length) }}</option>
            <option v-if="mineGroup" :value="mineGroup.login">
              {{ t.groups.mine(mineGroup.decks.length) }}
            </option>
            <option v-for="g in groups.filter((x) => !x.mine)" :key="g.login" :value="g.login">
              {{ t.groups.player(g.label, g.decks.length) }}
            </option>
          </select>
        </label>
        <div v-if="filter === 'all' && groups.length > 1" class="deck-filter__all">
          <button
            type="button"
            class="btn btn--secondary"
            data-testid="expand-all"
            @click="setAll(true)"
          >
            {{ t.groups.expandAll }}
          </button>
          <button
            type="button"
            class="btn btn--secondary"
            data-testid="collapse-all"
            @click="setAll(false)"
          >
            {{ t.groups.collapseAll }}
          </button>
        </div>
      </div>

      <p v-if="!mineGroup && data.user" class="muted" data-testid="no-own-decks">
        {{ t.groups.noneMine }}
      </p>

      <section
        v-for="group in shownGroups"
        :key="group.login"
        class="deck-group"
        :class="{ 'deck-group--mine': group.mine }"
        :data-testid="`deck-group-${group.login}`"
      >
        <h2 class="deck-group__head">
          <button
            type="button"
            class="deck-group__toggle"
            :aria-expanded="isOpen(group)"
            :aria-controls="`decks-of-${group.login}`"
            @click="toggle(group)"
          >
            <span class="deck-group__name">{{ groupLabel(group) }}</span>
            <span v-if="group.mine" class="deck-group__you">{{ t.groups.you }}</span>
            <span class="muted deck-group__count">{{ t.groups.count(group.decks.length) }}</span>
            <span class="deck-group__chevron" aria-hidden="true"></span>
          </button>
        </h2>
        <ul
          v-if="isOpen(group)"
          :id="`decks-of-${group.login}`"
          class="deck-list"
          :aria-label="`${t.list}: ${groupLabel(group)}`"
        >
          <li v-for="deck in group.decks" :key="deck.id" class="card deck">
            <span
              class="tier-badge"
              :data-tier="deck.tier?.current ?? deck.declaredTier"
              :aria-label="`${t.tier} ${deck.tier?.current ?? deck.declaredTier}`"
            >
              {{ deck.tier?.current ?? deck.declaredTier }}
            </span>
            <div class="deck__main">
              <h3 class="deck__name">
                <RouterLink :to="`/mazzi/${deck.id}`" class="deck__link">{{
                  deck.name
                }}</RouterLink>
              </h3>
              <p
                v-if="deck.optimistic"
                class="deck__pending"
                data-testid="deck-pending"
                role="status"
              >
                {{ t.updating }}
              </p>
              <p class="muted deck__sub">
                {{ (deck.commanders ?? []).join(' · ') }} · {{ t.owner }}
                <span class="nowrap">{{ deck.ownerLogin }}</span>
              </p>
              <DeckResync v-if="canResync(deck)" :deck="deck" />
            </div>
            <dl class="deck__stats">
              <div>
                <dt>{{ t.games }}</dt>
                <dd>{{ deck.stats?.games ?? 0 }}</dd>
              </div>
              <div>
                <dt>{{ t.wins }}</dt>
                <dd>{{ deck.stats?.wins ?? 0 }}</dd>
              </div>
              <div>
                <dt>{{ t.tmv }}</dt>
                <dd>{{ tmv(deck) }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.deck__link {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  color: inherit;
}

.deck-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
}

.deck-filter__field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
  flex: 1 1 14rem;
  max-width: 26rem;
  font-weight: 600;
}

.deck-filter__field select {
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

.deck-filter__all {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.deck-group {
  display: grid;
  gap: var(--space);
}

.deck-group__head {
  margin: 0;
  font-size: 1.125rem;
}

.deck-group__toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  font-weight: 700;
  text-align: left;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.deck-group__toggle[aria-expanded='true'] {
  border-color: var(--text-muted);
}

.deck-group__toggle:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

.deck-group__name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.deck-group--mine .deck-group__toggle {
  border: 1px solid var(--accent);
  border-left-width: 8px;
  background: var(--accent-soft);
}

.deck-group__you {
  flex: none;
  padding: 0.125rem 0.5rem;
  font-size: 0.8125rem;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 999px;
}

.deck-group__count {
  flex: none;
  font-weight: 400;
  color: var(--text);
}

.deck-group__chevron {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border: solid currentcolor;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.deck-group__toggle[aria-expanded='true'] .deck-group__chevron {
  transform: rotate(-135deg);
}
</style>

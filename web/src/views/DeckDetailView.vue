<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import CardImage from '../components/CardImage.vue';
import TierStepChart from '../components/TierStepChart.vue';
import WinTypeDonut from '../components/WinTypeDonut.vue';
import { opponentTables, tierHistory, winTypeList } from '../domain/deck-stats.js';
import { it } from '../i18n/it.js';
import { sharedCardCache } from '../platform/card-cache.js';
import { cardKey } from '../platform/scryfall.js';
import { useDataStore } from '../stores/data.js';

const t = it.deckPage;
const route = useRoute();
const data = useDataStore();

const snapshot = computed(() => data.snapshotWithPending);
const deck = computed(() => snapshot.value?.decks.find((d) => d.id === route.params.id) ?? null);
const current = computed(() => deck.value?.tier?.current ?? deck.value?.declaredTier ?? null);
const history = computed(() => (deck.value ? tierHistory(snapshot.value, deck.value.id) : []));
const winTypes = computed(() => (deck.value ? winTypeList(deck.value) : []));
const opponents = computed(() =>
  deck.value ? opponentTables(snapshot.value, deck.value.id) : { beaten: [], beatenBy: [] },
);
const number = (value, digits) => (typeof value === 'number' ? value.toFixed(digits) : t.noValue);
const nameOf = computed(
  () => data.members?.[deck.value?.ownerLogin]?.displayName ?? deck.value?.ownerLogin,
);

// Game changer e combo stanno nell'ultima versione salvata, non nello snapshot.
const features = ref({ state: 'loading', gameChangers: [], combos: [] });
async function loadFeatures() {
  features.value = { state: 'loading', gameChangers: [], combos: [] };
  if (!deck.value || deck.value.optimistic) return;
  try {
    const { deck: full, versions } = await data.getDeck(deck.value.id);
    const version =
      versions.find((v) => v.version === full.currentVersion) ?? versions[versions.length - 1];
    features.value = {
      state: 'ready',
      gameChangers: version?.gameChangers ?? [],
      combos: version?.combos ?? [],
    };
    loadCommanders(deck.value.commanders ?? [], version?.cards ?? []);
  } catch {
    features.value = { state: 'failed', gameChangers: [], combos: [] };
  }
}

// Carte dei comandanti per le immagini: l'id sta nell'elenco carte se c'è, altrimenti si cerca
// per nome (con la cache). Se Scryfall non risponde la scheda resta senza immagini.
const commanderCards = ref([]);
async function loadCommanders(names, cards) {
  const ids = new Map(
    cards.filter((c) => c.scryfallId).map((c) => [cardKey(c.name), c.scryfallId]),
  );
  commanderCards.value = names.map((name) => ({
    name,
    scryfallId: ids.get(cardKey(name)) ?? null,
  }));
  const unknown = names.filter((name) => !ids.has(cardKey(name)));
  if (unknown.length === 0) return;
  try {
    const found = await sharedCardCache().byNames(unknown);
    commanderCards.value = names.map((name) => ({
      name,
      scryfallId: ids.get(cardKey(name)) ?? found[cardKey(name)]?.scryfallId ?? null,
    }));
  } catch {
    // senza immagini: resta il nome
  }
}
onMounted(() => {
  data.loadMembers().catch(() => {});
});
watch(() => deck.value?.id, loadFeatures, { immediate: true });

const comboLabel = (combo) =>
  Array.isArray(combo?.cards) ? combo.cards.join(' + ') : String(combo?.name ?? combo);
</script>

<template>
  <div class="stack">
    <RouterLink to="/mazzi" class="deck-back">← {{ t.back }}</RouterLink>

    <p v-if="!snapshot" class="muted" role="status">{{ it.dashboard.loading }}</p>
    <p v-else-if="!deck" class="notice notice--error" role="alert">{{ t.notFound }}</p>

    <template v-else>
      <header class="deck-head">
        <div v-if="commanderCards.length" class="deck-head__art" data-testid="commander-cards">
          <CardImage
            v-for="c in commanderCards"
            :key="c.name"
            :scryfall-id="c.scryfallId"
            :name="c.name"
            version="normal"
          />
        </div>
        <span class="tier-badge" :data-tier="current" :aria-label="`${it.decks.tier} ${current}`">
          {{ current }}
        </span>
        <div class="deck-head__main">
          <h1>{{ deck.name }}</h1>
          <p class="muted">
            {{ t.commander }}: {{ (deck.commanders ?? []).join(' · ') || '—' }} · {{ t.owner }}
            {{ nameOf }}
          </p>
          <p v-if="(deck.colorIdentity ?? []).length" class="muted">
            {{ t.colors }}: {{ deck.colorIdentity.join(' ') }}
          </p>
          <p v-if="deck.tier?.status" class="muted">{{ t.status }}: {{ deck.tier.status }}</p>
        </div>
      </header>

      <section class="card" data-testid="deck-metrics">
        <h2>{{ t.metricsTitle }}</h2>
        <dl class="metrics">
          <div>
            <dt>{{ t.games }}</dt>
            <dd class="metrics__value">{{ deck.stats?.games ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t.wins }}</dt>
            <dd class="metrics__value">{{ deck.stats?.wins ?? 0 }}</dd>
          </div>
          <div class="metrics__wide">
            <dt>{{ t.tmvName }}</dt>
            <dd data-testid="metric-tmv">{{ number(deck.tier?.tmv, 1) }}</dd>
            <dd class="muted metrics__help">{{ t.tmvHelp }}</dd>
          </div>
          <div class="metrics__wide">
            <dt>{{ t.dominanceName }}</dt>
            <dd data-testid="metric-dominance">{{ number(deck.tier?.dominance, 2) }}</dd>
            <dd class="muted metrics__help">{{ t.dominanceHelp }}</dd>
          </div>
        </dl>
      </section>

      <section class="card" data-testid="deck-history">
        <h2>{{ t.historyTitle }}</h2>
        <p v-if="history.length <= 1" class="muted">{{ t.historyNone }}</p>
        <TierStepChart v-if="history.length" :points="history" />
      </section>

      <section class="card" data-testid="deck-wintypes">
        <h2>{{ t.winTypesTitle }}</h2>
        <p v-if="winTypes.length === 0" class="muted">{{ t.winTypesNone }}</p>
        <WinTypeDonut v-else :items="winTypes" />
      </section>

      <section class="card" data-testid="deck-features">
        <h2>{{ t.featuresTitle }}</h2>
        <p v-if="features.state === 'loading'" class="muted" role="status">
          {{ t.featuresLoading }}
        </p>
        <p v-else-if="features.state === 'failed'" class="muted">{{ t.featuresFailed }}</p>
        <template v-else>
          <h3>{{ t.gameChangers }}</h3>
          <p v-if="features.gameChangers.length === 0" class="muted">{{ t.noneFeatures }}</p>
          <ul v-else class="plain-list">
            <li v-for="name in features.gameChangers" :key="name">{{ name }}</li>
          </ul>
          <h3>{{ t.combos }}</h3>
          <p v-if="features.combos.length === 0" class="muted">{{ t.noneFeatures }}</p>
          <ul v-else class="plain-list">
            <li v-for="(combo, i) in features.combos" :key="i">{{ comboLabel(combo) }}</li>
          </ul>
        </template>
      </section>

      <section class="card" data-testid="deck-opponents">
        <h2>{{ t.opponentsTitle }}</h2>
        <div class="opponents">
          <div>
            <h3>{{ t.beaten }}</h3>
            <p v-if="opponents.beaten.length === 0" class="muted">{{ t.noOpponents }}</p>
            <ul v-else class="plain-list">
              <li v-for="o in opponents.beaten" :key="o.deckId">
                {{ o.name }} <span class="muted">· {{ t.times(o.count) }}</span>
              </li>
            </ul>
          </div>
          <div>
            <h3>{{ t.beatenBy }}</h3>
            <p v-if="opponents.beatenBy.length === 0" class="muted">{{ t.noOpponents }}</p>
            <ul v-else class="plain-list">
              <li v-for="o in opponents.beatenBy" :key="o.deckId">
                {{ o.name }} <span class="muted">· {{ t.times(o.count) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.deck-back {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  color: var(--text);
}

.deck-head {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}

.deck-head__art {
  display: flex;
  flex: none;
  gap: 0.5rem;
  width: 5.5rem;
  flex-wrap: wrap;
}

/* Telefono: carta e fascia in una riga, titolo e dati a tutta larghezza sotto. */
.deck-head__main {
  flex: 1 1 100%;
  min-width: 0;
  overflow-wrap: break-word;
}

@media (min-width: 576px) {
  .deck-head__art {
    width: 8rem;
  }

  .deck-head__main {
    flex: 1 1 12rem;
  }
}

@media (min-width: 768px) {
  .deck-head__art {
    width: 10rem;
  }
}

.deck-head h1 {
  margin: 0 0 0.25rem;
}

.card h2 {
  margin-top: 0;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 1rem;
  margin: 0;
}

.metrics__wide {
  grid-column: 1 / -1;
}

@media (min-width: 768px) {
  .metrics {
    grid-template-columns: repeat(4, 1fr);
  }

  .metrics__wide {
    grid-column: span 1;
  }
}

.metrics dt {
  font-weight: 600;
}

.metrics dd {
  margin: 0.25rem 0 0;
}

.metrics .metrics__value,
.metrics dd[data-testid] {
  font-size: 1.5rem;
  font-weight: 700;
}

.card h3 {
  margin: 1rem 0 0.375rem;
  font-family: var(--font-body, inherit);
  font-size: 1rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
}

.metrics__help {
  font-size: 0.875rem;
}

.plain-list {
  display: grid;
  gap: 0.375rem;
  padding: 0;
  margin: 0.375rem 0 1rem;
  list-style: none;
  overflow-wrap: anywhere;
}

.opponents {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}
</style>

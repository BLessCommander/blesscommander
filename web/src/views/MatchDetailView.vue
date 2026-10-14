<script setup>
import { buildConfig } from '@blesscommander/tier-engine';
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { gameRows } from '../domain/game-history.js';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const t = it.matches;
const route = useRoute();
const data = useDataStore();

onMounted(() => {
  data.loadMembers().catch(() => {});
});

const formatNames = Object.fromEntries(buildConfig({}).formats.map((f) => [f.id, f.nome]));
const nameOf = (login) => data.members?.[login]?.displayName ?? login;
const winTypeName = (id) => it.closeGame.winTypes[id] ?? id;

const row = computed(() =>
  data.snapshotWithPending
    ? (gameRows(data.snapshotWithPending).find((g) => g.id === route.params.id) ?? null)
    : null,
);
</script>

<template>
  <div class="stack match-detail">
    <RouterLink to="/partite" class="back">← {{ t.back }}</RouterLink>

    <p v-if="data.error" class="notice notice--error" role="alert">
      {{ it.dashboard.loadFailed }} {{ data.error }}
    </p>
    <p v-else-if="!data.snapshot" class="muted" role="status">{{ it.dashboard.loading }}</p>
    <p v-else-if="!row" class="notice notice--error" role="alert">{{ t.notFound }}</p>

    <template v-else>
      <header>
        <h1>{{ t.detailTitle }} {{ row.date }}</h1>
        <p class="muted">
          {{ formatNames[row.formatId] ?? row.formatId }}
          <template v-if="row.tier"> · {{ t.tableTier(row.tier) }}</template>
        </p>
      </header>

      <section class="card" data-testid="match-summary">
        <h2>{{ t.summary }}</h2>
        <dl class="facts">
          <div>
            <dt>{{ t.turnTitle }}</dt>
            <dd>{{ row.turn ? t.turn(row.turn, row.estimatedTurn) : t.noValue }}</dd>
          </div>
          <div>
            <dt>{{ t.typeTitle }}</dt>
            <dd>{{ row.winType ? winTypeName(row.winType) : t.noValue }}</dd>
          </div>
        </dl>
        <p v-if="row.combos.length">
          <strong>{{ t.combos }}:</strong> {{ row.combos.join(' · ') }}
        </p>
        <p v-if="row.cards.length">
          <strong>{{ t.cards }}:</strong> {{ row.cards.join(', ') }}
        </p>
        <p v-if="row.notes">
          <strong>{{ t.notes }}:</strong> {{ row.notes }}
        </p>
      </section>

      <section class="card" data-testid="match-players">
        <h2>{{ t.playersTitle }}</h2>
        <ul class="players">
          <li v-for="p in row.players" :key="p.login" class="player" :data-won="p.won">
            <p class="player__head">
              <strong>{{ nameOf(p.login) }}</strong>
              <span v-if="p.won" class="player__win"
                ><span aria-hidden="true">★</span> {{ t.winnerTitle }}</span
              >
            </p>
            <p class="muted">
              <RouterLink :to="`/mazzi/${p.deckId}`">{{ p.deckName }}</RouterLink
              ><template v-if="p.seat"> · {{ t.seat(p.seat) }}</template>
            </p>
            <p v-if="p.eliminatedTurn || p.eliminatedBy" class="muted">
              {{ t.eliminated(p.eliminatedTurn) }}
              <template v-if="p.eliminatedBy"> {{ t.eliminatedBy(p.eliminatedBy) }}</template>
            </p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.match-detail > * {
  max-width: 48rem;
}

.back {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  color: var(--text);
}

.card {
  display: grid;
  gap: 0.75rem;
  padding: calc(var(--space) * 1.5);
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
  margin: 0;
}

.facts dt {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.facts dd {
  margin: 0;
  font-weight: 600;
}

.players {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.player {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow-wrap: anywhere;
}

.player p {
  margin: 0;
}

.player__head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.player__win {
  padding: 0 0.625rem;
  font-weight: 600;
  color: var(--text);
  background: var(--accent-soft);
  border: 1px solid var(--accent, var(--border));
  border-radius: 999px;
}

.player[data-won='true'] {
  border-width: 2px;
  border-color: var(--accent, var(--border));
}
</style>

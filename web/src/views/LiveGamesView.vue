<script setup>
import { computed, onMounted } from 'vue';
import { firstPlayerOf } from '../domain/open-games.js';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const t = it.liveGames;
const data = useDataStore();

onMounted(() => {
  data.loadMembers().catch(() => {});
});

const me = computed(() => data.user?.login ?? '');
const nameOf = (login) => data.members?.[login]?.displayName ?? login;
const decksById = computed(() =>
  Object.fromEntries((data.snapshotWithPending?.decks ?? []).map((d) => [d.id, d])),
);
const games = computed(() =>
  data.openGames.map((game) => {
    const seats = [...game.players].sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
    const first = firstPlayerOf(game);
    const isRecorder = game.recorderLogin === me.value;
    return {
      id: game.id,
      tier: game.tableTier ?? '',
      time: game.startedAt
        ? new Date(game.startedAt).toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      optimistic: game.optimistic === true,
      isRecorder,
      recorder: nameOf(game.recorderLogin),
      dice: isRecorder
        ? it.lobby.reminderForRecorder(nameOf(first?.login))
        : it.lobby.reminderForOthers(nameOf(game.recorderLogin), nameOf(first?.login)),
      seats: seats.map((p) => ({
        login: p.login,
        seat: p.seat,
        name: nameOf(p.login),
        deck: decksById.value[p.deckId]?.name ?? '',
      })),
    };
  }),
);
</script>

<template>
  <div class="stack live">
    <header>
      <h1>{{ it.pages.liveGames.title }}</h1>
      <p class="muted lead">{{ t.intro }}</p>
    </header>

    <p v-if="data.error" class="notice notice--error" role="alert">
      {{ it.dashboard.loadFailed }} {{ data.error }}
    </p>
    <p v-else-if="!data.snapshot" class="muted" role="status">{{ t.loading }}</p>

    <section v-else-if="!games.length" class="card empty" data-testid="live-empty">
      <p>
        <strong>{{ t.empty }}</strong>
      </p>
      <p class="muted">{{ t.emptyHint }}</p>
      <RouterLink to="/nuovo-tavolo" class="btn">{{ t.newTable }}</RouterLink>
    </section>

    <ul v-else class="list" data-testid="live-list">
      <li v-for="g in games" :key="g.id" class="card game" :data-testid="`live-game-${g.id}`">
        <h2>{{ it.lobby.reminderTitle }}</h2>
        <p v-if="g.tier" class="game__tier">{{ it.lobby.tableTier(g.tier) }}</p>
        <p class="game__dice" data-testid="live-dice">{{ g.dice }}</p>
        <p v-if="g.time" class="muted">{{ it.lobby.startedAt(g.time) }}</p>
        <p v-if="g.optimistic" class="muted" data-testid="live-refreshing">{{ t.refreshing }}</p>
        <ol class="game__seats">
          <li v-for="p in g.seats" :key="p.login">
            <strong>{{ it.lobby.seat(p.seat) }}</strong> · {{ p.name
            }}<template v-if="p.deck"> · {{ p.deck }}</template>
          </li>
        </ol>
        <p class="muted">{{ g.isRecorder ? t.youRecord : t.recorder(g.recorder) }}</p>
        <div class="actions">
          <RouterLink
            v-if="g.isRecorder"
            :to="`/partite/${g.id}/chiudi`"
            class="btn"
            data-testid="live-close"
            >{{ t.close }}</RouterLink
          >
          <p v-else class="muted" data-testid="live-not-recorder">{{ t.notRecorder }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.live > header,
.list,
.empty {
  max-width: 40rem;
}

.list {
  display: grid;
  gap: var(--space);
  margin: 0;
  padding: 0;
  list-style: none;
}

.empty,
.game {
  display: grid;
  gap: 0.75rem;
  padding: calc(var(--space) * 1.5);
}

.empty p,
.game h2,
.game p {
  margin: 0;
}

.empty .btn {
  justify-self: start;
}

.game__dice {
  font-size: 1.25rem;
  font-weight: 700;
}

.game__tier {
  font-weight: 700;
}

.game__seats {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space);
}

@media (min-width: 768px) {
  .actions {
    display: flex;
    flex-wrap: wrap;
  }
}
</style>

<script setup>
import { computed } from 'vue';
import KpiCard from '../components/ui/KpiCard.vue';
import { APP_NAME } from '../config/environment.js';
import { dashboardStats, recentGames } from '../domain/snapshot-stats.js';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const t = it.dashboard;
const data = useDataStore();

const stats = computed(() =>
  data.snapshot && data.user ? dashboardStats(data.snapshot, data.user.login) : null,
);
const recent = computed(() => (data.snapshot ? recentGames(data.snapshot) : []));
const hasGames = computed(() => (stats.value?.officialGames ?? 0) > 0);
</script>

<template>
  <div class="stack">
    <header>
      <h1>{{ APP_NAME }}</h1>
      <p class="muted lead">{{ t.intro }}</p>
    </header>

    <p v-if="data.error" class="notice notice--error" role="alert">
      {{ t.loadFailed }} {{ data.error }}
    </p>
    <p v-else-if="!stats" class="muted" role="status">{{ t.loading }}</p>

    <section class="grid grid--kpi" :aria-label="it.pages.dashboard.title">
      <KpiCard
        :title="t.kpiMatches"
        :value="stats ? String(stats.officialGames) : '—'"
        :hint="hasGames ? t.kpiMatchesHint : t.noData"
      />
      <KpiCard
        :title="t.kpiWinRate"
        :value="stats?.winRate != null ? `${stats.winRate}%` : '—'"
        :hint="stats?.winRate != null ? t.kpiWinRateHint(stats.myWins, stats.myGames) : t.noData"
        :progress="stats?.winRate ?? 0"
      />
      <KpiCard
        :title="t.kpiTmv"
        :value="stats?.avgTmv != null ? stats.avgTmv.toFixed(1) : '—'"
        :hint="stats?.avgTmv != null ? t.kpiTmvHint : t.noData"
      />
      <KpiCard
        :title="t.kpiDecks"
        :value="stats ? String(stats.decks) : '—'"
        :hint="stats && stats.decks > 0 ? t.kpiDecksHint(stats.perTier) : t.noData"
      />
    </section>

    <div class="grid grid--two">
      <section class="card" aria-labelledby="recent">
        <h2 id="recent">{{ t.recentTitle }}</h2>
        <ul v-if="recent.length > 0" class="plain-list">
          <li v-for="game in recent" :key="game.id">
            <strong>{{ game.date }}</strong> · {{ game.formatId }} ·
            <span class="muted">{{ t.recentWon }}</span> {{ game.winners.join(', ') || '—' }}
          </li>
        </ul>
        <p v-else class="muted">{{ t.recentEmpty }}</p>
      </section>
      <section class="card" aria-labelledby="rule">
        <h2 id="rule">{{ t.rule }}</h2>
        <p>{{ t.ruleText }}</p>
      </section>
    </div>
  </div>
</template>

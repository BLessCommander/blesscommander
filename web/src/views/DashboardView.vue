<script setup>
import KpiCard from '../components/ui/KpiCard.vue';
import { APP_NAME } from '../config/environment.js';
import { it } from '../i18n/it.js';

const t = it.dashboard;
</script>

<template>
  <div class="stack">
    <header>
      <h1>{{ APP_NAME }}</h1>
      <p class="muted lead">{{ t.intro }}</p>
    </header>

    <section class="grid grid--kpi" :aria-label="it.pages.dashboard.title">
      <KpiCard :title="t.kpiMatches" :hint="t.noData" />
      <KpiCard :title="t.kpiWinRate" :hint="t.noData" :progress="0" />
      <KpiCard :title="t.kpiTmv" :hint="t.noData" />
      <KpiCard :title="t.kpiDecks" :hint="t.noData" />
    </section>

    <div class="grid grid--two">
      <section class="card" aria-labelledby="recent">
        <h2 id="recent">{{ t.recentTitle }}</h2>
        <p class="muted">{{ t.recentEmpty }}</p>
      </section>
      <section class="card" aria-labelledby="rule">
        <h2 id="rule">{{ t.rule }}</h2>
        <p>{{ t.ruleText }}</p>
      </section>
    </div>
  </div>
</template>

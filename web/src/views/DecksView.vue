<script setup>
import { computed } from 'vue';
import { sortedDecks } from '../domain/snapshot-stats.js';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const t = it.decks;
const data = useDataStore();
const decks = computed(() => (data.snapshot ? sortedDecks(data.snapshot) : []));
const tmv = (deck) => (typeof deck.tier?.tmv === 'number' ? deck.tier.tmv.toFixed(1) : '—');
</script>

<template>
  <div class="stack">
    <header>
      <h1>{{ it.pages.decks.title }}</h1>
      <p class="muted lead">{{ t.intro }}</p>
    </header>

    <p v-if="data.error" class="notice notice--error" role="alert">
      {{ it.dashboard.loadFailed }} {{ data.error }}
    </p>
    <p v-else-if="!data.snapshot" class="muted" role="status">{{ it.dashboard.loading }}</p>
    <p v-else-if="decks.length === 0" class="muted">{{ t.empty }}</p>

    <ul v-else class="deck-list" :aria-label="t.list">
      <li v-for="deck in decks" :key="deck.id" class="card deck">
        <span
          class="tier-badge"
          :data-tier="deck.tier?.current ?? deck.declaredTier"
          :aria-label="`${t.tier} ${deck.tier?.current}`"
        >
          {{ deck.tier?.current ?? deck.declaredTier }}
        </span>
        <div class="deck__main">
          <h2 class="deck__name">{{ deck.name }}</h2>
          <p class="muted deck__sub">
            {{ (deck.commanders ?? []).join(' · ') }} · {{ t.owner }}
            <span class="nowrap">{{ deck.ownerLogin }}</span>
          </p>
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
  </div>
</template>

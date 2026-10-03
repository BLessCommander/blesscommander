<script setup>
import { computed } from 'vue';
import { it } from '../i18n/it.js';
import CardImage from './CardImage.vue';

/** Dettaglio di una carta del mazzo: immagine grande e dati di Scryfall (C-08f). */
const props = defineProps({
  /** Carta del mazzo con i dati uniti (vedi `detailCards`). */
  card: { type: Object, required: true },
  /** Dati completi di Scryfall, se disponibili. */
  info: { type: Object, default: null },
  /** Combo del mazzo a cui la carta partecipa. */
  combos: { type: Array, default: () => [] },
  /** Salt score EDHREC (0–4), se si conosce. */
  salt: { type: Number, default: null },
});
const t = it.deckCards;
const d = t.detail;

const cost = computed(() =>
  props.info?.manaCost
    ? props.info.manaCost.replace(/\{([^}]+)\}/g, '$1 ').trim()
    : props.info
      ? '—'
      : null,
);
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
const colors = computed(() => {
  if (!props.info) return null;
  const names = COLOR_ORDER.filter((c) => props.info.colors.includes(c)).map((c) => t.colors[c]);
  return names.length ? names.join(', ') : t.colors.C;
});
const gameChanger = computed(() => props.card.isGameChanger || props.info?.isGameChanger);
const others = (combo) => combo.cards.filter((n) => n !== props.card.name);
</script>

<template>
  <div class="detail" data-testid="card-detail">
    <div class="detail__art">
      <CardImage :scryfall-id="card.scryfallId" :name="card.name" version="normal" />
    </div>
    <div class="detail__body">
      <p v-if="gameChanger" class="detail__flag" data-testid="detail-game-changer">
        {{ d.gameChanger }}
      </p>
      <dl class="detail__facts">
        <div>
          <dt>{{ d.qty }}</dt>
          <dd data-testid="detail-qty">{{ card.qty }}</dd>
        </div>
        <div v-if="salt !== null">
          <dt>{{ d.salt }}</dt>
          <dd data-testid="detail-salt">{{ d.saltOf(salt) }}</dd>
        </div>
        <template v-if="info">
          <div>
            <dt>{{ d.cost }}</dt>
            <dd>{{ cost }}</dd>
          </div>
          <div>
            <dt>{{ d.type }}</dt>
            <dd>{{ info.typeLine || '—' }}</dd>
          </div>
          <div>
            <dt>{{ d.colors }}</dt>
            <dd>{{ colors }}</dd>
          </div>
        </template>
      </dl>
      <p v-if="!info" class="muted">{{ d.noData }}</p>
      <section v-if="info?.oracleText">
        <h3>{{ d.text }}</h3>
        <p class="detail__text">{{ info.oracleText }}</p>
      </section>
      <section v-if="combos.length" data-testid="detail-combos">
        <h3>{{ d.combos }}</h3>
        <ul class="detail__combos">
          <li v-for="(combo, i) in combos" :key="i">
            {{ d.comboWith(others(combo)) }}
            <span v-if="combo.produces.length" class="muted"
              >· {{ combo.produces.join(', ') }}</span
            >
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.detail {
  display: grid;
  gap: 1rem;
}

.detail__art {
  width: min(9rem, 60%);
  margin-inline: auto;
}

@media (min-width: 576px) {
  .detail {
    grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
    align-items: start;
  }

  .detail__art {
    width: 100%;
  }
}

.detail__body {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.detail__flag {
  justify-self: start;
  padding: 0.125rem 0.625rem;
  margin: 0;
  font-weight: 700;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 999px;
}

.detail__facts {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.detail__facts dt {
  font-size: 0.9375rem;
  color: var(--text-muted);
}

.detail__facts dd {
  margin: 0;
}

.detail h3 {
  margin: 0 0 0.25rem;
  font-family: var(--font-body, inherit);
  font-size: 1rem;
  text-transform: none;
  letter-spacing: normal;
}

.detail__text {
  margin: 0;
  white-space: pre-line;
}

.detail__combos {
  display: grid;
  gap: 0.375rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>

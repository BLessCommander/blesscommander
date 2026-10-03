<script setup>
import { computed } from 'vue';
import { tierLevel } from '../domain/deck-stats.js';
import { it } from '../i18n/it.js';

/** Storico delle fasce a gradini; sotto, lo stesso elenco in testo. */
const props = defineProps({
  /** @type {import('vue').PropType<{ tier: string, at: string | null, reasons: string[] }[]>} */
  points: { type: Array, required: true },
});
const t = it.deckPage;

const W = 320;
const H = 190;
const PAD = { left: 36, right: 12, top: 12, bottom: 12 };
const y = (tier) => PAD.top + (5 - tierLevel(tier)) * ((H - PAD.top - PAD.bottom) / 4);
const xs = computed(() => {
  const n = props.points.length;
  const span = W - PAD.left - PAD.right;
  return props.points.map((_, i) => PAD.left + (n === 1 ? span / 2 : (span * i) / (n - 1)));
});
const path = computed(() => {
  let d = '';
  props.points.forEach((p, i) => {
    const px = xs.value[i];
    d += i === 0 ? `M${PAD.left} ${y(p.tier)}` : `H${px}V${y(p.tier)}`;
  });
  if (props.points.length === 1) d += `H${W - PAD.right}`;
  return d;
});
const summary = computed(() => t.historySummary(props.points.map((p) => p.tier)));
</script>

<template>
  <div class="step">
    <svg
      class="step__svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="summary"
      preserveAspectRatio="xMidYMid meet"
    >
      <g v-for="id in ['F1', 'F2', 'F3', 'F4', 'F5']" :key="id">
        <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(id)" :y2="y(id)" class="step__grid" />
        <text :x="PAD.left - 6" :y="y(id) + 5" class="step__axis" text-anchor="end">{{ id }}</text>
      </g>
      <path :d="path" class="step__line" />
      <circle
        v-for="(p, i) in points"
        :key="i"
        :cx="xs[i]"
        :cy="y(p.tier)"
        r="4.5"
        :style="{ fill: `var(--tier-${p.tier})` }"
        class="step__dot"
      />
    </svg>
    <ol class="step__list" :aria-label="t.historyList">
      <li v-for="(p, i) in points" :key="i">
        <span class="tier-badge" :data-tier="p.tier">{{ p.tier }}</span>
        <span>{{ i === 0 ? t.historyStart : p.at }}</span>
        <span v-if="p.reasons.length" class="muted">{{ p.reasons.join('; ') }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.step {
  display: grid;
  gap: 0.75rem 2rem;
  align-items: start;
}

@media (min-width: 768px) {
  .step {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  }
}

.step__svg {
  width: 100%;
  height: auto;
}

.step__grid {
  stroke: var(--text-muted);
  stroke-opacity: 0.45;
  stroke-width: 1;
}

.step__axis {
  font-size: 14px;
  fill: var(--text);
}

.step__line {
  fill: none;
  stroke: var(--text);
  stroke-width: 2;
  stroke-linejoin: round;
}

.step__dot {
  stroke: var(--surface);
  stroke-width: 2;
}

.step__list {
  display: grid;
  gap: 0.375rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.step__list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
</style>

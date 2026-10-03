<script setup>
import { computed } from 'vue';

/** Barre verticali in SVG: valore sopra ogni barra, etichetta sotto. Senza hover, si legge a colpo d'occhio. */
const props = defineProps({
  /** @type {import('vue').PropType<{ label: string, value: number }[]>} */
  items: { type: Array, required: true },
  /** Colore delle barre (qualunque valore CSS). */
  color: { type: String, default: 'var(--accent)' },
  /** Descrizione per chi usa il lettore di schermo. */
  label: { type: String, required: true },
  /** Versione piccola, per le curve di ogni colore. */
  compact: { type: Boolean, default: false },
  /** Larghezza di ogni colonna (in unità del disegno); più larga se le etichette sono lunghe. */
  step: { type: Number, default: 32 },
});

const STEP = props.step;
const TOP = 16;
const BASE = 20;
const H = computed(() => (props.compact ? 90 : 160));
const W = computed(() => props.items.length * STEP);
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)));
const bars = computed(() =>
  props.items.map((item, index) => {
    const height = (item.value / max.value) * (H.value - TOP - BASE);
    return {
      ...item,
      x: index * STEP + 6,
      y: H.value - BASE - height,
      height,
      center: index * STEP + STEP / 2,
    };
  }),
);
</script>

<template>
  <svg
    class="bars"
    :class="{ 'bars--compact': compact }"
    :viewBox="`0 0 ${W} ${H}`"
    role="img"
    :aria-label="label"
    preserveAspectRatio="xMidYMid meet"
  >
    <line :x1="0" :x2="W" :y1="H - BASE" :y2="H - BASE" class="bars__axis" />
    <g v-for="bar in bars" :key="bar.label">
      <rect
        v-if="bar.value > 0"
        :x="bar.x"
        :y="bar.y"
        :width="STEP - 12"
        :height="bar.height"
        rx="2"
        :style="{ fill: color }"
        class="bars__bar"
      />
      <text :x="bar.center" :y="bar.y - 4" text-anchor="middle" class="bars__value">
        {{ bar.value > 0 ? bar.value : '' }}
      </text>
      <text :x="bar.center" :y="H - 5" text-anchor="middle" class="bars__label">
        {{ bar.label }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.bars {
  display: block;
  width: 100%;
  height: auto;
}

.bars__axis {
  stroke: var(--text-muted);
  stroke-opacity: 0.6;
}

.bars__bar {
  stroke: var(--text);
  stroke-opacity: 0.35;
}

.bars__value {
  font-size: 12px;
  font-weight: 700;
  fill: var(--text);
}

.bars__label {
  font-size: 12px;
  fill: var(--text);
}

.bars--compact .bars__value,
.bars--compact .bars__label {
  font-size: 14px;
}
</style>

<script setup>
import { computed } from 'vue';
import { it } from '../i18n/it.js';

/** Ciambella dei tipi di vittoria; la legenda con i numeri è sempre visibile. */
const props = defineProps({
  /** @type {import('vue').PropType<{ type: string, count: number }[]>} */
  items: { type: Array, required: true },
});
const t = it.deckPage;

const R = 40;
const C = 2 * Math.PI * R;
const total = computed(() => props.items.reduce((s, i) => s + i.count, 0));
const slices = computed(() => {
  let offset = 0;
  return props.items.map((item, index) => {
    const len = (item.count / total.value) * C;
    const slice = { ...item, index, len, offset };
    offset += len;
    return slice;
  });
});
</script>

<template>
  <div class="donut">
    <svg class="donut__svg" viewBox="0 0 100 100" role="img" :aria-label="t.winTypesSummary(items)">
      <circle
        v-for="s in slices"
        :key="s.type"
        cx="50"
        cy="50"
        :r="R"
        fill="none"
        stroke-width="16"
        :class="`donut__slice donut__slice--${s.index % 5}`"
        :stroke-dasharray="`${s.len} ${C - s.len}`"
        :stroke-dashoffset="-s.offset"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="52" text-anchor="middle" class="donut__total">{{ total }}</text>
      <text x="50" y="63" text-anchor="middle" class="donut__caption">{{ t.winsWord }}</text>
    </svg>
    <ul class="donut__legend">
      <li v-for="s in slices" :key="s.type">
        <span :class="`donut__key donut__slice--${s.index % 5}`" aria-hidden="true"></span>
        <span class="donut__type">{{ s.type }}</span>
        <strong>{{ s.count }}</strong>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.5rem;
}

.donut__svg {
  flex: none;
  width: 9rem;
  height: 9rem;
}

.donut__total {
  font-size: 18px;
  font-weight: 700;
  fill: var(--text);
}

.donut__caption {
  font-size: 9px;
  fill: var(--text-muted);
}

.donut__slice--0 {
  stroke: #2269b3;
  background: #2269b3;
}

.donut__slice--1 {
  stroke: #b35a0c;
  background: #b35a0c;
}

.donut__slice--2 {
  stroke: #1f7a43;
  background: #1f7a43;
}

.donut__slice--3 {
  stroke: #8a4fd6;
  background: #8a4fd6;
}

.donut__slice--4 {
  stroke: #d1383d;
  background: #d1383d;
}

.donut__legend {
  display: grid;
  gap: 0.375rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.donut__legend li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.donut__key {
  flex: none;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 3px;
}

.donut__type {
  text-transform: capitalize;
}
</style>

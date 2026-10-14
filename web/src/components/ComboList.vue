<script setup>
import { computed, ref } from 'vue';
import { filterCombos, groupCombos } from '../domain/combo-filter.js';
import { comboKey, comboLabel } from '../domain/game-close.js';
import { it } from '../i18n/it.js';

// Ricerca + elenco di combo con caselle; con molte combo si dividono in gruppi che si chiudono.
const props = defineProps({
  options: { type: Array, required: true },
  chosen: { type: Array, required: true },
});
const emit = defineEmits(['toggle']);
const t = it.closeGame;

const query = ref('');
const matches = computed(() => filterCombos(props.options, query.value));
const groups = computed(() => groupCombos(matches.value));
const isChosen = (combo) => props.chosen.some((c) => comboKey(c) === comboKey(combo));

const closed = ref(new Set());
const toggleGroup = (id) => {
  const next = new Set(closed.value);
  if (!next.delete(id)) next.add(id);
  closed.value = next;
};
// Con una ricerca in corso i gruppi sono tutti aperti, così non si nasconde un risultato.
const isOpen = (id) => id === null || query.value.trim() !== '' || !closed.value.has(id);
</script>

<template>
  <div class="combo-list">
    <div class="combo-list__search">
      <label class="field">
        <span>{{ t.comboSearchLabel }}</span>
        <input
          v-model="query"
          type="search"
          name="comboSearch"
          autocomplete="off"
          data-testid="close-combo-search"
        />
      </label>
    </div>

    <p v-if="!matches.length" class="muted" data-testid="close-combo-nomatch">
      {{ t.comboNoMatch }}
    </p>
    <section
      v-for="g in groups"
      :key="g.id ?? 'all'"
      class="group-list"
      :data-testid="g.id ? `close-combo-group-${g.id}` : undefined"
    >
      <h3 v-if="g.id" class="group-list__title">
        <button
          type="button"
          class="group-list__btn"
          :aria-expanded="isOpen(g.id)"
          @click="toggleGroup(g.id)"
        >
          <span>{{ t.comboGroups[g.id] }} ({{ g.combos.length }})</span>
          <span
            class="chevron"
            :class="{ 'chevron--open': isOpen(g.id) }"
            aria-hidden="true"
          ></span>
        </button>
      </h3>
      <div v-if="isOpen(g.id)" class="group-list__rows">
        <label v-for="c in g.combos" :key="comboKey(c)" class="choice choice--check">
          <input
            type="checkbox"
            name="winCombo"
            :checked="isChosen(c)"
            @change="emit('toggle', c)"
          />
          <span class="choice__box">
            <strong>{{ comboLabel(c) }}</strong>
            <small v-if="c.produces?.length" class="muted">{{
              t.comboProduces(c.produces.join(', '))
            }}</small>
          </span>
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.combo-list,
.group-list,
.group-list__rows {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
}

/* Nel foglio a tutto schermo la ricerca resta ferma in alto mentre l'elenco scorre. */
.combo-list__search {
  position: sticky;
  top: 0;
  z-index: 2;
  padding-bottom: 0.5rem;
  background: var(--surface);
}

.field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
  font-weight: 600;
}

.field input {
  width: 100%;
  min-width: 0;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  font-weight: 400;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--text-muted);
  border-radius: var(--radius-sm);
  color-scheme: light dark;
}

.chevron {
  flex: none;
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.25rem;
  border: solid var(--text);
  border-width: 0 3px 3px 0;
  transform: translateY(-25%) rotate(45deg);
  transition: transform 0.15s;
}

.chevron--open {
  transform: translateY(25%) rotate(-135deg);
}

.group-list__title {
  margin: 0;
  font-size: 1rem;
}

.group-list__btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  font-weight: 700;
  text-align: left;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

/* La casella vera copre tutta la riga (zona di tocco ≥ 44 px); il riquadro è solo disegno. */
.choice {
  position: relative;
  display: block;
  min-width: 0;
  max-width: none; /* la regola globale .choice limita a 480px */
}

.choice input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.choice__box {
  position: relative;
  display: grid;
  gap: 2px;
  align-content: center;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem 0.5rem 3rem;
  overflow-wrap: anywhere;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.choice input:checked + .choice__box {
  border: 2px solid var(--accent);
  background: var(--accent-soft);
}

.choice input:focus-visible + .choice__box {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.choice__box::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0.75rem;
  width: 1.5rem;
  height: 1.5rem;
  transform: translateY(-50%);
  border: 2px solid var(--text-muted);
  border-radius: 6px;
  background: var(--surface);
}

.choice input:checked + .choice__box::before {
  border-color: var(--accent);
  background: var(--accent);
}

.choice input:checked + .choice__box::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 1.3rem;
  width: 0.4rem;
  height: 0.8rem;
  border: solid var(--surface);
  border-width: 0 2px 2px 0;
  transform: translateY(-65%) rotate(45deg);
}
</style>

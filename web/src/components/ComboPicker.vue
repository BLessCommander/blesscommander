<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { comboKey, comboLabel } from '../domain/game-close.js';
import { useOverlay } from '../composables/use-overlay.js';
import { it } from '../i18n/it.js';
import { watchMinWidth } from '../platform/viewport.js';
import ComboList from './ComboList.vue';
import AppModal from './ui/AppModal.vue';

// Scelta delle combo nella chiusura partita: scelte come chip sempre visibili; l'elenco con ricerca
// sta nella pagina da 768px, sul telefono in un foglio a tutto schermo (C-10d).
defineProps({
  /** Combo tra cui scegliere. */
  options: { type: Array, required: true },
  /** Combo già scelte. */
  chosen: { type: Array, required: true },
});
const emit = defineEmits(['toggle']);
const t = it.closeGame;

const media = watchMinWidth(768, (value) => {
  wide.value = value;
});
const wide = ref(media.wide);
onBeforeUnmount(media.stop);

const overlay = useOverlay('combos');
/** Su schermo largo l'elenco sta in un riquadro, chiuso all'inizio. */
const expanded = ref(false);
</script>

<template>
  <div class="picker" data-testid="close-combos">
    <template v-if="chosen.length">
      <p class="picker__title">{{ t.pickedCombos }}</p>
      <ul class="chips" :aria-label="t.pickedCombos" data-testid="close-picked-combos">
        <li v-for="c in chosen" :key="comboKey(c)" class="chip">
          <span>{{ comboLabel(c) }}</span>
          <button
            type="button"
            class="chip__x"
            :aria-label="t.removeCombo(comboLabel(c))"
            @click="emit('toggle', c)"
          >
            ×
          </button>
        </li>
      </ul>
    </template>

    <template v-if="wide">
      <button
        type="button"
        class="btn btn--secondary picker__toggle"
        :aria-expanded="expanded"
        aria-controls="combo-panel"
        data-testid="close-combo-toggle"
        @click="expanded = !expanded"
      >
        <span>{{ t.comboOpen(chosen.length) }}</span>
        <span class="chevron" :class="{ 'chevron--open': expanded }" aria-hidden="true"></span>
      </button>
      <div v-if="expanded" id="combo-panel" class="picker__panel" data-testid="close-combo-list">
        <ComboList :options="options" :chosen="chosen" @toggle="emit('toggle', $event)" />
      </div>
    </template>
    <template v-else>
      <button
        type="button"
        class="btn btn--secondary"
        data-testid="close-combo-open"
        @click="overlay.open()"
      >
        {{ t.comboOpen(chosen.length) }}
      </button>
      <AppModal name="combos" :title="t.comboSheetTitle">
        <div data-testid="close-combo-list">
          <ComboList :options="options" :chosen="chosen" @toggle="emit('toggle', $event)" />
        </div>
        <template #footer>
          <button type="button" class="btn" data-testid="close-combo-done" @click="overlay.close()">
            {{ t.comboDone }}
          </button>
        </template>
      </AppModal>
    </template>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
}

.picker__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.picker__panel {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.chevron {
  flex: none;
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.25rem;
  border: solid currentColor;
  border-width: 0 3px 3px 0;
  transform: translateY(-25%) rotate(45deg);
  transition: transform 0.15s;
}

.chevron--open {
  transform: translateY(25%) rotate(-135deg);
}

.picker__title {
  margin: 0.5rem 0 0;
  font-weight: 700;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--tap);
  padding-left: 0.75rem;
  border: 2px solid var(--accent);
  border-radius: 999px;
  background: var(--accent-soft);
  overflow-wrap: anywhere;
}

.chip__x {
  min-width: var(--tap);
  min-height: var(--tap);
  font: inherit;
  font-size: 1.25rem;
  color: var(--text);
  background: transparent;
  border: 0;
  cursor: pointer;
}
</style>

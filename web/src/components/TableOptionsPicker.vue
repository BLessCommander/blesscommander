<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { useOverlay } from '../composables/use-overlay.js';
import { it } from '../i18n/it.js';
import { watchMinWidth } from '../platform/viewport.js';
import AppModal from './ui/AppModal.vue';

// «Carte e opzioni di tavolo» (C-09b): scelte come chip sempre visibili; l'elenco sta in un riquadro
// da 768px, sul telefono in un foglio a tutto schermo. Le voci non ancora calcolate dal motore
// (`enabled: false`) si vedono ma non si possono scegliere.
defineProps({
  /** Voci: `{ id, name, note, enabled }`. */
  options: { type: Array, required: true },
});
const t = it.lobby;

const media = watchMinWidth(768, (value) => {
  wide.value = value;
});
const wide = ref(media.wide);
onBeforeUnmount(media.stop);

const overlay = useOverlay('options');
const expanded = ref(false);
/** @type {import('vue').Ref<string[]>} */
const chosen = ref([]);

/** @param {string} id */
function toggle(id) {
  chosen.value = chosen.value.includes(id)
    ? chosen.value.filter((x) => x !== id)
    : [...chosen.value, id];
}
</script>

<template>
  <div class="picker" data-testid="lobby-options">
    <p class="picker__title">{{ t.optionsTitle }}</p>
    <ul class="chips" :aria-label="t.optionsPicked" data-testid="lobby-picked-options">
      <li v-for="o in options.filter((x) => chosen.includes(x.id))" :key="o.id" class="chip">
        <span>{{ o.name }}</span>
        <button
          type="button"
          class="chip__x"
          :aria-label="t.removeOption(o.name)"
          @click="toggle(o.id)"
        >
          ×
        </button>
      </li>
      <li v-if="!chosen.length" class="picker__none muted" data-testid="lobby-no-options">
        {{ t.optionsNone }}
      </li>
    </ul>

    <template v-if="wide">
      <button
        type="button"
        class="btn btn--secondary picker__toggle"
        :aria-expanded="expanded"
        aria-controls="options-panel"
        data-testid="lobby-options-toggle"
        @click="expanded = !expanded"
      >
        <span>{{ t.optionsOpen(chosen.length) }}</span>
        <span class="chevron" :class="{ 'chevron--open': expanded }" aria-hidden="true"></span>
      </button>
      <div
        v-if="expanded"
        id="options-panel"
        class="picker__panel"
        data-testid="lobby-options-list"
      >
        <label
          v-for="o in options"
          :key="o.id"
          class="choice"
          :class="{ 'choice--off': !o.enabled }"
        >
          <input
            type="checkbox"
            :name="`option-${o.id}`"
            :disabled="!o.enabled"
            :checked="chosen.includes(o.id)"
            @change="toggle(o.id)"
          />
          <span class="choice__box">
            <span
              ><strong>{{ o.name }}</strong>
              <span v-if="!o.enabled" class="muted"> · {{ t.soon }}</span></span
            >
            <small class="muted">{{ o.note }}</small>
          </span>
        </label>
      </div>
    </template>
    <template v-else>
      <button
        type="button"
        class="btn btn--secondary"
        data-testid="lobby-options-open"
        @click="overlay.open()"
      >
        {{ t.optionsOpen(chosen.length) }}
      </button>
      <AppModal name="options" :title="t.optionsTitle">
        <div class="picker__list" data-testid="lobby-options-list">
          <label
            v-for="o in options"
            :key="o.id"
            class="choice"
            :class="{ 'choice--off': !o.enabled }"
          >
            <input
              type="checkbox"
              :name="`option-${o.id}`"
              :disabled="!o.enabled"
              :checked="chosen.includes(o.id)"
              @change="toggle(o.id)"
            />
            <span class="choice__box">
              <span
                ><strong>{{ o.name }}</strong>
                <span v-if="!o.enabled" class="muted"> · {{ t.soon }}</span></span
              >
              <small class="muted">{{ o.note }}</small>
            </span>
          </label>
        </div>
        <template #footer>
          <button
            type="button"
            class="btn"
            data-testid="lobby-options-done"
            @click="overlay.close()"
          >
            {{ t.optionsDone }}
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

.picker__title {
  margin: 0;
  font-weight: 600;
}

.picker__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.picker__panel,
.picker__list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
}

.picker__panel {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.picker__none {
  list-style: none;
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

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
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

.choice--off input {
  cursor: not-allowed;
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

/* Inibita ma leggibile: bordo tratteggiato e testo pieno, senza opacità sul testo. */
.choice--off .choice__box {
  border: 1px dashed var(--text-muted);
  background: transparent;
}

.choice__box small {
  font-size: 0.875rem;
}

/* Casella spenta: tratteggiata e vuota, così non sembra un controllo attivo. */
.choice--off .choice__box::before {
  border: 2px dashed var(--border);
  background: transparent;
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

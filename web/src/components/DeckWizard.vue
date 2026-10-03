<script setup>
import { computed, ref, watch } from 'vue';
import {
  CHAIN_EXTRA_TURNS_FROM,
  deckFloor,
  manualCombo,
  tierChoices,
} from '../domain/deck-features.js';
import { it } from '../i18n/it.js';

/**
 * Wizard di autovalutazione (SPEC §3.2, §4.2): mostra ciò che l'app ha rilevato nel mazzo, chiede conferma
 * e fa scegliere la fascia dichiarata, che non può stare sotto il pavimento.
 */
const props = defineProps({
  gameChangers: { type: Array, required: true },
  /** Combo a due carte trovate; `null` se Commander Spellbook non ha risposto. */
  combos: { type: Array, default: null },
  suspects: { type: Object, required: true },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['back', 'confirm']);

const t = it.importDeck.wizard;
const massLand = ref(props.suspects.massLand.length > 0);
const chainExtraTurns = ref(props.suspects.extraTurns.length >= CHAIN_EXTRA_TURNS_FROM);
const manual = ref('none'); // none | late | rapid, solo se le combo non sono verificate

const combos = computed(() => {
  if (props.combos) return props.combos;
  return manual.value === 'none' ? [] : [manualCombo(manual.value)];
});

const floor = computed(() =>
  deckFloor({
    gameChangers: props.gameChangers.length,
    massLandDestruction: massLand.value,
    chainExtraTurns: chainExtraTurns.value,
    combos: combos.value,
  }),
);
const choices = computed(() => tierChoices(floor.value));
const declared = ref(floor.value);
// Se il pavimento sale sopra la fascia scelta, la fascia lo segue.
watch(floor, (value) => {
  if (choices.value.find((c) => c.tier === declared.value)?.disabled) declared.value = value;
});

function confirm() {
  emit('confirm', {
    declaredTier: declared.value,
    assessment: {
      floor: floor.value,
      massLandDestruction: massLand.value,
      chainExtraTurns: chainExtraTurns.value,
      // Copie semplici: il provider copia i dati con structuredClone, che non regge i proxy di Vue.
      combos: combos.value.map((c) => ({
        ...c,
        cards: [...c.cards],
        produces: [...(c.produces ?? [])],
      })),
    },
  });
}
</script>

<template>
  <section class="stack" data-testid="deck-wizard" :aria-label="t.title">
    <header>
      <h2>{{ t.title }}</h2>
      <p class="muted">{{ t.intro }}</p>
    </header>

    <div class="card stack" data-testid="wizard-game-changers">
      <h3>{{ t.gameChangersTitle }}</h3>
      <p v-if="!gameChangers.length" class="muted">{{ t.gameChangersNone }}</p>
      <ul v-else class="chips">
        <li v-for="name in gameChangers" :key="name" class="chip">{{ name }}</li>
      </ul>
    </div>

    <div class="card stack" data-testid="wizard-combos">
      <h3>{{ t.combosTitle }}</h3>
      <template v-if="props.combos">
        <p v-if="!props.combos.length" class="muted">{{ t.combosNone }}</p>
        <ul v-else class="plain-list">
          <li v-for="combo in props.combos" :key="combo.id">
            <strong>{{ combo.cards.join(' + ') }}</strong>
            <span class="muted">
              · {{ t.comboKind(combo.manaValue) }} ({{ t.comboPieces(combo.manaValue) }})
            </span>
          </li>
        </ul>
      </template>
      <template v-else>
        <p class="notice notice--error" role="alert" data-testid="combos-unavailable">
          {{ t.combosUnavailable }}
        </p>
        <label class="field">
          <span>{{ t.manualCombo }}</span>
          <select v-model="manual" name="manualCombo">
            <option value="none">{{ t.manualNone }}</option>
            <option value="late">{{ t.manualLate }}</option>
            <option value="rapid">{{ t.manualRapid }}</option>
          </select>
        </label>
      </template>
    </div>

    <div class="card stack" data-testid="wizard-mld">
      <h3>{{ t.massLandTitle }}</h3>
      <template v-if="suspects.massLand.length">
        <p class="muted">{{ t.massLandSuspects }}</p>
        <ul class="chips">
          <li v-for="name in suspects.massLand" :key="name" class="chip">{{ name }}</li>
        </ul>
      </template>
      <p v-else class="muted">{{ t.massLandNone }}</p>
      <label class="check">
        <input v-model="massLand" type="checkbox" name="massLand" />
        <span>{{ t.massLandCheck }}</span>
      </label>
    </div>

    <div class="card stack" data-testid="wizard-extra-turns">
      <h3>{{ t.extraTurnsTitle }}</h3>
      <template v-if="suspects.extraTurns.length">
        <p class="muted">{{ t.extraTurnsSuspects }}</p>
        <ul class="chips">
          <li v-for="name in suspects.extraTurns" :key="name" class="chip">{{ name }}</li>
        </ul>
      </template>
      <p v-else class="muted">{{ t.extraTurnsNone }}</p>
      <label class="check">
        <input v-model="chainExtraTurns" type="checkbox" name="chainExtraTurns" />
        <span>{{ t.extraTurnsCheck }}</span>
      </label>
      <small class="muted">{{ t.extraTurnsHelp }}</small>
    </div>

    <div class="card stack">
      <p>
        <strong>{{ t.floorLabel }}:</strong>
        <span class="chip chip--floor" data-testid="wizard-floor">{{ floor }}</span>
      </p>
      <p class="muted">{{ t.floorHelp(floor) }}</p>
      <label class="field">
        <span>{{ t.tierLabel }}</span>
        <select v-model="declared" name="declaredTier" data-testid="wizard-tier">
          <option v-for="c in choices" :key="c.tier" :value="c.tier" :disabled="c.disabled">
            {{ c.tier }}{{ c.disabled ? ` (${t.tierBelowFloor})` : '' }}
          </option>
        </select>
        <small class="muted">{{ t.tierHelp }}</small>
      </label>
    </div>

    <div class="actions">
      <button type="button" class="btn btn--secondary" :disabled="busy" @click="emit('back')">
        {{ it.importDeck.back }}
      </button>
      <button type="button" class="btn" :disabled="busy" data-testid="wizard-save" @click="confirm">
        {{ it.importDeck.save }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
  font-weight: 600;
}
.field small {
  font-weight: 400;
}
.field select {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  color-scheme: light dark;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.check {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: var(--tap);
  font-weight: 600;
}
.check input {
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
}
.chips,
.plain-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.plain-list {
  display: grid;
}
.chip {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.chip--floor {
  margin-left: 0.5rem;
  background: var(--accent-soft);
  border-color: var(--accent);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>

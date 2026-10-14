<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  MAX_TURN,
  buildClosePatch,
  closeProblems,
  comboChoices,
  deckCardNames,
  estimateTurn,
  isValidTurn,
  searchDeckCards,
  toggleCombo,
  winTypeIds,
} from '../domain/game-close.js';
import ComboPicker from '../components/ComboPicker.vue';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const t = it.closeGame;
const route = useRoute();
const data = useDataStore();

const config = ref(null);
const winnerLogin = ref('');
const turn = ref(null);
const turnSource = ref('dado');
const estimateNote = ref('');
const winType = ref('');
const notRepresentative = ref(false);
const notes = ref('');
/** login → { by, turn }: eliminazioni (facoltative). */
const eliminations = reactive({});
/** Combo salvate scelte (tipo «combo») e carte scelte con la ricerca (gli altri tipi). */
const winCombos = ref([]);
const winCards = ref([]);
const query = ref('');
/** Versione del mazzo del vincitore, da cui vengono combo e carte proposte. */
const deckVersion = ref(null);
const deckState = ref('idle');
const busy = ref(false);
const error = ref('');
/** Partita chiusa da questa pagina: serve per il riepilogo finale. */
const done = ref(null);

onMounted(async () => {
  data.loadMembers().catch(() => {});
  try {
    config.value = await data.getConfig();
  } catch {
    config.value = null; // si usano i parametri di default
  }
});

const me = computed(() => data.user?.login ?? '');
const nameOf = (login) => data.members?.[login]?.displayName ?? login;
const game = computed(
  () => data.snapshotWithPending?.games.find((g) => g.id === route.params.id) ?? null,
);
const decksById = computed(() =>
  Object.fromEntries((data.snapshotWithPending?.decks ?? []).map((d) => [d.id, d])),
);
const seats = computed(() => [...(game.value?.players ?? [])].sort((a, b) => a.seat - b.seat));
const open = computed(() => game.value && ['in_corso', 'lobby'].includes(game.value.status));
const canClose = computed(() => open.value && game.value.recorderLogin === me.value);
const winTypes = computed(() => winTypeIds(config.value));
const winTypeLabel = (id) => t.winTypes[id] ?? id;

const isCombo = computed(() => winType.value === 'combo');
const comboOptions = computed(() => comboChoices(deckVersion.value));
const suggestions = computed(() =>
  searchDeckCards(deckCardNames(deckVersion.value), query.value, winCards.value),
);

let loadToken = 0;
// Cambiando vincitore si cambia mazzo: la scelta si azzera e si leggono le carte del nuovo mazzo.
watch(winnerLogin, async (login) => {
  winCombos.value = [];
  winCards.value = [];
  query.value = '';
  deckVersion.value = null;
  const deckId = game.value?.players.find((p) => p.login === login)?.deckId;
  if (!deckId) {
    deckState.value = 'idle';
    return;
  }
  const token = ++loadToken;
  deckState.value = 'loading';
  try {
    const { deck, versions } = await data.getDeck(deckId);
    if (token !== loadToken) return;
    deckVersion.value =
      versions.find((v) => v.version === deck.currentVersion) ?? versions.at(-1) ?? null;
    deckState.value = 'ready';
  } catch {
    if (token === loadToken) deckState.value = 'failed';
  }
});
// Combo e carte sono scelte diverse: passando da «combo» a un altro tipo (o viceversa) si azzerano.
watch(isCombo, () => {
  winCombos.value = [];
  winCards.value = [];
  query.value = '';
});

const pickCombo = (combo) => {
  winCombos.value = toggleCombo(winCombos.value, combo);
};
const addCard = (name) => {
  winCards.value = [...winCards.value, name];
  query.value = '';
};
const removeCard = (name) => {
  winCards.value = winCards.value.filter((n) => n !== name);
};

const input = computed(() => ({
  winCombos: winCombos.value,
  winCards: winCards.value,
  winnerLogin: winnerLogin.value,
  turn: turn.value,
  turnSource: turnSource.value,
  winType: winType.value,
  notRepresentative: notRepresentative.value,
  notes: notes.value,
  eliminations: Object.entries(eliminations)
    .filter(([, e]) => e.by || e.turn != null)
    .map(([login, e]) => ({ login, by: e.by, turn: e.turn })),
}));
const problems = computed(() =>
  game.value ? closeProblems(game.value, input.value, winTypes.value) : [],
);

const setTurn = (value) => {
  const n = Number(value);
  turn.value = value === '' || Number.isNaN(n) ? null : Math.trunc(n);
  turnSource.value = 'dado';
  estimateNote.value = '';
};
const stepTurn = (delta) => {
  setTurn(Math.min(MAX_TURN, Math.max(1, (turn.value ?? 0) + delta)));
};

const useEstimate = () => {
  const guess = estimateTurn(game.value?.startedAt, new Date().toISOString(), config.value);
  if (guess == null) {
    estimateNote.value = t.estimateFailed;
    return;
  }
  turn.value = guess;
  turnSource.value = 'stima';
  const minutes = Math.round((Date.now() - Date.parse(game.value.startedAt)) / 60000);
  estimateNote.value = t.estimateInfo(guess, minutes);
};

const setEliminationBy = (login, by) => {
  eliminations[login] = { ...eliminations[login], by };
};
const setEliminationTurn = (login, value) => {
  const n = Number(value);
  eliminations[login] = {
    ...eliminations[login],
    turn: value === '' || Number.isNaN(n) ? null : Math.trunc(n),
  };
};

const save = async () => {
  if (busy.value || problems.value.length || !canClose.value) return;
  busy.value = true;
  error.value = '';
  try {
    const patch = buildClosePatch(game.value, input.value, new Date().toISOString());
    await data.write('updateGame', game.value.id, patch);
    done.value = { winner: nameOf(winnerLogin.value), turn: turn.value };
  } catch {
    error.value = t.error;
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <div class="stack close-game">
    <header>
      <h1>{{ done ? t.doneTitle : it.pages.closeGame.title }}</h1>
      <p v-if="!done" class="muted lead">{{ t.intro }}</p>
    </header>

    <p v-if="data.error" class="notice notice--error" role="alert">
      {{ it.dashboard.loadFailed }} {{ data.error }}
    </p>
    <p v-else-if="!data.snapshot" class="muted" role="status">{{ t.loading }}</p>

    <section v-else-if="done" class="card done" data-testid="close-done">
      <p class="done__main" data-testid="close-summary">{{ t.doneText(done.winner, done.turn) }}</p>
      <p v-if="data.refreshing" class="muted" data-testid="close-refreshing">
        {{ t.doneRefreshing }}
      </p>
      <div class="actions">
        <RouterLink to="/" class="btn">{{ t.toDashboard }}</RouterLink>
        <RouterLink to="/nuovo-tavolo" class="btn btn--secondary">{{ t.toLobby }}</RouterLink>
      </div>
    </section>

    <section v-else-if="!game" class="card notice" data-testid="close-notfound">
      <p>{{ t.notFound }}</p>
      <p class="muted">{{ t.notFoundHint }}</p>
    </section>

    <p v-else-if="!open" class="notice" data-testid="close-already" role="status">
      {{ t.alreadyClosed }}
    </p>

    <p v-else-if="!canClose" class="notice" data-testid="close-not-recorder" role="status">
      {{ t.notRecorder(nameOf(game.recorderLogin)) }}
    </p>

    <form v-else class="stack" @submit.prevent="save">
      <fieldset class="group" data-testid="close-winner">
        <legend>1. {{ t.winner }}</legend>
        <label v-for="p in seats" :key="p.login" class="choice">
          <input v-model="winnerLogin" type="radio" name="winner" :value="p.login" />
          <span class="choice__box">
            <strong>{{ nameOf(p.login) }}</strong>
            <small v-if="decksById[p.deckId]" class="muted">{{
              t.winnerDeck(decksById[p.deckId].name)
            }}</small>
          </span>
        </label>
      </fieldset>

      <fieldset class="group" data-testid="close-turn">
        <legend>2. {{ t.turn }}</legend>
        <div class="stepper">
          <button
            type="button"
            class="btn btn--secondary stepper__btn"
            :aria-label="t.turnLess"
            :disabled="!turn || turn <= 1"
            @click="stepTurn(-1)"
          >
            −
          </button>
          <input
            :value="turn ?? ''"
            class="stepper__input"
            type="number"
            inputmode="numeric"
            name="turn"
            min="1"
            :max="MAX_TURN"
            :aria-label="t.turnValue"
            data-testid="close-turn-input"
            @input="setTurn($event.target.value)"
          />
          <button
            type="button"
            class="btn btn--secondary stepper__btn"
            :aria-label="t.turnMore"
            :disabled="isValidTurn(turn) && turn >= MAX_TURN"
            @click="stepTurn(1)"
          >
            +
          </button>
        </div>
        <button
          type="button"
          class="btn btn--secondary"
          data-testid="close-estimate"
          @click="useEstimate"
        >
          {{ t.estimate }}
        </button>
        <p v-if="estimateNote" class="muted" data-testid="close-estimate-note" role="status">
          {{ estimateNote }}
        </p>
        <p v-if="turn" class="muted" data-testid="close-turn-source">
          {{ turnSource === 'stima' ? t.turnFromEstimate : t.turnFromDice }}
        </p>
      </fieldset>

      <fieldset class="group" data-testid="close-wintype">
        <legend>3. {{ t.winType }}</legend>
        <div class="types">
          <label v-for="id in winTypes" :key="id" class="choice">
            <input v-model="winType" type="radio" name="winType" :value="id" />
            <span class="choice__box">{{ winTypeLabel(id) }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="group" data-testid="close-wincards">
        <legend>{{ t.winCards }}</legend>
        <p v-if="!winnerLogin" class="muted">{{ t.winCardsChooseWinner }}</p>
        <p v-else-if="deckState === 'loading'" class="muted" role="status">
          {{ t.winCardsLoading }}
        </p>
        <p v-else-if="deckState === 'failed'" class="muted" role="status">
          {{ t.winCardsFailed }}
        </p>
        <template v-else-if="isCombo">
          <p class="muted">{{ t.combosHint }}</p>
          <p v-if="!comboOptions.length" class="muted" data-testid="close-no-combos">
            {{ t.combosNone }}
          </p>
          <ComboPicker
            v-if="comboOptions.length"
            :options="comboOptions"
            :chosen="winCombos"
            @toggle="pickCombo"
          />
        </template>
        <template v-else>
          <label class="field">
            <span>{{ t.searchLabel }}</span>
            <input
              v-model="query"
              type="search"
              name="cardSearch"
              autocomplete="off"
              data-testid="close-card-search"
            />
            <small class="muted field__hint">{{ t.searchHint }}</small>
          </label>
          <ul v-if="suggestions.length" class="suggest" data-testid="close-card-suggestions">
            <li v-for="name in suggestions" :key="name">
              <button type="button" class="suggest__btn" @click="addCard(name)">{{ name }}</button>
            </li>
          </ul>
          <p v-else-if="query.trim()" class="muted" data-testid="close-card-nomatch">
            {{ t.searchNoMatch }}
          </p>
          <p v-if="winCards.length" class="picked-title">{{ t.pickedCards }}</p>
          <ul
            v-if="winCards.length"
            class="chips"
            :aria-label="t.pickedCards"
            data-testid="close-picked"
          >
            <li v-for="name in winCards" :key="name" class="chip">
              <span>{{ name }}</span>
              <button
                type="button"
                class="chip__x"
                :aria-label="t.removeCard(name)"
                @click="removeCard(name)"
              >
                ×
              </button>
            </li>
          </ul>
        </template>
      </fieldset>

      <details class="card details" data-testid="close-details">
        <summary>{{ t.details }}</summary>
        <div class="stack">
          <fieldset class="group">
            <legend>{{ t.eliminations }}</legend>
            <p class="muted">{{ t.eliminationsHint }}</p>
            <div
              v-for="p in seats.filter((s) => s.login !== winnerLogin)"
              :key="p.login"
              class="elim"
            >
              <strong>{{ nameOf(p.login) }}</strong>
              <label class="field">
                <span>{{ t.eliminatedBy }}</span>
                <select
                  :value="eliminations[p.login]?.by ?? ''"
                  :name="`elim-by-${p.login}`"
                  @change="setEliminationBy(p.login, $event.target.value)"
                >
                  <option value="">{{ t.nobody }}</option>
                  <option
                    v-for="o in seats.filter((s) => s.login !== p.login)"
                    :key="o.login"
                    :value="o.login"
                  >
                    {{ nameOf(o.login) }}
                  </option>
                </select>
              </label>
              <label class="field">
                <span>{{ t.eliminatedTurn }}</span>
                <input
                  :value="eliminations[p.login]?.turn ?? ''"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  :max="MAX_TURN"
                  :name="`elim-turn-${p.login}`"
                  @input="setEliminationTurn(p.login, $event.target.value)"
                />
              </label>
            </div>
          </fieldset>
          <label class="check">
            <input v-model="notRepresentative" type="checkbox" name="notRepresentative" />
            <span>{{ t.notRepresentative }}</span>
          </label>
          <label class="field">
            <span>{{ t.notes }}</span>
            <textarea v-model="notes" name="notes" rows="3"></textarea>
          </label>
        </div>
      </details>

      <ul v-if="problems.length" class="muted problems" data-testid="close-problems">
        <li v-for="p in problems" :key="p">{{ t.problems[p] }}</li>
      </ul>
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>

      <button
        type="submit"
        class="btn"
        data-testid="close-save"
        :disabled="busy || problems.length > 0"
      >
        {{ busy ? t.saving : t.save }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.close-game > form,
.close-game > header,
.done,
.notice {
  max-width: 40rem;
}

.group {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.group legend {
  padding: 0;
  margin-bottom: 0.5rem;
  font-size: 1.125rem;
  font-weight: 700;
}

/* La casella vera copre tutta la riga (zona di tocco ≥ 44 px); il riquadro è solo disegno. */
.choice {
  position: relative;
  display: block;
  min-width: 0;
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
  display: grid;
  gap: 2px;
  align-content: center;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
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

.types {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
}

.suggest,
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.suggest {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.suggest__btn {
  width: 100%;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  text-align: left;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
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

/* Caselle a scelta multipla: un quadratino con la spunta, così lo stato non dipende solo dal colore. */
.choice--check .choice__box {
  position: relative;
  padding-left: 3rem;
}

.choice--check .choice__box::before {
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

.choice--check input:checked + .choice__box::before {
  border-color: var(--accent);
  background: var(--accent);
}

.choice--check input:checked + .choice__box::after {
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

.picked-title {
  margin: 0.5rem 0 0;
  font-weight: 700;
}

.field__hint {
  font-weight: 400;
}

.stepper {
  display: flex;
  align-items: stretch;
  gap: var(--space);
}

.stepper__btn {
  flex: none;
  min-width: 4rem;
  font-size: 1.75rem;
  line-height: 1;
}

.stepper__input,
.field input,
.field select,
.field textarea {
  min-width: 0;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--text-muted);
  border-radius: var(--radius-sm);
  color-scheme: light dark;
}

.stepper__input {
  flex: 1;
  width: 100%;
  min-height: 4rem;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}

.field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
  font-weight: 600;
}

.field textarea,
.field input,
.field select {
  width: 100%;
  font-weight: 400;
}

.check {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap);
}

.check input {
  flex: none;
  width: 24px;
  height: 24px;
}

.details {
  padding: var(--space);
}

.details summary {
  min-height: var(--tap);
  display: flex;
  align-items: center;
  font-weight: 700;
  cursor: pointer;
}

.details .stack {
  margin-top: var(--space);
}

.elim {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.problems {
  margin: 0;
  padding-left: 1.25rem;
}

.done {
  display: grid;
  gap: 0.75rem;
  padding: calc(var(--space) * 1.5);
}

.done h2,
.done p {
  margin: 0;
}

.done__main {
  font-size: 1.375rem;
  font-weight: 700;
}

.actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space);
  margin-top: var(--space);
}

@media (min-width: 768px) {
  .actions {
    display: flex;
    flex-wrap: wrap;
  }

  .types {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .elim {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
    align-items: end;
  }
}
</style>

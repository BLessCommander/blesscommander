<script setup>
import { TIER_IDS } from '@blesscommander/tier-engine';
import { computed, onMounted, ref, watch } from 'vue';
import {
  activeGameOf,
  buildLobbyGame,
  deckTier,
  decksForTier,
  lobbyFormats,
  lobbyProblems,
} from '../domain/lobby.js';
import { DECK_BUILDING, TABLE_MODES, TABLE_OPTIONS } from '../domain/lobby-catalog.js';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const t = it.lobby;
const data = useDataStore();

const config = ref(null);
const formatId = ref('ffa4');
/** Fascia del tavolo (F1–F5); vuota finché non si sceglie. */
const tableTier = ref('');
/** @type {import('vue').Ref<{ login: string, deckId: string }[]>} */
const picks = ref([]);
const firstLogin = ref('');
const recorderLogin = ref('');
const busy = ref(false);
const error = ref('');
/** Partita appena avviata da questa pagina (lo snapshot vero la mostra solo dopo il ricalcolo). */
const started = ref(null);

onMounted(async () => {
  data.loadMembers().catch(() => {});
  try {
    config.value = await data.getConfig();
  } catch {
    config.value = null; // si usano i formati di default
  }
});

const formats = computed(() => lobbyFormats(config.value));
const format = computed(
  () => formats.value.find((f) => f.id === formatId.value) ?? formats.value[0],
);

// Il catalogo mostra tutte le modalità; solo quelle accese (e note al motore) si possono scegliere.
const soonLabel = (name) => `${name} — ${t.soon}`;
const tableGroups = computed(() =>
  ['table', 'roles']
    .map((key) => ({
      key,
      label: t.groups[key],
      items: TABLE_MODES.filter((m) => m.group === key).map((m) => {
        const engine = formats.value.find((f) => f.id === m.id);
        return {
          ...m,
          enabled: m.enabled && Boolean(engine),
          label:
            m.enabled && engine
              ? t.formatOption(engine)
              : soonLabel(t.catalog.tableModes[m.id].name),
        };
      }),
    }))
    .filter((g) => g.items.length),
);
const deckBuildingItems = DECK_BUILDING.map((d) => {
  const text = t.catalog.deckBuilding[d.id];
  return { ...d, label: d.enabled ? text.name : soonLabel(text.name) };
});
const optionItems = TABLE_OPTIONS.map((o) => ({ ...o, ...t.catalog.options[o.id] }));

const nameOf = (login) => data.members?.[login]?.displayName ?? login;
const me = computed(() => data.user?.login ?? '');

const people = computed(() => {
  const logins = Object.keys(data.members ?? {});
  if (me.value && !logins.includes(me.value)) logins.push(me.value);
  return logins.sort((a, b) =>
    a === me.value ? -1 : b === me.value ? 1 : nameOf(a).localeCompare(nameOf(b), 'it'),
  );
});

const decksByOwner = computed(() => {
  const map = {};
  for (const d of data.snapshotWithPending?.decks ?? []) (map[d.ownerLogin] ??= []).push(d);
  for (const list of Object.values(map)) list.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  return map;
});
const decksById = computed(() =>
  Object.fromEntries((data.snapshotWithPending?.decks ?? []).map((d) => [d.id, d])),
);
// Solo i mazzi della fascia del tavolo: né più bassi né più alti.
// Nomi dei mazzi già visti: restano anche se lo store li ricarica (es. dopo il ricalcolo).
const knownDeckNames = ref({});
watch(
  decksById,
  (decks) => {
    for (const [id, deck] of Object.entries(decks)) knownDeckNames.value[id] = deck.name;
  },
  { immediate: true },
);
const deckName = (id) => knownDeckNames.value[id] ?? t.deckMissing;
const decksOf = (login) => decksForTier(decksByOwner.value[login] ?? [], tableTier.value);
const tierOf = deckTier;

const pickOf = (login) => picks.value.find((p) => p.login === login);
const toggle = (login) => {
  if (pickOf(login)) {
    picks.value = picks.value.filter((p) => p.login !== login);
    return;
  }
  picks.value = [...picks.value, { login, deckId: decksOf(login)[0]?.id ?? '' }];
};

const setDeck = (login, deckId) => {
  picks.value = picks.value.map((p) => (p.login === login ? { ...p, deckId } : p));
};

// Cambiando fascia si tiene il mazzo se è ancora ammesso, altrimenti il primo ammesso (o nessuno).
watch(tableTier, () => {
  picks.value = picks.value.map((p) => {
    const allowed = decksOf(p.login);
    return allowed.some((d) => d.id === p.deckId) ? p : { ...p, deckId: allowed[0]?.id ?? '' };
  });
});

// Il proprio nome è già al tavolo: di solito chi crea la lobby gioca.
watch(
  () => [me.value, data.snapshot],
  () => {
    if (me.value && !picks.value.length && data.snapshot) toggle(me.value);
  },
  { immediate: true },
);

// Un formato con meno posti toglie gli ultimi giocatori (mai chi crea il tavolo).
watch(formatId, () => {
  const max = format.value?.giocatoriMax ?? picks.value.length;
  const keep = [];
  for (const p of picks.value) if (keep.length < max || p.login === me.value) keep.push(p);
  picks.value = keep;
});

const pickedLogins = computed(() => picks.value.map((p) => p.login));
// Chi comincia e il registratore devono essere al tavolo: altrimenti si ripiega su chi crea.
const first = computed({
  get: () =>
    pickedLogins.value.includes(firstLogin.value)
      ? firstLogin.value
      : (pickedLogins.value[0] ?? ''),
  set: (login) => {
    firstLogin.value = login;
  },
});
const recorder = computed({
  get: () =>
    pickedLogins.value.includes(recorderLogin.value)
      ? recorderLogin.value
      : pickedLogins.value.includes(me.value)
        ? me.value
        : (pickedLogins.value[0] ?? ''),
  set: (login) => {
    recorderLogin.value = login;
  },
});

const problems = computed(() =>
  format.value
    ? lobbyProblems(format.value, picks.value, recorder.value, {
        tableTier: tableTier.value,
        decksById: decksById.value,
      })
    : ['players-few'],
);
const canAddMore = (login) =>
  Boolean(pickOf(login)) || picks.value.length < (format.value?.giocatoriMax ?? 0);

const activeGame = computed(
  () => activeGameOf(data.snapshotWithPending, me.value) ?? started.value,
);
const reminder = computed(() => {
  const game = activeGame.value;
  if (!game) return null;
  const firstPlayer = [...game.players].sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99))[0];
  const firstName = nameOf(firstPlayer?.login);
  return {
    id: game.id,
    text:
      game.recorderLogin === me.value
        ? t.reminderForRecorder(firstName)
        : t.reminderForOthers(nameOf(game.recorderLogin), firstName),
    tier: game.tableTier ?? '',
    time: game.startedAt
      ? new Date(game.startedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      : '',
    seats: [...game.players].sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99)),
  };
});

const start = async () => {
  if (busy.value || problems.value.length) return;
  busy.value = true;
  error.value = '';
  try {
    const game = buildLobbyGame({
      format: format.value,
      tableTier: tableTier.value,
      picks: picks.value.map((p) => ({ login: p.login, deckId: p.deckId })),
      firstLogin: first.value,
      recorderLogin: recorder.value,
      decksById: decksById.value,
      startedAt: new Date().toISOString(),
    });
    started.value = await data.write('createGame', game);
  } catch {
    error.value = t.error;
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <div class="stack lobby">
    <header>
      <h1>{{ it.pages.lobby.title }}</h1>
      <p class="muted lead">{{ t.intro }}</p>
    </header>

    <p v-if="data.error" class="notice notice--error" role="alert">
      {{ it.dashboard.loadFailed }} {{ data.error }}
    </p>
    <p v-else-if="!data.snapshot" class="muted" role="status">{{ t.loading }}</p>

    <section v-else-if="reminder" class="card reminder" data-testid="lobby-reminder">
      <h2>{{ t.reminderTitle }}</h2>
      <p class="reminder__main" data-testid="dice-reminder">{{ reminder.text }}</p>
      <p v-if="reminder.tier" class="reminder__tier" data-testid="reminder-tier">
        {{ t.tableTier(reminder.tier) }}
      </p>
      <p v-if="reminder.time" class="muted">{{ t.startedAt(reminder.time) }}</p>
      <p class="muted">{{ t.reminderInfo }}</p>
      <h3>{{ t.seats }}</h3>
      <ol class="reminder__seats">
        <li v-for="p in reminder.seats" :key="p.login">
          <strong>{{ t.seat(p.seat) }}</strong> · {{ nameOf(p.login) }} · {{ deckName(p.deckId) }}
        </li>
      </ol>
      <div class="reminder__actions">
        <RouterLink
          v-if="reminder.id && activeGame.recorderLogin === me"
          :to="`/partite/${reminder.id}/chiudi`"
          class="btn"
          data-testid="close-game-link"
          >{{ t.closeGame }}</RouterLink
        >
        <RouterLink to="/partite" class="btn btn--secondary">{{ t.toMatches }}</RouterLink>
      </div>
    </section>

    <form v-else class="stack" @submit.prevent="start">
      <label class="field">
        <span>{{ t.format }}</span>
        <select v-model="formatId" name="format" data-testid="lobby-format">
          <optgroup v-for="g in tableGroups" :key="g.key" :label="g.label">
            <option v-for="m in g.items" :key="m.id" :value="m.id" :disabled="!m.enabled">
              {{ m.label }}
            </option>
          </optgroup>
        </select>
      </label>

      <label class="field">
        <span>{{ t.tier }}</span>
        <select v-model="tableTier" name="tableTier" data-testid="lobby-tier">
          <option value="" disabled>{{ t.tierPlaceholder }}</option>
          <option v-for="id in TIER_IDS" :key="id" :value="id">{{ id }}</option>
        </select>
        <small class="muted field__hint">{{ t.tierHint }}</small>
      </label>

      <label class="field">
        <span>{{ t.deckBuilding }}</span>
        <select name="deckBuilding" data-testid="lobby-deck-building">
          <option
            v-for="d in deckBuildingItems"
            :key="d.id"
            :value="d.id"
            :disabled="!d.enabled"
            :selected="d.id === 'commander'"
          >
            {{ d.label }}
          </option>
        </select>
      </label>

      <fieldset class="options" data-testid="lobby-options">
        <legend>{{ t.optionsTitle }}</legend>
        <label v-for="o in optionItems" :key="o.id" class="option option--off">
          <input type="checkbox" disabled :name="`option-${o.id}`" />
          <span class="option__text">
            <span
              ><strong>{{ o.name }}</strong>
              <span class="option__badge muted">· {{ t.soon }}</span></span
            >
            <small class="muted">{{ o.note }}</small>
          </span>
        </label>
      </fieldset>
      <p class="muted" data-testid="lobby-soon-hint">{{ t.soonHint }}</p>

      <fieldset class="players">
        <legend>{{ t.players }}</legend>
        <p class="muted">{{ format ? t.playersHint(format) : '' }}</p>
        <div
          v-for="login in people"
          :key="login"
          class="seat"
          :class="{ 'seat--on': pickOf(login) }"
          :data-testid="`lobby-player-${login}`"
        >
          <label class="seat__main">
            <input
              type="checkbox"
              name="player"
              :checked="Boolean(pickOf(login))"
              :disabled="!canAddMore(login)"
              @change="toggle(login)"
            />
            <span class="seat__box" aria-hidden="true"></span>
            <span class="seat__name">
              {{ nameOf(login) }}<span v-if="login === me" class="muted"> ({{ t.me }})</span>
            </span>
          </label>
          <label v-if="pickOf(login)" class="field seat__deck">
            <span>{{ t.deck }}</span>
            <select
              :value="pickOf(login).deckId"
              name="deck"
              :aria-label="`${t.deck} di ${nameOf(login)}`"
              :disabled="!decksOf(login).length"
              @change="setDeck(login, $event.target.value)"
            >
              <option v-if="!decksOf(login).length" value="" disabled>
                {{ tableTier ? t.noDecksInTier(tableTier) : t.chooseTierFirst }}
              </option>
              <option v-else value="" disabled>{{ t.chooseDeck }}</option>
              <option v-for="d in decksOf(login)" :key="d.id" :value="d.id">
                {{ d.name }} ({{ tierOf(d) }})
              </option>
            </select>
          </label>
        </div>
      </fieldset>

      <div class="lobby__roles">
        <label class="field">
          <span>{{ t.first }}</span>
          <select v-model="first" name="first" data-testid="lobby-first">
            <option v-for="p in picks" :key="p.login" :value="p.login">
              {{ nameOf(p.login) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>{{ t.recorder }}</span>
          <select v-model="recorder" name="recorder" data-testid="lobby-recorder">
            <option v-for="p in picks" :key="p.login" :value="p.login">
              {{ nameOf(p.login) }}
            </option>
          </select>
        </label>
      </div>
      <p class="muted lobby__hint">{{ t.recorderHint }}</p>

      <ul v-if="problems.length" class="muted problems" data-testid="lobby-problems">
        <li v-for="p in problems" :key="p">{{ t.problems[p] }}</li>
      </ul>
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>

      <button
        type="submit"
        class="btn"
        data-testid="lobby-start"
        :disabled="busy || problems.length > 0"
      >
        {{ busy ? t.starting : t.start }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
  font-weight: 600;
}

.field__hint {
  font-weight: 400;
}

.field select {
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

.options {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.options legend {
  padding: 0;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

/* Inibita ma leggibile: bordo tratteggiato e testo pieno, senza opacità sul testo. */
.option--off {
  border: 1px dashed var(--text-muted);
  background: transparent;
}

.option--off .muted,
.option--off small {
  color: var(--text-muted);
}

.option--off input {
  accent-color: var(--text-muted);
}

.option__badge {
  margin-left: 0.25rem;
  font-size: 0.875rem;
  white-space: nowrap;
}

.option input {
  flex: none;
  width: 20px;
  height: 20px;
  margin: 2px 0 0;
}

.option__text {
  display: grid;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.lobby > form,
.lobby > header {
  max-width: 40rem;
}

.players {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.players legend {
  padding: 0;
  font-weight: 600;
}

.seat {
  display: grid;
  gap: 0.5rem;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.seat--on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.seat__main {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap);
  cursor: pointer;
}

/* La casella vera copre tutta la riga (zona di tocco ≥ 44 px); il quadratino è solo disegno. */
.seat__main input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.seat__box {
  position: relative;
  flex: none;
  width: 24px;
  height: 24px;
  border: 2px solid var(--text-muted);
  border-radius: 6px;
  background: var(--surface);
}

.seat__main input:checked + .seat__box {
  border-color: var(--accent);
  background: var(--accent);
}

.seat__main input:checked + .seat__box::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 7px;
  width: 6px;
  height: 12px;
  border: solid var(--surface);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.seat__main input:focus-visible + .seat__box {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.seat__main input:disabled + .seat__box {
  opacity: 0.5;
}

.seat__name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
}

.seat__deck {
  padding-bottom: 0.75rem;
}

.lobby__roles {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--space);
}

.lobby__hint {
  margin: 0;
}

@media (min-width: 768px) {
  .lobby__roles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.problems {
  margin: 0;
  padding-left: 1.25rem;
}

.reminder {
  display: grid;
  gap: 0.75rem;
  max-width: 40rem;
  padding: calc(var(--space) * 1.5);
}

.reminder__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space);
  margin-top: var(--space);
}

.reminder h2,
.reminder h3,
.reminder p {
  margin: 0;
}

.reminder__main {
  font-size: 1.375rem;
  font-weight: 700;
}

.reminder__tier {
  font-weight: 700;
}

.reminder__seats {
  margin: 0;
  padding-left: 1.25rem;
}
</style>

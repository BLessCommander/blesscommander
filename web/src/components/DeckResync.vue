<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { deckCards, parseDeckText } from '../domain/deck-parser.js';
import { planResync } from '../domain/deck-resync.js';
import { ImportRequestError, requestAndWait } from '../domain/import-request.js';
import { it } from '../i18n/it.js';
import { createScryfall } from '../platform/scryfall.js';
import { useDataStore } from '../stores/data.js';

const props = defineProps({
  /** Mazzo della lista (con `id` e `source.url`). */
  deck: { type: Object, required: true },
});

const t = it.decks.resync;
const data = useDataStore();
const scryfall = createScryfall();

const POLL_MS = 3000;
const POLL_LIMIT = 70;

const working = ref(false);
const result = ref(null); // { kind: 'ok' | 'same' | 'error', text }

let stopped = false;
onBeforeUnmount(() => {
  stopped = true;
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function summaryText({ added, removed, changed, renamed }) {
  const parts = [];
  if (added) parts.push(`${plural(added, 'carta entrata', 'carte entrate')}`);
  if (removed) parts.push(`${plural(removed, 'carta uscita', 'carte uscite')}`);
  if (changed) parts.push(`${plural(changed, 'quantità cambiata', 'quantità cambiate')}`);
  if (renamed) parts.push('nome aggiornato');
  return parts.join(', ');
}

async function resync() {
  working.value = true;
  result.value = null;
  try {
    const { deck, versions } = await data.getDeck(props.deck.id);
    const current = versions.find((v) => v.version === deck.currentVersion) ?? versions.at(-1);
    const fetched = await requestAndWait({
      create: (s, u) => data.write('requestImport', s, u),
      get: (id) => data.getImportRequest(id),
      source: 'archidekt',
      url: deck.source.url,
      wait,
      pollMs: POLL_MS,
      limit: POLL_LIMIT,
      isStopped: () => stopped,
    });
    const lookup = await scryfall.lookup(
      deckCards(parseDeckText(fetched.result)).map((line) => line.name),
    );
    const plan = planResync({
      deck,
      current,
      fetched,
      lookup,
      now: new Date().toISOString(),
    });
    if (plan.status === 'same') {
      result.value = { kind: 'same', text: t.same };
    } else if (plan.status === 'review') {
      result.value = { kind: 'error', text: t.review };
    } else {
      if (plan.version) await data.write('saveDeckVersion', deck.id, plan.version);
      const fresh = (await data.getDeck(deck.id)).deck;
      await data.write('saveDeck', {
        ...fresh,
        name: plan.deck.name,
        commanders: plan.deck.commanders,
        colorIdentity: plan.deck.colorIdentity,
        source: plan.deck.source,
      });
      result.value = { kind: 'ok', text: t.updated(summaryText(plan.summary)) };
    }
  } catch (e) {
    if (stopped) return;
    result.value = {
      kind: 'error',
      text:
        e instanceof ImportRequestError && e.kind === 'failed'
          ? t.failed(e.message)
          : e instanceof ImportRequestError && e.kind === 'timeout'
            ? t.timeout
            : t.requestFailed,
    };
  } finally {
    if (!stopped) working.value = false;
  }
}
</script>

<template>
  <div class="resync">
    <button
      type="button"
      class="btn btn--secondary"
      :disabled="working"
      :aria-label="t.buttonFor(deck.name)"
      data-testid="resync"
      @click="resync"
    >
      {{ working ? t.working : t.button }}
    </button>
    <p
      v-if="working || result"
      class="resync__status"
      :class="{ 'resync__status--error': result?.kind === 'error' }"
      :role="result?.kind === 'error' ? 'alert' : 'status'"
      aria-live="polite"
      data-testid="resync-status"
    >
      <span v-if="working" class="resync__spinner" aria-hidden="true"></span>
      {{ working ? t.waiting : result.text }}
    </p>
  </div>
</template>

<style scoped>
.resync {
  display: grid;
  gap: 8px;
  justify-items: start;
  margin-top: 12px;
}

.resync__status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--text);
  font-size: 0.9375rem;
}

.resync__status--error {
  color: var(--danger);
}

.resync__spinner {
  flex: none;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: resync-spin 0.9s linear infinite;
}

@keyframes resync-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .resync__spinner {
    animation: none;
  }
}
</style>

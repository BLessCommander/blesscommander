import { ref, watch } from 'vue';
import { sharedCardCache } from '../platform/card-cache.js';

/**
 * Costo, tipo, colori e testo delle carte non stanno nel mazzo: si leggono da Scryfall con la
 * cache del browser. Va chiamato una volta sola per scheda e il risultato passato ai componenti,
 * così due componenti non chiedono le stesse carte in parallelo.
 * @param {() => { scryfallId?: string }[]} getCards carte della versione salvata
 * @returns {{ info: import('vue').Ref<Record<string, import('../platform/scryfall.js').CardInfo>>,
 *   state: import('vue').Ref<'loading' | 'ready' | 'failed'>}}
 */
export function useCardData(getCards) {
  const info = ref({});
  const state = ref('loading');
  let run = 0;
  watch(
    getCards,
    async (cards) => {
      const current = ++run;
      const ids = [...new Set(cards.map((c) => c.scryfallId).filter(Boolean))];
      if (ids.length === 0) {
        info.value = {};
        state.value = 'ready';
        return;
      }
      state.value = 'loading';
      try {
        const found = await sharedCardCache().byIds(ids);
        if (current !== run) return;
        info.value = found;
        state.value = 'ready';
      } catch {
        if (current !== run) return;
        info.value = {};
        state.value = 'failed';
      }
    },
    { immediate: true },
  );
  return { info, state };
}

// Dati delle carte (costo, tipo, colori, immagine) con cache nel browser: ogni carta si chiede a
// Scryfall una volta sola e poi si riusa per `ttlMs`. Il resto dell'app usa solo questo modulo per
// leggere le carte già salvate nei mazzi; l'inserimento dei mazzi usa `scryfall.js` direttamente.

import { createIdbStore } from './card-store.js';
import { cardKey, createScryfall } from './scryfall.js';

/** @typedef {import('./scryfall.js').CardInfo} CardInfo */
/** @typedef {import('./card-store.js').CardStore} CardStore */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @param {{ scryfall?: import('./scryfall.js').Scryfall, store?: CardStore, ttlMs?: number, now?: () => number }} [options]
 */
export function createCardCache({
  scryfall = createScryfall(),
  store = createIdbStore(),
  ttlMs = WEEK_MS,
  now = () => Date.now(),
} = {}) {
  /** @param {string} key @returns {Promise<CardInfo | null>} */
  async function read(key) {
    try {
      const entry = await store.get(key);
      return entry && now() - entry.savedAt < ttlMs ? entry.card : null;
    } catch {
      return null;
    }
  }
  /** @param {string} key @param {CardInfo} card */
  const write = (key, card) => store.set(key, { card, savedAt: now() }).catch(() => {});

  return {
    /**
     * Carte per id Scryfall. Quelle non trovate mancano dal risultato.
     * @param {string[]} ids
     * @returns {Promise<Record<string, CardInfo>>}
     */
    async byIds(ids) {
      /** @type {Record<string, CardInfo>} */
      const found = {};
      const missing = [];
      for (const id of new Set(ids)) {
        const hit = await read(`id:${id}`);
        if (hit) found[id] = hit;
        else missing.push(id);
      }
      if (missing.length) {
        const fetched = await scryfall.lookupIds(missing);
        for (const [id, card] of Object.entries(fetched)) {
          found[id] = card;
          await write(`id:${id}`, card);
        }
      }
      return found;
    },

    /**
     * Carte per nome (per esempio i comandanti, che non stanno sempre nell'elenco carte).
     * @param {string[]} names
     * @returns {Promise<Record<string, CardInfo>>} chiavi: `cardKey` del nome richiesto
     */
    async byNames(names) {
      /** @type {Record<string, CardInfo>} */
      const found = {};
      const missing = [];
      for (const name of new Set(names)) {
        const hit = await read(`name:${cardKey(name)}`);
        if (hit) found[cardKey(name)] = hit;
        else missing.push(name);
      }
      if (missing.length) {
        const { cards } = await scryfall.lookup(missing);
        for (const [key, card] of Object.entries(cards)) {
          found[key] = card;
          await write(`name:${key}`, card);
          await write(`id:${card.scryfallId}`, card);
        }
      }
      return found;
    },
  };
}

/** @type {ReturnType<typeof createCardCache> | null} */
let shared = null;
/** Cache condivisa dell'app (creata alla prima richiesta). */
export function sharedCardCache() {
  shared ??= createCardCache();
  return shared;
}

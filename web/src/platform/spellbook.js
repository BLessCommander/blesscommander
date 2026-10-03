// Combo da Commander Spellbook (SPEC §3.2, §4.2). Unico punto dell'app che parla con
// backend.commanderspellbook.com. Verificato sull'API vera: POST /find-my-combos accetta richieste dal
// browser (risponde con l'origine di chi chiede) e `results.included` elenca le combo già complete nel mazzo.
// I test intercettano le richieste (tests/fixtures/spellbook-fake.js): nessuna rete vera.

/**
 * @typedef {{ id: string, cards: string[], produces: string[], infinite: boolean }} Combo
 * `infinite`: la combo produce un effetto infinito oppure fa vincere la partita.
 * @typedef {{ findCombos: (deck: { commanders: string[], cards: { name: string, qty: number }[] }) => Promise<Combo[]> }} Spellbook
 */

const API = 'https://backend.commanderspellbook.com';
const TIMEOUT_MS = 20000;

const isDecisive = (name) => /^infinite\b/i.test(name) || /^win the game$/i.test(name);

/**
 * Riduce una combo di Spellbook ai campi che servono all'app.
 * @param {any} raw
 * @returns {Combo}
 */
export function normalizeCombo(raw) {
  const produces = (raw.produces ?? []).map((p) => p.feature?.name).filter(Boolean);
  return {
    id: String(raw.id),
    cards: (raw.uses ?? []).map((u) => u.card?.name).filter(Boolean),
    produces,
    infinite: produces.some(isDecisive),
  };
}

/**
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Spellbook}
 */
export function createSpellbook({
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = TIMEOUT_MS,
} = {}) {
  return {
    async findCombos({ commanders, cards }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${API}/find-my-combos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            commanders: commanders.map((card) => ({ card, quantity: 1 })),
            main: cards.map((c) => ({ card: c.name, quantity: c.qty })),
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Commander Spellbook: risposta ${response.status}`);
        const body = await response.json();
        return (body.results?.included ?? []).map(normalizeCombo);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

import { buildConfig } from '@blesscommander/tier-engine';

/** Turno massimo accettato alla chiusura: oltre non è un conteggio plausibile con il dado. */
export const MAX_TURN = 99;

/**
 * Tipi di vittoria noti al motore (chiavi di `modificatoriVittoria`, anche quelle aggiunte dal gruppo).
 * @param {{ settings?: object } | null} [group]
 * @returns {string[]}
 */
export function winTypeIds(group) {
  return Object.keys(buildConfig(group ?? {}).params.modificatoriVittoria);
}

/**
 * Turno stimato dalla durata: minuti di partita divisi per i minuti di un giro di tavolo
 * (parametro `minutiPerGiroDefault`, SPEC 01), arrotondato e mai sotto 1. `null` senza orari validi.
 * @param {string | undefined} startedAt data ISO di inizio
 * @param {string} endedAt data ISO di fine
 * @param {{ settings?: object } | null} [group]
 */
export function estimateTurn(startedAt, endedAt, group) {
  const start = Date.parse(startedAt ?? '');
  const end = Date.parse(endedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const { minutiPerGiroDefault } = buildConfig(group ?? {}).params;
  const turn = Math.round((end - start) / 60000 / minutiPerGiroDefault);
  return Math.min(MAX_TURN, Math.max(1, turn));
}

/** Un turno valido è un intero tra 1 e `MAX_TURN`. */
export const isValidTurn = (turn) => Number.isInteger(turn) && turn >= 1 && turn <= MAX_TURN;

/**
 * @typedef {object} CloseInput
 * @property {string} winnerLogin
 * @property {number | null} turn
 * @property {'dado' | 'stima'} turnSource
 * @property {string} winType
 * @property {{ login: string, turn: number | null, by: string }[]} [eliminations]
 * @property {boolean} [notRepresentative]
 * @property {string} [notes]
 * @property {string[]} [winCards] carte scelte con la ricerca (tipi di vittoria diversi da «combo»)
 * @property {any[]} [winCombos] combo salvate scelte (tipo «combo»)
 */

/**
 * Motivi per cui la partita non si può ancora chiudere (vuoto = tutto a posto).
 * @param {any} game partita in corso
 * @param {CloseInput} input
 * @param {string[]} winTypes
 * @returns {('no-winner'|'no-turn'|'no-win-type'|'elimination-turn')[]}
 */
export function closeProblems(game, input, winTypes) {
  const problems = [];
  if (!game.players.some((p) => p.login === input.winnerLogin)) problems.push('no-winner');
  if (!isValidTurn(input.turn)) problems.push('no-turn');
  if (!winTypes.includes(input.winType)) problems.push('no-win-type');
  if ((input.eliminations ?? []).some((e) => e.turn != null && !isValidTurn(e.turn))) {
    problems.push('elimination-turn');
  }
  return problems;
}

/**
 * Modifiche da scrivere sulla partita per chiuderla (`updateGame`). Le eliminazioni vanno sui
 * giocatori; ne vale una sola per giocatore e mai quella del vincitore.
 * @param {any} game
 * @param {CloseInput} input
 * @param {string} endedAt data ISO di fine
 */
export function buildClosePatch(game, input, endedAt) {
  const winner = game.players.find((p) => p.login === input.winnerLogin);
  const eliminations = new Map(
    (input.eliminations ?? [])
      .filter((e) => e.login !== input.winnerLogin && e.turn != null)
      .map((e) => [e.login, e]),
  );
  const patch = {
    status: 'ufficiale',
    endedAt,
    winners: [{ login: winner.login, deckId: winner.deckId }],
    winTurn: input.turn,
    turnSource: input.turnSource,
    winType: input.winType,
    players: game.players.map((p) => {
      const rest = { ...p };
      delete rest.eliminatedTurn;
      delete rest.eliminatedBy;
      const e = eliminations.get(p.login);
      return e
        ? { ...rest, eliminatedTurn: e.turn, ...(e.by ? { eliminatedBy: e.by } : {}) }
        : rest;
    }),
  };
  const combos = input.winType === 'combo' ? (input.winCombos ?? []) : [];
  const cards = input.winType === 'combo' ? combos.flatMap((c) => c.cards) : (input.winCards ?? []);
  const uniqueCards = [...new Set(cards)];
  // Copia semplice (JSON): le combo scelte arrivano da oggetti reattivi di Vue, che structuredClone non regge.
  if (combos.length) patch.winCombos = JSON.parse(JSON.stringify(combos));
  if (uniqueCards.length) patch.winCards = uniqueCards;
  if (input.turnSource === 'stima') patch.estimatedTurn = input.turn;
  if (input.notRepresentative) patch.notRepresentative = true;
  const notes = (input.notes ?? '').trim();
  if (notes) patch.notes = notes;
  return patch;
}

/**
 * Più combo per partita? Un unico interruttore: con `false` se ne sceglie una sola
 * (scegliendone un'altra la prima si toglie). Il resto del codice non cambia.
 */
export const MULTI_COMBO = true;

/** Numero massimo di suggerimenti mostrati nella ricerca delle carte. */
const MAX_SUGGESTIONS = 8;

const plain = (text) =>
  String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').toLowerCase();

/** Chiave stabile di una combo: l'`id` di Spellbook, altrimenti i nomi delle carte in ordine. */
export const comboKey = (combo) => combo.id ?? [...(combo.cards ?? [])].map(plain).sort().join('+');

/** Testo di una combo: «Carta A + Carta B». */
export const comboLabel = (combo) => (combo.cards ?? []).join(' + ');

/**
 * Combo che si possono scegliere: quelle salvate nella versione del mazzo (le sole con carte).
 * @param {{ combos?: any[] } | null | undefined} version
 */
export const comboChoices = (version) =>
  (version?.combos ?? []).filter((c) => Array.isArray(c?.cards) && c.cards.length > 0);

/**
 * Aggiunge o toglie una combo dalla scelta, secondo `MULTI_COMBO`.
 * @param {any[]} selected combo già scelte
 * @param {any} combo
 * @param {boolean} [multi]
 */
export function toggleCombo(selected, combo, multi = MULTI_COMBO) {
  const key = comboKey(combo);
  const has = selected.some((c) => comboKey(c) === key);
  if (has) return selected.filter((c) => comboKey(c) !== key);
  return multi ? [...selected, combo] : [combo];
}

/**
 * Nomi delle carte del mazzo (senza doppioni), nell'ordine della lista.
 * @param {{ cards?: { name: string }[] } | null | undefined} version
 */
export const deckCardNames = (version) => [
  ...new Set((version?.cards ?? []).map((c) => c.name).filter(Boolean)),
];

/**
 * Suggerimenti della ricerca: solo carte del mazzo, senza accenti né maiuscole, che non sono già
 * scelte. Prima i nomi che iniziano con il testo cercato, poi gli altri; mai più di `MAX_SUGGESTIONS`.
 * @param {string[]} names carte del mazzo
 * @param {string} query
 * @param {string[]} [selected]
 */
export function searchDeckCards(names, query, selected = []) {
  const q = plain(query).trim();
  if (!q) return [];
  const taken = new Set(selected.map(plain));
  const found = names.filter((n) => !taken.has(plain(n)) && plain(n).includes(q));
  const starts = found.filter((n) => plain(n).startsWith(q));
  const rest = found.filter((n) => !plain(n).startsWith(q));
  return [...starts, ...rest].slice(0, MAX_SUGGESTIONS);
}

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
  if (input.turnSource === 'stima') patch.estimatedTurn = input.turn;
  if (input.notRepresentative) patch.notRepresentative = true;
  const notes = (input.notes ?? '').trim();
  if (notes) patch.notes = notes;
  return patch;
}

import { buildConfig } from '@blesscommander/tier-engine';

// Formati che la lobby offre (SPEC 02 §3.10): squadre, ruoli e Star arrivano con voci a parte.
const LOBBY_FORMAT_IDS = ['ffa4', 'ffa3', 'ffa56', '1v1'];

/**
 * @typedef {object} LobbyPick
 * @property {string} login
 * @property {string} deckId
 */

/**
 * Formati scelti dalla lobby, con i parametri del gruppo già uniti ai default.
 * @param {{ settings?: object, formats?: any[], variants?: any[] } | null} [group]
 */
export function lobbyFormats(group) {
  const { formats } = buildConfig(group ?? {});
  return LOBBY_FORMAT_IDS.map((id) => formats.find((f) => f.id === id)).filter(Boolean);
}

/**
 * Controlla il tavolo e restituisce i motivi per cui non si può iniziare (vuoto = tutto a posto).
 * @param {{ giocatoriMin: number, giocatoriMax: number }} format
 * @param {LobbyPick[]} picks giocatori scelti, con il mazzo (anche vuoto se non ancora scelto)
 * @param {string} recorderLogin
 * @returns {('players-few'|'players-many'|'no-deck'|'no-recorder')[]}
 */
export function lobbyProblems(format, picks, recorderLogin) {
  const problems = [];
  if (picks.length < format.giocatoriMin) problems.push('players-few');
  if (picks.length > format.giocatoriMax) problems.push('players-many');
  if (picks.some((p) => !p.deckId)) problems.push('no-deck');
  if (!picks.some((p) => p.login === recorderLogin)) problems.push('no-recorder');
  return problems;
}

/**
 * Ordina i giocatori in cerchio partendo da chi comincia: il primo ha il posto 1.
 * @param {LobbyPick[]} picks
 * @param {string} firstLogin
 */
export function seatOrder(picks, firstLogin) {
  const start = Math.max(
    0,
    picks.findIndex((p) => p.login === firstLogin),
  );
  return [...picks.slice(start), ...picks.slice(0, start)];
}

/**
 * Partita pronta per `createGame`, già «in corso». La fascia dei mazzi si fissa qui: è quella
 * che il motore userà per il peso del tavolo (SPEC 01).
 * @param {object} args
 * @param {{ id: string }} args.format
 * @param {LobbyPick[]} args.picks
 * @param {string} args.firstLogin
 * @param {string} args.recorderLogin
 * @param {Record<string, any>} args.decksById
 * @param {string} args.startedAt data e ora ISO di inizio
 */
export function buildLobbyGame({ format, picks, firstLogin, recorderLogin, decksById, startedAt }) {
  return {
    formatId: format.id,
    variants: [],
    recorderLogin,
    status: 'in_corso',
    startedAt,
    players: seatOrder(picks, firstLogin).map((p, i) => {
      const deck = decksById[p.deckId];
      const player = { login: p.login, deckId: p.deckId, seat: i + 1 };
      const tier = deck?.tier?.current ?? deck?.declaredTier;
      if (tier) player.tierAtGame = tier;
      return player;
    }),
  };
}

/**
 * Partita in lobby o in corso di un giocatore (come giocatore o come registratore).
 * @param {{ games?: any[] } | null} snapshot
 * @param {string | null | undefined} login
 */
export function activeGameOf(snapshot, login) {
  if (!snapshot || !login) return null;
  return (
    snapshot.games.find(
      (g) =>
        (g.status === 'lobby' || g.status === 'in_corso') &&
        (g.recorderLogin === login || g.players.some((p) => p.login === login)),
    ) ?? null
  );
}

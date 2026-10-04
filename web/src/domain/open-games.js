/** Chiave della memoria del dispositivo per le partite non ancora ricalcolate (vedi `useDataStore`). */
export const OPEN_GAMES_KEY = 'blc:pending-games';

/** Una partita provvisoria vecchia di più di un giorno non si ripristina: il ricalcolo l'avrebbe già letta. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const stamp = (game) => String(game.startedAt ?? game.createdAt ?? '');

/**
 * Partite aperte (lobby o in corso) in cui l'utente è registratore o giocatore, dalla più recente.
 * @param {{ games?: any[] } | null | undefined} snapshot
 * @param {string | null | undefined} login
 */
export function openGamesOf(snapshot, login) {
  if (!snapshot || !login) return [];
  return (snapshot.games ?? [])
    .filter(
      (g) =>
        (g.status === 'lobby' || g.status === 'in_corso') &&
        (g.recorderLogin === login || g.players?.some((p) => p.login === login)),
    )
    .sort((a, b) => stamp(b).localeCompare(stamp(a)));
}

/** Il giocatore del primo posto: da lui il registratore conta i turni. */
export const firstPlayerOf = (game) =>
  [...(game.players ?? [])].sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99))[0] ?? null;

/**
 * Testo da salvare nella memoria del dispositivo.
 * @param {any[]} games
 * @param {number} now millisecondi (passati da fuori: la logica non legge l'orologio)
 */
export function serializeGames(games, now) {
  return JSON.stringify(games.map((game) => ({ savedAt: now, game })));
}

/**
 * Partite lette dalla memoria del dispositivo: ignora testo rovinato e voci scadute.
 * @param {string | null} text
 * @param {number} now
 * @returns {any[]}
 */
export function parseGames(text, now) {
  if (!text) return [];
  try {
    const list = JSON.parse(text);
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (e) =>
          typeof e?.game?.id === 'string' &&
          Number.isFinite(e.savedAt) &&
          now - e.savedAt <= MAX_AGE_MS,
      )
      .map((e) => e.game);
  } catch {
    return [];
  }
}

// Numeri mostrati nelle pagine, ricavati dallo snapshot (già ricalcolato dall'Action).
// Funzioni pure: nessun accesso ai dati, niente `Date.now()`.

const TIER_IDS = ['F1', 'F2', 'F3', 'F4', 'F5'];

/** @typedef {import('../data/data-provider.js').Snapshot} Snapshot */

const official = (snapshot) => snapshot.games.filter((g) => g.status === 'ufficiale');

/**
 * @param {Snapshot} snapshot
 * @param {string} login
 * @returns {{ officialGames: number, myGames: number, myWins: number, winRate: number | null, avgTmv: number | null, perTier: Record<string, number>, decks: number }}
 */
export function dashboardStats(snapshot, login) {
  const games = official(snapshot);
  const mine = games.filter((g) => g.players.some((p) => p.login === login));
  const myWins = mine.filter((g) => (g.winners ?? []).some((w) => w.login === login)).length;
  const tmvs = snapshot.decks
    .filter((d) => d.ownerLogin === login)
    .map((d) => d.tier?.tmv)
    .filter((v) => typeof v === 'number');
  /** @type {Record<string, number>} */
  const perTier = Object.fromEntries(TIER_IDS.map((id) => [id, 0]));
  for (const deck of snapshot.decks) {
    const id = deck.tier?.current;
    if (id in perTier) perTier[id] += 1;
  }
  return {
    officialGames: games.length,
    myGames: mine.length,
    myWins,
    winRate: mine.length > 0 ? Math.round((myWins / mine.length) * 100) : null,
    avgTmv: tmvs.length > 0 ? tmvs.reduce((a, b) => a + b, 0) / tmvs.length : null,
    perTier,
    decks: snapshot.decks.length,
  };
}

/**
 * Ultime partite chiuse, dalla più recente. Il nome vincitore è quello del mazzo.
 * @param {Snapshot} snapshot
 * @param {number} [limit]
 */
export function recentGames(snapshot, limit = 5) {
  const nameOf = new Map(snapshot.decks.map((d) => [d.id, d.name]));
  return official(snapshot)
    .map((g) => ({
      id: g.id,
      formatId: g.formatId,
      date: String(g.endedAt ?? g.createdAt).slice(0, 10),
      winners: (g.winners ?? []).map((w) => nameOf.get(w.deckId) ?? w.login),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, limit);
}

/**
 * Mazzi ordinati per fascia (dalla più alta) e poi per nome.
 * @param {Snapshot} snapshot
 */
export function sortedDecks(snapshot) {
  const rank = (d) => TIER_IDS.indexOf(d.tier?.current ?? d.declaredTier);
  return [...snapshot.decks].sort(
    (a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name, 'it'),
  );
}

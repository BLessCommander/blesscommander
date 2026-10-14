// Storico delle partite ufficiali e filtri della pagina Partite. Funzioni pure.

/** @typedef {import('../data/data-provider.js').Snapshot} Snapshot */

/**
 * @typedef {object} GameRowPlayer
 * @property {string} login
 * @property {string} deckId
 * @property {string} deckName
 * @property {number | null} seat
 * @property {number | null} eliminatedTurn
 * @property {string | null} eliminatedBy Chi lo ha eliminato
 * @property {boolean} won
 */

/**
 * @typedef {object} GameRow
 * @property {string} id
 * @property {string} date YYYY-MM-DD
 * @property {string} formatId
 * @property {string} tier Fascia del tavolo ('' se non registrata)
 * @property {string | null} winType
 * @property {number | null} turn
 * @property {boolean} estimatedTurn
 * @property {GameRowPlayer[]} players In ordine di posto
 * @property {string[]} combos
 * @property {string[]} cards
 * @property {string} notes
 */

/**
 * @typedef {object} GameFilters
 * @property {string} [from] Data minima, YYYY-MM-DD
 * @property {string} [to] Data massima, YYYY-MM-DD
 * @property {string} [deckId]
 * @property {string} [login] Giocatore presente al tavolo
 * @property {string} [formatId]
 * @property {string} [tier]
 * @property {string} [winType]
 * @property {'' | 'won' | 'lost'} [result] Esito per chi guarda (`me`)
 */

const comboText = (combo) =>
  Array.isArray(combo?.cards) ? combo.cards.join(' + ') : String(combo?.name ?? combo);

/**
 * Partite ufficiali, dalla più recente.
 * @param {Snapshot} snapshot
 * @returns {GameRow[]}
 */
export function gameRows(snapshot) {
  const decks = new Map(snapshot.decks.map((d) => [d.id, d.name]));
  return (snapshot.games ?? [])
    .filter((g) => g.status === 'ufficiale')
    .map((g) => {
      const winners = g.winners ?? [];
      const players = [...g.players]
        .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99))
        .map((p) => ({
          login: p.login,
          deckId: p.deckId,
          deckName: decks.get(p.deckId) ?? p.deckId,
          seat: p.seat ?? null,
          eliminatedTurn: p.eliminatedTurn ?? null,
          eliminatedBy: p.eliminatedBy ?? null,
          won: winners.some((w) => w.login === p.login && w.deckId === p.deckId),
        }));
      return {
        id: g.id,
        date: String(g.endedAt ?? g.createdAt).slice(0, 10),
        formatId: g.formatId,
        tier: g.tableTier ?? '',
        winType: g.winType ?? null,
        turn: g.winTurn ?? null,
        estimatedTurn: g.turnSource === 'stima',
        players,
        combos: (g.winCombos ?? []).map(comboText),
        cards: g.winCards ?? [],
        notes: g.notes ?? '',
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/**
 * Applica i filtri (tutti insieme). «Vinte/perse» guarda le partite di `me`.
 * @param {GameRow[]} rows
 * @param {GameFilters} filters
 * @param {string} [me]
 * @returns {GameRow[]}
 */
export function filterGames(rows, filters, me = '') {
  const f = filters ?? {};
  return rows.filter((r) => {
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    if (f.formatId && r.formatId !== f.formatId) return false;
    if (f.tier && r.tier !== f.tier) return false;
    if (f.winType && r.winType !== f.winType) return false;
    if (f.deckId && !r.players.some((p) => p.deckId === f.deckId)) return false;
    if (f.login && !r.players.some((p) => p.login === f.login)) return false;
    if (f.result) {
      const mine = r.players.find((p) => p.login === me);
      if (!mine) return false;
      if ((f.result === 'won') !== mine.won) return false;
    }
    return true;
  });
}

/** Quanti filtri sono attivi (per il badge del pulsante). */
export const activeFilterCount = (filters) =>
  Object.values(filters ?? {}).filter((v) => v !== '' && v != null).length;

/**
 * Valori disponibili per i menu dei filtri, ricavati dalle partite.
 * @param {GameRow[]} rows
 */
export function filterOptions(rows) {
  const uniq = (values) => [...new Set(values.filter(Boolean))].sort();
  const decks = new Map();
  for (const r of rows) for (const p of r.players) decks.set(p.deckId, p.deckName);
  return {
    formats: uniq(rows.map((r) => r.formatId)),
    tiers: uniq(rows.map((r) => r.tier)),
    winTypes: uniq(rows.map((r) => r.winType)),
    logins: uniq(rows.flatMap((r) => r.players.map((p) => p.login))),
    decks: [...decks]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

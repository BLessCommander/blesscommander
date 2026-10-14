// Numeri della scheda di un mazzo, ricavati dallo snapshot. Funzioni pure.

const TIER_IDS = ['F1', 'F2', 'F3', 'F4', 'F5'];

/** @typedef {import('../data/data-provider.js').Snapshot} Snapshot */

/**
 * Storico delle fasce di un mazzo, dal più vecchio. Il primo punto è la fascia di partenza
 * (il `from` del primo cambio, altrimenti quella attuale); gli eventi annullati si ignorano.
 * @param {Snapshot & { events?: any[] }} snapshot
 * @param {string} deckId
 * @returns {{ tier: string, at: string | null, reasons: string[] }[]}
 */
export function tierHistory(snapshot, deckId) {
  const deck = snapshot.decks.find((d) => d.id === deckId);
  const events = (snapshot.events ?? [])
    .filter((e) => e.deckId === deckId && !e.cancelled)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const current = deck?.tier?.current ?? deck?.declaredTier ?? null;
  const start = events[0]?.from ?? current;
  if (!start) return [];
  return [
    { tier: start, at: null, reasons: [] },
    ...events.map((e) => ({
      tier: e.to,
      at: String(e.createdAt).slice(0, 10),
      reasons: e.reasons ?? [],
    })),
  ];
}

/**
 * Tipi di vittoria del mazzo, dal più frequente.
 * @param {{ stats?: { winTypes?: Record<string, number> } }} deck
 * @returns {{ type: string, count: number }[]}
 */
export function winTypeList(deck) {
  return Object.entries(deck.stats?.winTypes ?? {})
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

/**
 * Avversari battuti dal mazzo e avversari che lo hanno battuto (partite ufficiali).
 * Un compagno di squadra vincitore non conta come battuto.
 * @param {Snapshot} snapshot
 * @param {string} deckId
 * @param {number} [limit]
 * @returns {{ beaten: { deckId: string, name: string, count: number }[], beatenBy: { deckId: string, name: string, count: number }[] }}
 */
export function opponentTables(snapshot, deckId, limit = 5) {
  const names = new Map(snapshot.decks.map((d) => [d.id, d.name]));
  /** @type {Map<string, number>} */
  const beaten = new Map();
  /** @type {Map<string, number>} */
  const beatenBy = new Map();
  const bump = (map, id) => map.set(id, (map.get(id) ?? 0) + 1);

  for (const game of snapshot.games) {
    if (game.status !== 'ufficiale') continue;
    if (!game.players.some((p) => p.deckId === deckId)) continue;
    const winnerDecks = (game.winners ?? []).map((w) => w.deckId);
    if (winnerDecks.includes(deckId)) {
      for (const p of game.players) {
        if (!winnerDecks.includes(p.deckId)) bump(beaten, p.deckId);
      }
    } else {
      for (const id of winnerDecks) bump(beatenBy, id);
    }
  }
  const toList = (map) =>
    [...map.entries()]
      .map(([id, count]) => ({ deckId: id, name: names.get(id) ?? id, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'it'))
      .slice(0, limit);
  return { beaten: toList(beaten), beatenBy: toList(beatenBy) };
}

/**
 * @typedef {object} DeckGameRow
 * @property {string} id
 * @property {string} date  data (AAAA-MM-GG) di fine partita, altrimenti di creazione
 * @property {boolean} won
 * @property {string | null} winType
 * @property {number | null} turn
 * @property {boolean} estimatedTurn
 * @property {string[]} combos  combo della vittoria, come testo
 * @property {string[]} cards   carte della vittoria
 * @property {string[]} opponents  nomi dei mazzi avversari
 */

const comboText = (combo) =>
  Array.isArray(combo?.cards) ? combo.cards.join(' + ') : String(combo?.name ?? combo);

/**
 * Partite ufficiali giocate dal mazzo, dalla più recente.
 * @param {Snapshot} snapshot
 * @param {string} deckId
 * @returns {DeckGameRow[]}
 */
export function deckGameHistory(snapshot, deckId) {
  const names = new Map(snapshot.decks.map((d) => [d.id, d.name]));
  return snapshot.games
    .filter((g) => g.status === 'ufficiale' && g.players.some((p) => p.deckId === deckId))
    .map((g) => ({
      id: g.id,
      date: String(g.endedAt ?? g.createdAt).slice(0, 10),
      won: (g.winners ?? []).some((w) => w.deckId === deckId),
      winType: g.winType ?? null,
      turn: g.winTurn ?? null,
      estimatedTurn: g.turnSource === 'stima',
      combos: (g.winCombos ?? []).map(comboText),
      cards: g.winCards ?? [],
      opponents: g.players
        .filter((p) => p.deckId !== deckId)
        .map((p) => names.get(p.deckId) ?? p.deckId),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** Posizione di una fascia sull'asse del grafico (F1 = 1 … F5 = 5). */
export const tierLevel = (tier) => TIER_IDS.indexOf(tier) + 1;

import { describe, expect, it } from 'vitest';
import { activeFilterCount, filterGames, filterOptions, gameRows } from './game-history.js';

const player = (login, deckId, extra = {}) => ({ login, deckId, seat: 1, ...extra });
const game = (id, endedAt, extra = {}) => ({
  id,
  status: 'ufficiale',
  formatId: 'ffa4',
  tableTier: 'F2',
  createdAt: endedAt,
  endedAt,
  players: [player('ann', 'a', { seat: 2 }), player('bob', 'b')],
  winners: [{ login: 'bob', deckId: 'b' }],
  winTurn: 7,
  turnSource: 'dado',
  winType: 'combo',
  ...extra,
});
const snapshot = {
  decks: [
    { id: 'a', name: 'Alfa' },
    { id: 'b', name: 'Beta' },
  ],
  games: [
    game('g1', '2026-01-10T20:00:00Z'),
    game('g2', '2026-03-05T20:00:00Z', {
      formatId: 'ffa3',
      tableTier: 'F3',
      winType: 'creature',
      winners: [{ login: 'ann', deckId: 'a' }],
      winCombos: [{ cards: ['X', 'Y'] }],
      winCards: ['Z'],
    }),
    game('g3', '2026-02-01T20:00:00Z', { status: 'in_corso' }),
  ],
};

describe('gameRows', () => {
  const rows = gameRows(snapshot);

  it('tiene le sole partite ufficiali, dalla più recente', () => {
    expect(rows.map((r) => r.id)).toEqual(['g2', 'g1']);
  });

  it('ordina i giocatori per posto e segna chi ha vinto', () => {
    const g1 = rows[1];
    expect(g1.players.map((p) => p.login)).toEqual(['bob', 'ann']);
    expect(g1.players.map((p) => p.won)).toEqual([true, false]);
    expect(g1.players[0].deckName).toBe('Beta');
  });

  it('porta combo e carte della vittoria', () => {
    expect(rows[0].combos).toEqual(['X + Y']);
    expect(rows[0].cards).toEqual(['Z']);
  });
});

describe('filterGames', () => {
  const rows = gameRows(snapshot);
  const ids = (filters, me) => filterGames(rows, filters, me).map((r) => r.id);

  it('senza filtri restituisce tutto', () => {
    expect(ids({})).toEqual(['g2', 'g1']);
  });

  it('filtra per data, estremi compresi', () => {
    expect(ids({ from: '2026-02-01' })).toEqual(['g2']);
    expect(ids({ to: '2026-01-10' })).toEqual(['g1']);
    expect(ids({ from: '2026-01-10', to: '2026-03-05' })).toEqual(['g2', 'g1']);
  });

  it('filtra per formato, fascia, tipo di vittoria, mazzo e giocatore', () => {
    expect(ids({ formatId: 'ffa3' })).toEqual(['g2']);
    expect(ids({ tier: 'F2' })).toEqual(['g1']);
    expect(ids({ winType: 'combo' })).toEqual(['g1']);
    expect(ids({ deckId: 'a' })).toEqual(['g2', 'g1']);
    expect(ids({ login: 'zoe' })).toEqual([]);
  });

  it('vinte e perse guardano chi sta consultando', () => {
    expect(ids({ result: 'won' }, 'ann')).toEqual(['g2']);
    expect(ids({ result: 'lost' }, 'ann')).toEqual(['g1']);
    expect(ids({ result: 'won' }, 'nessuno')).toEqual([]);
  });

  it('combina i filtri', () => {
    expect(ids({ winType: 'combo', formatId: 'ffa3' })).toEqual([]);
  });
});

describe('opzioni e conteggio', () => {
  it('ricava i valori dei menu', () => {
    const o = filterOptions(gameRows(snapshot));
    expect(o.formats).toEqual(['ffa3', 'ffa4']);
    expect(o.tiers).toEqual(['F2', 'F3']);
    expect(o.decks.map((d) => d.name)).toEqual(['Alfa', 'Beta']);
  });

  it('conta i filtri attivi', () => {
    expect(activeFilterCount({ from: '', deckId: 'a', result: 'won' })).toBe(2);
  });
});

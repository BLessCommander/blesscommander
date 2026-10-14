import { describe, expect, it } from 'vitest';
import {
  deckGameHistory,
  opponentTables,
  tierHistory,
  tierLevel,
  winTypeList,
} from './deck-stats.js';

const deck = (id, name, extra = {}) => ({ id, name, declaredTier: 'F2', ...extra });
const game = (id, players, winners, status = 'ufficiale') => ({
  id,
  status,
  players: players.map((deckId) => ({ deckId })),
  winners: winners.map((deckId) => ({ deckId })),
});

describe('tierHistory', () => {
  const snapshot = {
    decks: [deck('a', 'A', { tier: { current: 'F4' } })],
    games: [],
    events: [
      {
        deckId: 'a',
        from: 'F3',
        to: 'F4',
        createdAt: '2026-03-02T10:00:00Z',
        reasons: ['velocità'],
      },
      { deckId: 'a', from: 'F2', to: 'F3', createdAt: '2026-02-01T10:00:00Z', reasons: [] },
      { deckId: 'a', from: 'F4', to: 'F5', createdAt: '2026-04-01T10:00:00Z', cancelled: true },
      { deckId: 'b', from: 'F1', to: 'F2', createdAt: '2026-01-01T10:00:00Z' },
    ],
  };

  it('parte dalla fascia iniziale e segue gli eventi in ordine, senza quelli annullati', () => {
    expect(tierHistory(snapshot, 'a')).toEqual([
      { tier: 'F2', at: null, reasons: [] },
      { tier: 'F3', at: '2026-02-01', reasons: [] },
      { tier: 'F4', at: '2026-03-02', reasons: ['velocità'] },
    ]);
  });

  it('senza eventi dà un solo punto con la fascia attuale', () => {
    expect(
      tierHistory({ decks: [deck('c', 'C', { tier: { current: 'F3' } })], games: [] }, 'c'),
    ).toEqual([{ tier: 'F3', at: null, reasons: [] }]);
  });

  it('usa la fascia dichiarata se non c’è quella calcolata; mazzo ignoto = vuoto', () => {
    expect(tierHistory({ decks: [deck('c', 'C')], games: [] }, 'c')[0].tier).toBe('F2');
    expect(tierHistory({ decks: [], games: [] }, 'x')).toEqual([]);
  });
});

describe('winTypeList', () => {
  it('ordina dal più frequente e salta gli zeri', () => {
    expect(winTypeList({ stats: { winTypes: { combo: 1, combattimento: 3, veleno: 0 } } })).toEqual(
      [
        { type: 'combattimento', count: 3 },
        { type: 'combo', count: 1 },
      ],
    );
  });

  it('senza dati dà un elenco vuoto', () => {
    expect(winTypeList({})).toEqual([]);
  });
});

describe('opponentTables', () => {
  const snapshot = {
    decks: [deck('a', 'Alfa'), deck('b', 'Beta'), deck('c', 'Gamma')],
    games: [
      game('1', ['a', 'b', 'c'], ['a']),
      game('2', ['a', 'b'], ['a']),
      game('3', ['a', 'b', 'c'], ['b']),
      game('4', ['a', 'c'], ['c']),
      game('5', ['a', 'b'], ['b'], 'bozza'),
      game('6', ['b', 'c'], ['b']),
    ],
  };

  it('conta battuti e battitori nelle sole partite ufficiali in cui il mazzo gioca', () => {
    const { beaten, beatenBy } = opponentTables(snapshot, 'a');
    expect(beaten).toEqual([
      { deckId: 'b', name: 'Beta', count: 2 },
      { deckId: 'c', name: 'Gamma', count: 1 },
    ]);
    expect(beatenBy).toEqual([
      { deckId: 'b', name: 'Beta', count: 1 },
      { deckId: 'c', name: 'Gamma', count: 1 },
    ]);
  });

  it('un compagno di squadra vincitore non è un battuto', () => {
    const team = { decks: snapshot.decks, games: [game('t', ['a', 'b', 'c'], ['a', 'b'])] };
    expect(opponentTables(team, 'a').beaten).toEqual([{ deckId: 'c', name: 'Gamma', count: 1 }]);
  });

  it('rispetta il limite e usa l’id se il mazzo non esiste più', () => {
    const lonely = { decks: [deck('a', 'Alfa')], games: [game('1', ['a', 'z'], ['a'])] };
    expect(opponentTables(lonely, 'a').beaten).toEqual([{ deckId: 'z', name: 'z', count: 1 }]);
    expect(opponentTables(snapshot, 'a', 1).beaten).toHaveLength(1);
  });
});

describe('tierLevel', () => {
  it('F1 = 1 … F5 = 5', () => {
    expect(['F1', 'F3', 'F5'].map(tierLevel)).toEqual([1, 3, 5]);
  });
});

describe('deckGameHistory', () => {
  const full = (id, endedAt, extra = {}) => ({
    ...game(id, ['a', 'b'], ['a']),
    createdAt: '2026-01-01T10:00:00Z',
    endedAt,
    ...extra,
  });
  const snapshot = {
    decks: [deck('a', 'A'), deck('b', 'B'), deck('c', 'C')],
    games: [
      full('g1', '2026-02-01T22:00:00Z', { winTurn: 7, winType: 'combo' }),
      full('g2', '2026-03-01T22:00:00Z', {
        winners: [{ deckId: 'b' }],
        turnSource: 'stima',
        winTurn: 5,
      }),
      full('g3', '2026-04-01T22:00:00Z', {
        winCombos: [{ cards: ['X', 'Y'] }],
        winCards: ['X', 'Y'],
      }),
      { ...game('g4', ['a', 'b'], ['a'], 'in_corso'), createdAt: '2026-05-01T10:00:00Z' },
      full('g5', '2026-06-01T22:00:00Z', { players: [{ deckId: 'b' }, { deckId: 'c' }] }),
    ],
  };

  it('prende solo le partite ufficiali del mazzo, dalla più recente', () => {
    expect(deckGameHistory(snapshot, 'a').map((g) => g.id)).toEqual(['g3', 'g2', 'g1']);
  });

  it('dice se il mazzo ha vinto e contro chi ha giocato', () => {
    const rows = deckGameHistory(snapshot, 'a');
    expect(rows.map((g) => g.won)).toEqual([true, false, true]);
    expect(rows[0].opponents).toEqual(['B']);
  });

  it('porta tipo, turno (stimato o no), combo e carte della vittoria', () => {
    const [g3, g2, g1] = deckGameHistory(snapshot, 'a');
    expect(g1).toMatchObject({
      winType: 'combo',
      turn: 7,
      estimatedTurn: false,
      date: '2026-02-01',
    });
    expect(g2).toMatchObject({ turn: 5, estimatedTurn: true });
    expect(g3.combos).toEqual(['X + Y']);
    expect(g3.cards).toEqual(['X', 'Y']);
    expect(g1.combos).toEqual([]);
    expect(g1.cards).toEqual([]);
  });

  it('è vuoto per un mazzo senza partite', () => {
    expect(deckGameHistory(snapshot, 'zzz')).toEqual([]);
  });
});

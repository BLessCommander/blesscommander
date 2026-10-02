import { describe, expect, it } from 'vitest';
import { dashboardStats, recentGames, sortedDecks } from './snapshot-stats.js';

const deck = (id, name, owner, current, tmv = null) => ({
  id,
  name,
  ownerLogin: owner,
  declaredTier: current,
  tier: { current, tmv },
  stats: { games: 0, wins: 0 },
});
const game = (id, status, players, winners, endedAt) => ({
  id,
  formatId: 'standard',
  status,
  createdAt: '2026-01-01T00:00:00Z',
  endedAt,
  players: players.map((login) => ({ login, deckId: `deck-${login}` })),
  winners: winners.map((login) => ({ login, deckId: `deck-${login}` })),
});

const snapshot = {
  decks: [
    deck('deck-a', 'Alfa', 'a', 'F2', 6),
    deck('deck-b', 'Beta', 'b', 'F4', 4),
    deck('deck-c', 'Casa', 'a', 'F2', 8),
  ],
  games: [
    game('g1', 'ufficiale', ['a', 'b'], ['a'], '2026-02-01T20:00:00Z'),
    game('g2', 'ufficiale', ['a', 'b'], ['b'], '2026-03-01T20:00:00Z'),
    game('g3', 'lobby', ['a', 'b'], [], undefined),
  ],
  standings: [],
  updatedAt: '2026-03-01T20:00:00Z',
};

describe('dashboardStats', () => {
  it('conta solo le partite ufficiali', () => {
    const stats = dashboardStats(snapshot, 'a');
    expect(stats.officialGames).toBe(2);
    expect(stats.myGames).toBe(2);
    expect(stats.myWins).toBe(1);
    expect(stats.winRate).toBe(50);
  });

  it('fa la media del TMV dei mazzi di chi guarda', () => {
    expect(dashboardStats(snapshot, 'a').avgTmv).toBe(7);
    expect(dashboardStats(snapshot, 'b').avgTmv).toBe(4);
  });

  it('conta i mazzi per fascia', () => {
    expect(dashboardStats(snapshot, 'a').perTier).toEqual({ F1: 0, F2: 2, F3: 0, F4: 1, F5: 0 });
  });

  it('senza partite o TMV restituisce null, non zero', () => {
    const empty = { decks: [], games: [], standings: [], updatedAt: '2026-01-01' };
    const stats = dashboardStats(empty, 'a');
    expect(stats.winRate).toBeNull();
    expect(stats.avgTmv).toBeNull();
    expect(stats.decks).toBe(0);
  });
});

describe('recentGames', () => {
  it('ordina dalla più recente e salta quelle non chiuse', () => {
    const list = recentGames(snapshot);
    expect(list.map((g) => g.id)).toEqual(['g2', 'g1']);
    expect(list[0].winners).toEqual(['Beta']);
    expect(list[0].date).toBe('2026-03-01');
  });

  it('rispetta il limite', () => {
    expect(recentGames(snapshot, 1)).toHaveLength(1);
  });
});

describe('sortedDecks', () => {
  it('mette prima la fascia più alta, poi il nome', () => {
    expect(sortedDecks(snapshot).map((d) => d.name)).toEqual(['Beta', 'Alfa', 'Casa']);
  });
});

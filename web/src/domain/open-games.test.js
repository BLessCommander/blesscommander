import { describe, expect, it } from 'vitest';
import { firstPlayerOf, openGamesOf, parseGames, serializeGames } from './open-games.js';

const game = (id, status, over = {}) => ({
  id,
  status,
  recorderLogin: 'a',
  players: [
    { login: 'a', seat: 2 },
    { login: 'b', seat: 1 },
  ],
  ...over,
});

describe('openGamesOf', () => {
  const snapshot = {
    games: [
      game('vecchia', 'in_corso', { startedAt: '2026-01-01T20:00:00Z' }),
      game('nuova', 'in_corso', { startedAt: '2026-01-02T20:00:00Z' }),
      game('chiusa', 'ufficiale'),
      game('altrui', 'in_corso', { recorderLogin: 'x', players: [{ login: 'y', seat: 1 }] }),
      game('lobby', 'lobby', { createdAt: '2026-01-01T10:00:00Z' }),
    ],
  };

  it('dà le partite aperte in cui si è registratore o giocatori, dalla più recente', () => {
    expect(openGamesOf(snapshot, 'a').map((g) => g.id)).toEqual(['nuova', 'vecchia', 'lobby']);
    expect(openGamesOf(snapshot, 'b').map((g) => g.id)).toEqual(['nuova', 'vecchia', 'lobby']);
  });

  it('esclude le chiuse e quelle degli altri', () => {
    const ids = openGamesOf(snapshot, 'y').map((g) => g.id);
    expect(ids).toEqual(['altrui']);
    expect(openGamesOf(snapshot, 'zzz')).toEqual([]);
  });

  it('senza snapshot o login non c’è nulla', () => {
    expect(openGamesOf(null, 'a')).toEqual([]);
    expect(openGamesOf(snapshot, '')).toEqual([]);
  });
});

describe('firstPlayerOf', () => {
  it('è chi siede al posto più basso', () => {
    expect(firstPlayerOf(game('g', 'in_corso')).login).toBe('b');
    expect(firstPlayerOf({ players: [] })).toBeNull();
  });
});

describe('salvataggio sul dispositivo', () => {
  const now = Date.parse('2026-01-02T12:00:00Z');

  it('salva e rilegge le partite', () => {
    const games = [game('g1', 'in_corso'), game('g2', 'ufficiale')];
    expect(parseGames(serializeGames(games, now), now)).toEqual(games);
  });

  it('ignora testo rovinato, voci senza id e voci più vecchie di un giorno', () => {
    expect(parseGames(null, now)).toEqual([]);
    expect(parseGames('{ non è json', now)).toEqual([]);
    expect(parseGames('{"a":1}', now)).toEqual([]);
    expect(parseGames(JSON.stringify([{ savedAt: now, game: {} }]), now)).toEqual([]);
    const old = serializeGames([game('g1', 'in_corso')], now - 25 * 60 * 60 * 1000);
    expect(parseGames(old, now)).toEqual([]);
    const fresh = serializeGames([game('g1', 'in_corso')], now - 23 * 60 * 60 * 1000);
    expect(parseGames(fresh, now)).toHaveLength(1);
  });
});

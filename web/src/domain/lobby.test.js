import { describe, expect, it } from 'vitest';
import { activeGameOf, buildLobbyGame, lobbyFormats, lobbyProblems, seatOrder } from './lobby.js';

const picks = (...logins) => logins.map((login) => ({ login, deckId: `deck-${login}` }));

describe('lobbyFormats', () => {
  it('offre tutti contro tutti a 3, 4, 5–6 e il 1v1', () => {
    expect(lobbyFormats().map((f) => f.id)).toEqual(['ffa4', 'ffa3', 'ffa56', '1v1']);
  });

  it('usa i parametri del gruppo senza perdere i limiti di giocatori', () => {
    const [ffa4] = lobbyFormats({ formats: [{ id: 'ffa4', name: 'Altro', players: 4 }] });
    expect(ffa4.giocatoriMin).toBe(4);
    expect(ffa4.giocatoriMax).toBe(4);
  });
});

describe('lobbyProblems', () => {
  const ffa4 = { giocatoriMin: 4, giocatoriMax: 4 };

  it('non trova problemi con un tavolo da 4 completo', () => {
    expect(lobbyProblems(ffa4, picks('a', 'b', 'c', 'd'), 'a')).toEqual([]);
  });

  it('segnala giocatori mancanti o in più', () => {
    expect(lobbyProblems(ffa4, picks('a', 'b'), 'a')).toContain('players-few');
    expect(lobbyProblems(ffa4, picks('a', 'b', 'c', 'd', 'e'), 'a')).toContain('players-many');
  });

  it('segnala un mazzo non scelto', () => {
    const table = [...picks('a', 'b', 'c'), { login: 'd', deckId: '' }];
    expect(lobbyProblems(ffa4, table, 'a')).toEqual(['no-deck']);
  });

  it('il registratore deve sedere al tavolo', () => {
    expect(lobbyProblems(ffa4, picks('a', 'b', 'c', 'd'), 'z')).toEqual(['no-recorder']);
  });
});

describe('seatOrder', () => {
  it('parte da chi comincia e gira in cerchio', () => {
    expect(seatOrder(picks('a', 'b', 'c', 'd'), 'c').map((p) => p.login)).toEqual([
      'c',
      'd',
      'a',
      'b',
    ]);
  });

  it('con un primo giocatore sconosciuto lascia l’ordine com’è', () => {
    expect(seatOrder(picks('a', 'b'), 'x').map((p) => p.login)).toEqual(['a', 'b']);
  });
});

describe('buildLobbyGame', () => {
  const decksById = {
    'deck-a': { tier: { current: 'F4' } },
    'deck-b': { declaredTier: 'F2' },
    'deck-c': {},
  };
  const game = buildLobbyGame({
    format: { id: 'ffa3' },
    picks: picks('a', 'b', 'c'),
    firstLogin: 'b',
    recorderLogin: 'a',
    decksById,
    startedAt: '2026-10-04T20:00:00.000Z',
  });

  it('crea una partita in corso con orario e registratore', () => {
    expect(game).toMatchObject({
      formatId: 'ffa3',
      status: 'in_corso',
      recorderLogin: 'a',
      startedAt: '2026-10-04T20:00:00.000Z',
    });
  });

  it('dà il posto 1 a chi comincia e fissa la fascia dei mazzi', () => {
    expect(game.players).toEqual([
      { login: 'b', deckId: 'deck-b', seat: 1, tierAtGame: 'F2' },
      { login: 'c', deckId: 'deck-c', seat: 2 },
      { login: 'a', deckId: 'deck-a', seat: 3, tierAtGame: 'F4' },
    ]);
  });
});

describe('activeGameOf', () => {
  const games = [
    { id: '1', status: 'ufficiale', recorderLogin: 'a', players: [{ login: 'a' }] },
    { id: '2', status: 'in_corso', recorderLogin: 'b', players: [{ login: 'b' }, { login: 'c' }] },
  ];

  it('trova la partita aperta di un giocatore', () => {
    expect(activeGameOf({ games }, 'c')?.id).toBe('2');
  });

  it('ignora le partite chiuse e chi non gioca', () => {
    expect(activeGameOf({ games }, 'a')).toBeNull();
    expect(activeGameOf(null, 'a')).toBeNull();
  });
});

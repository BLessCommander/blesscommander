import { describe, expect, it } from 'vitest';
import { it as itTexts } from '../i18n/it.js';
import { DECK_BUILDING, TABLE_MODES, TABLE_OPTIONS } from './lobby-catalog.js';
import { activeGameOf, buildLobbyGame, lobbyFormats, lobbyProblems, seatOrder } from './lobby.js';

const picks = (...logins) => logins.map((login) => ({ login, deckId: `deck-${login}` }));

describe('lobbyFormats', () => {
  it('per ora si possono scegliere solo tutti contro tutti a 4 e a 3', () => {
    expect(lobbyFormats().map((f) => f.id)).toEqual(['ffa4', 'ffa3']);
  });

  it('il catalogo ha tutte le voci e solo Commander classico a 3 e 4 è acceso', () => {
    const enabled = (list) => list.filter((e) => e.enabled).map((e) => e.id);
    expect(TABLE_MODES).toHaveLength(11);
    expect(DECK_BUILDING).toHaveLength(16);
    expect(TABLE_OPTIONS).toHaveLength(7);
    expect(enabled(TABLE_MODES)).toEqual(['ffa4', 'ffa3']);
    expect(enabled(DECK_BUILDING)).toEqual(['commander']);
    expect(enabled(TABLE_OPTIONS)).toEqual([]);
  });

  it('ogni voce del catalogo ha nome e nota nei testi', () => {
    for (const [list, key] of [
      [TABLE_MODES.filter((m) => !m.enabled), 'tableModes'],
      [DECK_BUILDING, 'deckBuilding'],
      [TABLE_OPTIONS, 'options'],
    ]) {
      for (const { id } of list) expect(itTexts.lobby.catalog[key][id]?.name, id).toBeTruthy();
    }
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

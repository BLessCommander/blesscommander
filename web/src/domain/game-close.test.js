import { describe, expect, it } from 'vitest';
import {
  MAX_TURN,
  buildClosePatch,
  closeProblems,
  estimateTurn,
  isValidTurn,
  winTypeIds,
} from './game-close.js';

const game = {
  id: 'g1',
  players: [
    { login: 'a', deckId: 'da', seat: 1, tierAtGame: 'F2', eliminatedTurn: 3, eliminatedBy: 'b' },
    { login: 'b', deckId: 'db', seat: 2, tierAtGame: 'F2' },
    { login: 'c', deckId: 'dc', seat: 3, tierAtGame: 'F2' },
  ],
};
const types = winTypeIds();
const input = { winnerLogin: 'b', turn: 7, turnSource: 'dado', winType: 'combo' };

describe('winTypeIds', () => {
  it('sono le chiavi dei modificatori del motore, anche quelle aggiunte dal gruppo', () => {
    expect(types).toEqual(expect.arrayContaining(['creature', 'combo', 'superstite']));
    expect(winTypeIds({ settings: { modificatoriVittoria: { nuovo: 0 } } })).toContain('nuovo');
  });
});

describe('estimateTurn', () => {
  const start = '2026-01-01T20:00:00.000Z';
  const at = (min) => new Date(Date.parse(start) + min * 60000).toISOString();

  it('divide i minuti per i minuti di un giro (12 di default) e arrotonda', () => {
    expect(estimateTurn(start, at(84))).toBe(7);
    expect(estimateTurn(start, at(89))).toBe(7);
    expect(estimateTurn(start, at(91))).toBe(8);
  });

  it('non scende sotto 1 e non supera il massimo', () => {
    expect(estimateTurn(start, at(1))).toBe(1);
    expect(estimateTurn(start, at(60 * 100))).toBe(MAX_TURN);
  });

  it('usa i minuti per giro del gruppo', () => {
    expect(estimateTurn(start, at(60), { settings: { minutiPerGiroDefault: 6 } })).toBe(10);
  });

  it('senza orari validi (o fine prima dell’inizio) non stima', () => {
    expect(estimateTurn(undefined, at(10))).toBeNull();
    expect(estimateTurn(start, 'non è una data')).toBeNull();
    expect(estimateTurn(at(10), start)).toBeNull();
  });
});

describe('isValidTurn', () => {
  it('accetta solo interi da 1 a 99', () => {
    expect([1, 7, 99].every(isValidTurn)).toBe(true);
    expect([0, 100, 2.5, null, NaN, '7'].some(isValidTurn)).toBe(false);
  });
});

describe('closeProblems', () => {
  it('nessun problema con i tre dati', () => {
    expect(closeProblems(game, input, types)).toEqual([]);
  });

  it('elenca ciò che manca', () => {
    expect(closeProblems(game, { ...input, winnerLogin: '' }, types)).toEqual(['no-winner']);
    expect(closeProblems(game, { ...input, winnerLogin: 'zzz' }, types)).toEqual(['no-winner']);
    expect(closeProblems(game, { ...input, turn: null }, types)).toEqual(['no-turn']);
    expect(closeProblems(game, { ...input, turn: 0 }, types)).toEqual(['no-turn']);
    expect(closeProblems(game, { ...input, winType: '' }, types)).toEqual(['no-win-type']);
    expect(closeProblems(game, { ...input, winType: 'magia' }, types)).toEqual(['no-win-type']);
    expect(closeProblems(game, { winnerLogin: '', turn: null, winType: '' }, types)).toEqual([
      'no-winner',
      'no-turn',
      'no-win-type',
    ]);
  });

  it('il turno di un’eliminazione, se indicato, deve essere valido', () => {
    const bad = { ...input, eliminations: [{ login: 'c', by: 'b', turn: 0 }] };
    expect(closeProblems(game, bad, types)).toEqual(['elimination-turn']);
    const empty = { ...input, eliminations: [{ login: 'c', by: 'b', turn: null }] };
    expect(closeProblems(game, empty, types)).toEqual([]);
  });
});

describe('buildClosePatch', () => {
  const ended = '2026-01-01T22:00:00.000Z';

  it('chiude la partita con vincitore, turno, origine e tipo', () => {
    const patch = buildClosePatch(game, input, ended);
    expect(patch).toMatchObject({
      status: 'ufficiale',
      endedAt: ended,
      winners: [{ login: 'b', deckId: 'db' }],
      winTurn: 7,
      turnSource: 'dado',
      winType: 'combo',
    });
    expect(patch).not.toHaveProperty('estimatedTurn');
    expect(patch).not.toHaveProperty('notRepresentative');
    expect(patch).not.toHaveProperty('notes');
  });

  it('con la stima salva anche estimatedTurn', () => {
    const patch = buildClosePatch(game, { ...input, turnSource: 'stima' }, ended);
    expect(patch).toMatchObject({ turnSource: 'stima', winTurn: 7, estimatedTurn: 7 });
  });

  it('porta le eliminazioni sui giocatori e toglie quelle vecchie', () => {
    const patch = buildClosePatch(
      game,
      { ...input, eliminations: [{ login: 'c', by: 'a', turn: 5 }] },
      ended,
    );
    const by = Object.fromEntries(patch.players.map((p) => [p.login, p]));
    expect(by.c).toMatchObject({ eliminatedTurn: 5, eliminatedBy: 'a' });
    expect(by.a).not.toHaveProperty('eliminatedTurn');
    expect(by.a).not.toHaveProperty('eliminatedBy');
    expect(by.a.deckId).toBe('da');
  });

  it('ignora l’eliminazione del vincitore e quelle senza turno', () => {
    const patch = buildClosePatch(
      game,
      {
        ...input,
        eliminations: [
          { login: 'b', by: 'a', turn: 4 },
          { login: 'c', by: 'a', turn: null },
        ],
      },
      ended,
    );
    expect(patch.players.some((p) => p.eliminatedTurn != null)).toBe(false);
  });

  it('un’eliminazione senza «da chi» salva solo il turno', () => {
    const patch = buildClosePatch(
      game,
      { ...input, eliminations: [{ login: 'c', by: '', turn: 5 }] },
      ended,
    );
    const c = patch.players.find((p) => p.login === 'c');
    expect(c.eliminatedTurn).toBe(5);
    expect(c).not.toHaveProperty('eliminatedBy');
  });

  it('salva «non rappresentativa» e le note (senza spazi ai lati)', () => {
    const patch = buildClosePatch(
      game,
      { ...input, notRepresentative: true, notes: '  ok  ' },
      ended,
    );
    expect(patch).toMatchObject({ notRepresentative: true, notes: 'ok' });
  });

  it('non modifica la partita di partenza', () => {
    const copy = structuredClone(game);
    buildClosePatch(game, { ...input, eliminations: [{ login: 'c', by: 'a', turn: 5 }] }, ended);
    expect(game).toEqual(copy);
  });
});

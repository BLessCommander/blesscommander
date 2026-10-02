import { describe, expect, it } from 'vitest';
import { assertValid, validate } from './validate.js';
import { SCHEMAS } from './schemas.js';
import { createDemoState } from './seed-demo.js';

describe('UT-DATA validazione degli schemi', () => {
  const state = createDemoState();
  const deck = Object.values(state.decks)[0];
  const game = Object.values(state.games)[0];

  it('accetta i dati demo', () => {
    expect(validate('config/group', state.config).valid).toBe(true);
    expect(validate('config/members', state.members).valid).toBe(true);
    expect(validate('deck', deck).valid).toBe(true);
    expect(validate('deck-version', state.versions[deck.id][0]).valid).toBe(true);
    expect(validate('game', game).valid).toBe(true);
  });

  it('rifiuta campi mancanti, fasce e ruoli sbagliati, identificativi non ULID', () => {
    expect(validate('deck', { ...deck, name: undefined }).valid).toBe(false);
    expect(validate('deck', { ...deck, declaredTier: 'F6' }).valid).toBe(false);
    expect(validate('deck', { ...deck, id: 'abc' }).valid).toBe(false);
    expect(validate('game', { ...game, status: 'finita' }).valid).toBe(false);
    expect(validate('game', { ...game, players: [] }).valid).toBe(false);
    expect(validate('config/members', { x: { displayName: 'X', role: 'capo' } }).valid).toBe(false);
  });

  it('segnala gli errori in chiaro e lancia DataError con assertValid', () => {
    const { errors } = validate('deck', { ...deck, declaredTier: 'F6' });
    expect(errors[0]).toContain('declaredTier');
    expect(() => assertValid('deck', {})).toThrowError(/Dati non validi/);
  });

  it('ha uno schema per ogni tipo di file del modello dati', () => {
    expect(Object.keys(SCHEMAS)).toEqual(
      expect.arrayContaining([
        'config/group',
        'deck',
        'game',
        'vote',
        'request',
        'derived/snapshot',
      ]),
    );
    expect(() => validate('inesistente', {})).toThrow();
  });
});

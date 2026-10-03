import { describe, expect, it } from 'vitest';
import { fakeScryfallFetch } from '../../../tests/fixtures/scryfall-fake.js';
import { createScryfall } from '../platform/scryfall.js';
import { buildPreparedDeck, prepareDeck } from './import-decks.js';
import { ImportRequestError, requestAndWait } from './import-request.js';

const scryfall = createScryfall({ fetchImpl: fakeScryfallFetch, pauseMs: 0 });
const decks = [
  { name: 'Buono', url: 'https://archidekt.com/decks/1' },
  { name: 'Senza comandante', url: 'https://archidekt.com/decks/2' },
  { name: 'Carta strana', url: 'https://archidekt.com/decks/3' },
  { name: 'Non risponde', url: 'https://archidekt.com/decks/4' },
];
const lists = {
  'https://archidekt.com/decks/1': 'Commander\n1 Tymna the Weaver\n\nDeck\n1 Sol Ring',
  'https://archidekt.com/decks/2': 'Deck\n1 Sol Ring\n1 Rhystic Study',
  'https://archidekt.com/decks/3': 'Commander\n1 Tymna the Weaver\n\nDeck\n1 Carta inesistente',
};

const comboAnswer = { combos: [] };
const prepare = (entry, over = {}) =>
  prepareDeck({
    entry,
    requestDeck: async (url) => {
      if (!(url in lists)) throw new Error('Mazzo privato');
      return { deckName: 'Nome Archidekt', result: lists[url] };
    },
    lookup: (names) => scryfall.lookup(names),
    requestCombos: async () => comboAnswer,
    ...over,
  });

describe('prepareDeck', () => {
  it('prepara i mazzi completi e dice perché gli altri no', async () => {
    const results = [];
    for (const entry of decks) results.push(await prepare(entry));
    expect(results.map((r) => r.status)).toEqual(['ready', 'review', 'review', 'failed']);
    expect(results[1]).toMatchObject({ name: 'Senza comandante', reason: 'no-commander' });
    expect(results[2]).toMatchObject({ name: 'Carta strana', reason: 'not-found' });
    expect(results[3]).toMatchObject({ name: 'Non risponde', reason: 'Mazzo privato' });
    expect(results[0]).toMatchObject({ name: 'Nome Archidekt', combos: [] });
  });

  it('porta al wizard game changer, carte sospette e combo', async () => {
    const url = 'https://archidekt.com/decks/9';
    const ready = await prepare(
      { name: 'Ricco', url },
      {
        requestDeck: async () => ({
          result:
            "Commander\n1 Tymna the Weaver\n\nDeck\n1 Rhystic Study\n1 Armageddon\n1 Thassa's Oracle\n1 Demonic Consultation",
        }),
        requestCombos: async () => ({
          combos: [
            {
              id: '742-1295',
              cards: ["Thassa's Oracle", 'Demonic Consultation'],
              produces: ['Win the game'],
              infinite: true,
            },
          ],
        }),
      },
    );
    expect(ready.gameChangers).toEqual(['Rhystic Study']);
    expect(ready.suspects).toEqual({ massLand: ['Armageddon'], extraTurns: [] });
    expect(ready.combos).toHaveLength(1);
    expect(ready.combos[0].manaValue).toBe(3);
  });

  it('se la ricerca delle combo fallisce il mazzo va avanti con combo null (scelta a mano)', async () => {
    const ready = await prepare(decks[0], {
      requestCombos: async () => {
        throw new Error('Commander Spellbook non risponde');
      },
    });
    expect(ready.status).toBe('ready');
    expect(ready.combos).toBeNull();
  });
});

describe('buildPreparedDeck', () => {
  it('salva nome di Archidekt, fascia dichiarata e esito del wizard', async () => {
    const ready = await prepare(decks[0]);
    const assessment = {
      floor: 'F1',
      massLandDestruction: false,
      chainExtraTurns: false,
      combos: [],
    };
    const { deck, version } = buildPreparedDeck(
      ready,
      { declaredTier: 'F2', assessment },
      '2026-10-03T10:00:00Z',
    );
    expect(deck).toMatchObject({
      name: 'Nome Archidekt',
      commanders: ['Tymna the Weaver'],
      declaredTier: 'F2',
      selfAssessment: { mld: false, extraTurns: false },
      source: { type: 'archidekt', url: 'https://archidekt.com/decks/1' },
    });
    expect(version).toMatchObject({ floor: 'F1', combos: [] });
  });
});

describe('requestAndWait', () => {
  const base = { source: 'archidekt', url: 'x', wait: async () => {}, pollMs: 1, limit: 3 };

  it('aspetta fino a "done"', async () => {
    const states = [{ status: 'pending' }, { status: 'done', result: 'ok' }];
    const state = await requestAndWait({
      ...base,
      create: async () => ({ id: 'r1' }),
      get: async () => states.shift(),
    });
    expect(state.result).toBe('ok');
  });

  it('errore dell’Action: kind failed senza il punto finale', async () => {
    const error = await requestAndWait({
      ...base,
      create: async () => ({ id: 'r1' }),
      get: async () => ({ status: 'error', error: 'Mazzo privato.' }),
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ImportRequestError);
    expect(error).toMatchObject({ kind: 'failed', message: 'Mazzo privato' });
  });

  it('troppo lenta: timeout; pagina chiusa: stopped', async () => {
    const pending = {
      create: async () => ({ id: 'r1' }),
      get: async () => ({ status: 'pending' }),
    };
    await expect(requestAndWait({ ...base, ...pending })).rejects.toMatchObject({
      kind: 'timeout',
    });
    await expect(
      requestAndWait({ ...base, ...pending, isStopped: () => true }),
    ).rejects.toMatchObject({ kind: 'stopped' });
  });
});

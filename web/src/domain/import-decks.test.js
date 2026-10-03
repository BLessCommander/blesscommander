import { describe, expect, it } from 'vitest';
import { fakeScryfallFetch } from '../../../tests/fixtures/scryfall-fake.js';
import { createScryfall } from '../platform/scryfall.js';
import { importDecks } from './import-decks.js';
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

describe('importDecks', () => {
  it('salva solo i mazzi completi e dice perché gli altri no', async () => {
    const saved = [];
    const progress = [];
    const outcomes = await importDecks({
      decks,
      declaredTier: 'F2',
      requestDeck: async (url) => {
        if (!(url in lists)) throw new Error('Mazzo privato');
        return { deckName: 'Nome Archidekt', result: lists[url] };
      },
      lookup: (names) => scryfall.lookup(names),
      save: async (deck, version) => saved.push({ deck, version }),
      now: () => '2026-10-03T10:00:00Z',
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(outcomes).toEqual([
      { name: 'Buono', status: 'imported' },
      { name: 'Senza comandante', status: 'review', reason: 'no-commander' },
      { name: 'Carta strana', status: 'review', reason: 'not-found' },
      { name: 'Non risponde', status: 'failed', reason: 'Mazzo privato' },
    ]);
    expect(saved).toHaveLength(1);
    expect(saved[0].deck).toMatchObject({
      name: 'Nome Archidekt',
      commanders: ['Tymna the Weaver'],
      declaredTier: 'F2',
      source: { type: 'archidekt', url: 'https://archidekt.com/decks/1' },
    });
    expect(progress.at(-1)).toEqual([4, 4]);
  });

  it('un errore nel salvataggio non ferma gli altri mazzi', async () => {
    let calls = 0;
    const outcomes = await importDecks({
      decks: decks.slice(0, 1).concat(decks.slice(0, 1)),
      declaredTier: 'F3',
      requestDeck: async (url) => ({ result: lists[url] }),
      lookup: (names) => scryfall.lookup(names),
      save: async () => {
        if (++calls === 1) throw new Error('Scrittura non riuscita');
      },
      now: () => '2026-10-03T10:00:00Z',
    });
    expect(outcomes.map((o) => o.status)).toEqual(['failed', 'imported']);
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

describe('importDecks: nome e fascia per mazzo', () => {
  it('il nome è quello di Archidekt e ogni mazzo ha la sua fascia', async () => {
    const saved = [];
    await importDecks({
      decks: [
        { name: 'Nome dall’elenco', url: 'https://archidekt.com/decks/1', tier: 'F4' },
        { name: 'Altro', url: 'https://archidekt.com/decks/1' },
      ],
      declaredTier: 'F2',
      requestDeck: async (url) => ({ deckName: 'Jodah', result: lists[url] }),
      lookup: (names) => scryfall.lookup(names),
      save: async (deck) => saved.push(deck),
      now: () => '2026-10-03T10:00:00Z',
    });
    expect(saved.map((d) => [d.name, d.declaredTier])).toEqual([
      ['Jodah', 'F4'],
      ['Jodah', 'F2'],
    ]);
  });
});

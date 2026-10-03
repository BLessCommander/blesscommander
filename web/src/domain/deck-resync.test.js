import { describe, expect, it } from 'vitest';
import { fakeScryfallFetch } from '../../../tests/fixtures/scryfall-fake.js';
import { createScryfall } from '../platform/scryfall.js';
import { deckCards, parseDeckText } from './deck-parser.js';
import { diffCards, planResync } from './deck-resync.js';

const scryfall = createScryfall({ fetchImpl: fakeScryfallFetch, pauseMs: 0 });
const lookupOf = (text) => scryfall.lookup(deckCards(parseDeckText(text)).map((l) => l.name));

const saved = {
  id: '01HZ0000000000000000000001',
  name: 'Jodah',
  commanders: ['Tymna the Weaver'],
  colorIdentity: ['W', 'B'],
  declaredTier: 'F3',
  currentVersion: 1,
  source: { type: 'archidekt', url: 'https://archidekt.com/decks/1', importedAt: '2026-10-01' },
};
const current = {
  version: 1,
  cards: [
    { name: 'Tymna the Weaver', qty: 1 },
    { name: 'Sol Ring', qty: 1 },
    { name: 'Island', qty: 5 },
  ],
};
const base = 'Commander\n1 Tymna the Weaver\n\nDeck\n1 Sol Ring\n5 Island';
const plan = async (result, deckName = 'Jodah') =>
  planResync({
    deck: saved,
    current,
    fetched: { deckName, result },
    lookup: await lookupOf(result),
    now: '2026-10-03T10:00:00Z',
  });

describe('diffCards', () => {
  it('trova carte entrate, uscite e con quantità diversa', () => {
    expect(
      diffCards(
        [
          { name: 'A', qty: 1 },
          { name: 'B', qty: 1 },
          { name: 'C', qty: 2 },
        ],
        [
          { name: 'B', qty: 1 },
          { name: 'C', qty: 3 },
          { name: 'D', qty: 1 },
        ],
      ),
    ).toEqual({ added: ['D'], removed: ['A'], changed: ['C'] });
  });
});

describe('planResync', () => {
  it('nessuna differenza: non si salva nulla', async () => {
    expect(await plan(base)).toEqual({ status: 'same' });
  });

  it('carte cambiate: nuova versione con il diff, mazzo aggiornato', async () => {
    const result = await plan('Commander\n1 Tymna the Weaver\n\nDeck\n1 Rhystic Study\n6 Island');
    expect(result.status).toBe('update');
    expect(result.version.diff).toEqual({ added: ['Rhystic Study'], removed: ['Sol Ring'] });
    expect(result.version.gameChangers).toEqual(['Rhystic Study']);
    expect(result.summary).toEqual({ added: 1, removed: 1, changed: 1, renamed: false });
    expect(result.deck).toMatchObject({ id: saved.id, currentVersion: 1, declaredTier: 'F3' });
  });

  it('cambia solo il nome: si aggiorna il mazzo ma non si crea una versione', async () => {
    const result = await plan(base, 'Jodah v2');
    expect(result.status).toBe('update');
    expect(result.version).toBeNull();
    expect(result.deck.name).toBe('Jodah v2');
    expect(result.summary.renamed).toBe(true);
  });

  it('cambia il comandante: si aggiorna anche il mazzo', async () => {
    const result = await plan('Commander\n1 Thrasios, Triton Hero\n\nDeck\n1 Sol Ring\n5 Island');
    expect(result.status).toBe('update');
    expect(result.deck.commanders).toEqual(['Thrasios, Triton Hero']);
    expect(result.deck.colorIdentity).toEqual(['U', 'G']);
  });

  it('lista incompleta: da controllare, il mazzo salvato non cambia', async () => {
    expect(await plan('Deck\n1 Sol Ring')).toMatchObject({
      status: 'review',
      reasons: ['no-commander'],
    });
    expect(await plan('Commander\n1 Tymna the Weaver\n\nDeck\n1 Carta inesistente')).toMatchObject({
      status: 'review',
      reasons: ['not-found'],
    });
  });
});

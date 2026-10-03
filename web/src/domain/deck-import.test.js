import { describe, expect, it } from 'vitest';
import { fakeScryfallFetch } from '../../../tests/fixtures/scryfall-fake.js';
import { createScryfall, chunk, matchCards } from '../platform/scryfall.js';
import { buildDeckFromImport, checkImport } from './deck-import.js';
import { parseDeckText } from './deck-parser.js';

const createDemoScryfall = () => createScryfall({ fetchImpl: fakeScryfallFetch, pauseMs: 0 });

const TEXT =
  'Commander\n1 Tymna the Weaver\n1 Thrasios, Triton Hero\n\nDeck\n1 Sol Ring\n1 Rhystic Study';

describe('buildDeckFromImport', () => {
  it('unisce i colori dei comandanti e segna i game changer', async () => {
    const lines = parseDeckText(TEXT);
    const lookup = await createDemoScryfall().lookup(lines.map((l) => l.name));
    const { deck, version } = buildDeckFromImport({
      name: ' Partner ',
      lines,
      lookup,
      declaredTier: 'F3',
      importedAt: '2026-01-01T00:00:00Z',
    });
    expect(deck.name).toBe('Partner');
    expect(deck.commanders).toEqual(['Tymna the Weaver', 'Thrasios, Triton Hero']);
    expect(deck.colorIdentity).toEqual(['W', 'U', 'B', 'G']);
    expect(version.gameChangers).toEqual(['Rhystic Study']);
    expect(version.cards).toHaveLength(4);
  });
});

describe('checkImport', () => {
  it('chiede un comandante e blocca le carte non trovate', async () => {
    expect(checkImport(parseDeckText('1 Sol Ring'), null).reasons).toEqual(['no-commander']);
    expect(checkImport([], null).reasons).toEqual(['empty']);
    const lines = parseDeckText('Commander\n1 Tymna the Weaver\n1 Carta inesistente');
    const lookup = await createDemoScryfall().lookup(lines.map((l) => l.name));
    expect(lookup.notFound).toEqual(['Carta inesistente']);
    expect(checkImport(lines, lookup).reasons).toEqual(['not-found']);
  });

  it('una carta non trovata nel sideboard non blocca', async () => {
    const lines = parseDeckText('Commander\n1 Tymna the Weaver\nSideboard\n1 Carta inesistente');
    const lookup = await createDemoScryfall().lookup(lines.map((l) => l.name));
    expect(checkImport(lines, lookup).ok).toBe(true);
  });
});

describe('Scryfall', () => {
  it('divide in blocchi da 75', () => {
    expect(chunk(Array.from({ length: 160 }, (_, i) => i)).map((b) => b.length)).toEqual([
      75, 75, 10,
    ]);
  });

  it('abbina anche col nome della prima faccia', () => {
    const raw = {
      id: 'x',
      name: 'Delver of Secrets // Insectile Aberration',
      color_identity: ['U'],
    };
    const { cards, notFound } = matchCards(['Delver of Secrets', 'Boh'], [raw]);
    expect(cards['delver of secrets'].scryfallId).toBe('x');
    expect(notFound).toEqual(['Boh']);
  });

  it('chiama /cards/collection a blocchi e legge game_changer', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      const { identifiers } = JSON.parse(init.body);
      calls.push({ url, size: identifiers.length });
      return {
        ok: true,
        json: async () => ({
          data: identifiers.map((i) => ({
            id: i.name,
            name: i.name,
            game_changer: i.name === 'Carta 0',
          })),
        }),
      };
    };
    const names = Array.from({ length: 100 }, (_, i) => `Carta ${i}`);
    const { cards } = await createScryfall({ fetchImpl, pauseMs: 0 }).lookup(names);
    expect(calls.map((c) => c.size)).toEqual([75, 25]);
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/collection');
    expect(cards['carta 0'].isGameChanger).toBe(true);
    expect(Object.keys(cards)).toHaveLength(100);
  });

  it("segnala l'errore se Scryfall non risponde bene", async () => {
    const fetchImpl = async () => ({ ok: false, status: 429 });
    await expect(createScryfall({ fetchImpl, pauseMs: 0 }).lookup(['A'])).rejects.toThrow('429');
  });
});

describe('carte speciali', () => {
  const lookupOf = (names) => createDemoScryfall().lookup(names);

  it('trova le carte a più facce scritte col nome completo "A // B"', async () => {
    const names = [
      'Esika, God of the Tree // The Prismatic Bridge',
      'Fire // Ice',
      'Delver of Secrets // Insectile Aberration',
    ];
    const { cards, notFound } = await lookupOf(names);
    expect(notFound).toEqual([]);
    expect(cards['fire // ice'].name).toBe('Fire // Ice');
  });

  it('trova le stesse carte con un solo nome, con "/" o con "///"', async () => {
    const { notFound } = await lookupOf([
      'Fire',
      'Fire / Ice',
      'Delver of Secrets /// Insectile Aberration',
    ]);
    expect(notFound).toEqual([]);
  });

  it('trova una carta scritta senza accenti o con apostrofo tipografico', async () => {
    const { cards, notFound } = await lookupOf([
      'Lim-Dul the Necromancer',
      'Atraxa, Praetors’ Voice',
    ]);
    expect(notFound).toEqual([]);
    expect(cards['lim-dul the necromancer'].name).toBe('Lim-Dûl the Necromancer');
    expect(cards['atraxa, praetors’ voice'].colorIdentity).toEqual(['W', 'U', 'B', 'G']);
  });

  it('una carta Alchemy "A-Nome" si cerca come la carta originale', async () => {
    const requests = [];
    const fetchImpl = async (url, init) => {
      const { identifiers } = JSON.parse(init.body);
      requests.push(identifiers.map((i) => i.name));
      const data = identifiers
        .filter((i) => i.name === 'Lightning Bolt')
        .map((i) => ({ id: 'bolt', name: i.name }));
      return { ok: true, json: async () => ({ data }) };
    };
    const { cards, notFound } = await createScryfall({ fetchImpl, pauseMs: 0 }).lookup([
      'A-Lightning Bolt',
    ]);
    expect(requests).toEqual([['A-Lightning Bolt'], ['Lightning Bolt']]);
    expect(notFound).toEqual([]);
    expect(cards['a-lightning bolt'].name).toBe('Lightning Bolt');
  });

  it('chiede a Scryfall solo il nome della prima faccia', async () => {
    const asked = [];
    const fetchImpl = async (url, init) => {
      asked.push(...JSON.parse(init.body).identifiers.map((i) => i.name));
      return { ok: true, json: async () => ({ data: [] }) };
    };
    await createScryfall({ fetchImpl, pauseMs: 0 }).lookup(['Fire // Ice']);
    expect(asked).toEqual(['Fire']);
  });

  it('il comandante a due facce viene salvato col nome completo', async () => {
    const lines = parseDeckText(
      'Commander\n1 Esika, God of the Tree // The Prismatic Bridge\n\nDeck\n1 Sol Ring',
    );
    const lookup = await lookupOf(lines.map((l) => l.name));
    const { deck } = buildDeckFromImport({
      name: 'Esika',
      lines,
      lookup,
      declaredTier: 'F3',
      importedAt: '2026-01-01T00:00:00Z',
    });
    expect(deck.commanders).toEqual(['Esika, God of the Tree // The Prismatic Bridge']);
    expect(deck.colorIdentity).toEqual(['W', 'U', 'B', 'R', 'G']);
  });
});

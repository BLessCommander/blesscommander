import { describe, expect, it } from 'vitest';
import { colorGroup, detailCards, groupCards, primaryType, UNKNOWN } from './deck-cards.js';

const info = {
  a: { cmc: 1, typeLine: 'Artifact', colors: [], manaCost: '{1}' },
  b: { cmc: 2, typeLine: 'Instant', colors: ['U'], manaCost: '{1}{U}' },
  c: {
    cmc: 4,
    typeLine: 'Legendary Creature — Angel',
    colors: ['W', 'U', 'B', 'G'],
    manaCost: '{W}{U}{B}{G}',
  },
  d: { cmc: 0, typeLine: 'Basic Land — Island', colors: [], manaCost: '' },
  e: { cmc: 9, typeLine: 'Artifact Creature — Construct', colors: [], manaCost: '{9}' },
  f: { cmc: 3, typeLine: 'Land Creature — Forest Dryad', colors: ['G'], manaCost: '{G}' },
};
const cards = [
  { name: 'Sol Ring', qty: 1, scryfallId: 'a' },
  { name: 'Counterspell', qty: 1, scryfallId: 'b' },
  { name: 'Atraxa', qty: 1, scryfallId: 'c' },
  { name: 'Island', qty: 10, scryfallId: 'd' },
  { name: 'Colosso', qty: 1, scryfallId: 'e' },
  { name: 'Dryad Arbor', qty: 1, scryfallId: 'f' },
  { name: 'Carta strana', qty: 2 },
];
const detailed = detailCards(cards, info);
const keys = (groups) => groups.map((g) => g.key);
const names = (groups) => groups.flatMap((g) => g.cards.map((c) => c.name));

describe('primaryType', () => {
  it('sceglie il tipo principale con la precedenza giusta', () => {
    expect(primaryType('Legendary Creature — Human')).toBe('Creature');
    expect(primaryType('Artifact Creature — Construct')).toBe('Creature');
    expect(primaryType('Land Creature — Forest Dryad')).toBe('Land');
    expect(primaryType('Tribal Instant — Elf')).toBe('Instant');
    expect(primaryType('Kindred Sorcery — Goblin')).toBe('Sorcery');
    expect(primaryType('Conspiracy')).toBe('Other');
  });

  it('per le carte a più facce conta la prima', () => {
    expect(primaryType('Creature — Human // Land')).toBe('Creature');
  });
});

describe('colorGroup', () => {
  it('distingue incolore, mono e multicolore', () => {
    expect(colorGroup([])).toBe('C');
    expect(colorGroup(['R'])).toBe('R');
    expect(colorGroup(['W', 'U'])).toBe('M');
  });
});

describe('detailCards', () => {
  it('unisce i dati di Scryfall; senza dati la carta è sconosciuta', () => {
    expect(detailed[1]).toMatchObject({ known: true, type: 'Instant', cmc: 2, colors: ['U'] });
    expect(detailed[6]).toMatchObject({ known: false, type: UNKNOWN, cmc: 0, colors: [] });
  });
});

describe('groupCards', () => {
  it('raggruppa per tipo nell’ordine fisso, con le sconosciute in fondo', () => {
    const groups = groupCards(detailed, { groupBy: 'type' });
    expect(keys(groups)).toEqual(['Creature', 'Instant', 'Artifact', 'Land', UNKNOWN]);
    expect(names([groups.find((g) => g.key === 'Land')])).toEqual(['Dryad Arbor', 'Island']);
  });

  it('il totale del gruppo somma le quantità', () => {
    const groups = groupCards(detailed, { groupBy: 'type' });
    expect(groups.find((g) => g.key === 'Land').count).toBe(11);
    expect(groups.find((g) => g.key === UNKNOWN).count).toBe(2);
  });

  it('raggruppa per costo di mana, con 7 o più insieme', () => {
    expect(keys(groupCards(detailed, { groupBy: 'cmc' }))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '7',
      UNKNOWN,
    ]);
  });

  it('raggruppa per colore', () => {
    expect(keys(groupCards(detailed, { groupBy: 'color' }))).toEqual(['U', 'G', 'M', 'C', UNKNOWN]);
  });

  it('ordina per nome o per costo, anche al contrario', () => {
    const colorless = (options) =>
      names([groupCards(detailed, { groupBy: 'color', ...options }).find((g) => g.key === 'C')]);
    expect(colorless({ sortBy: 'name' })).toEqual(['Colosso', 'Island', 'Sol Ring']);
    expect(colorless({ sortBy: 'cmc' })).toEqual(['Island', 'Sol Ring', 'Colosso']);
    expect(colorless({ sortBy: 'cmc', desc: true })).toEqual(['Colosso', 'Sol Ring', 'Island']);
  });

  it('filtra per nome senza badare a maiuscole e accenti', () => {
    expect(names(groupCards(detailed, { query: 'ATRAXA' }))).toEqual(['Atraxa']);
    const accent = detailCards([{ name: 'Lim-Dûl', qty: 1 }], {});
    expect(groupCards(accent, { query: 'lim-dul' })).toHaveLength(1);
    expect(groupCards(detailed, { query: 'zzz' })).toEqual([]);
  });

  it('senza carte non dà gruppi', () => {
    expect(groupCards([], {})).toEqual([]);
  });
});

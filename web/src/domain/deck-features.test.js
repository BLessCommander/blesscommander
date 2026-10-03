import { describe, expect, it } from 'vitest';
import { fakeScryfallFetch } from '../../../tests/fixtures/scryfall-fake.js';
import { fakeSpellbookFetch } from '../../../tests/fixtures/spellbook-fake.js';
import { createScryfall } from '../platform/scryfall.js';
import { createSpellbook } from '../platform/spellbook.js';
import {
  deckFloor,
  detectSuspects,
  manualCombo,
  tierChoices,
  infiniteCombos,
} from './deck-features.js';

const scryfall = createScryfall({ fetchImpl: fakeScryfallFetch, pauseMs: 0 });
const spellbook = createSpellbook({ fetchImpl: fakeSpellbookFetch });
const cardsOf = (...names) => names.map((name) => ({ name, qty: 1 }));
const none = { massLandDestruction: false, chainExtraTurns: false, combos: [] };

describe('deckFloor (SPEC §3.2)', () => {
  it('senza caratteristiche il pavimento è F1', () => {
    expect(deckFloor({ gameChangers: 0, ...none })).toBe('F1');
  });

  it('da 1 a 5 game changer è F3, da 6 è F4', () => {
    expect(deckFloor({ gameChangers: 1, ...none })).toBe('F3');
    expect(deckFloor({ gameChangers: 4, ...none })).toBe('F3');
    expect(deckFloor({ gameChangers: 5, ...none })).toBe('F3');
    expect(deckFloor({ gameChangers: 6, ...none })).toBe('F4');
  });

  it('terre distrutte e turni extra a catena portano a F4', () => {
    expect(deckFloor({ gameChangers: 0, ...none, massLandDestruction: true })).toBe('F4');
    expect(deckFloor({ gameChangers: 0, ...none, chainExtraTurns: true })).toBe('F4');
  });

  it('combo tardiva (7 o più) F3, rapida (6 o meno) F4; con più combo conta la più rapida', () => {
    const floor = (...mv) =>
      deckFloor({ gameChangers: 0, ...none, combos: mv.map((manaValue) => ({ manaValue })) });
    expect(floor(7)).toBe('F3');
    expect(floor(6)).toBe('F4');
    expect(floor(9, 3)).toBe('F4');
  });
});

describe('tierChoices', () => {
  it('blocca le fasce sotto il pavimento', () => {
    expect(tierChoices('F3').map((c) => c.disabled)).toEqual([true, true, false, false, false]);
    expect(tierChoices('F1').some((c) => c.disabled)).toBe(false);
  });
});

describe('detectSuspects', () => {
  it('trova terre distrutte per nome e per testo, e i turni extra per testo', async () => {
    const cards = cardsOf('Armageddon', 'Time Warp', 'Temporal Manipulation', 'Sol Ring');
    const lookup = await scryfall.lookup(cards.map((c) => c.name));
    expect(detectSuspects(cards, lookup)).toEqual({
      massLand: ['Armageddon'],
      extraTurns: ['Time Warp', 'Temporal Manipulation'],
    });
  });

  it('non segnala carte innocue', async () => {
    const cards = cardsOf('Sol Ring', 'Rhystic Study');
    const lookup = await scryfall.lookup(cards.map((c) => c.name));
    expect(detectSuspects(cards, lookup)).toEqual({ massLand: [], extraTurns: [] });
  });
});

describe('infiniteCombos', () => {
  it('somma il valore di mana dei pezzi (qualsiasi numero) e scarta le combo non infinite', async () => {
    const cards = cardsOf("Thassa's Oracle", 'Demonic Consultation', 'Sol Ring');
    const lookup = await scryfall.lookup(cards.map((c) => c.name));
    const found = await spellbook.findCombos({ commanders: [], cards });
    expect(infiniteCombos(found, lookup)).toEqual([
      {
        id: '742-1295',
        cards: ["Thassa's Oracle", 'Demonic Consultation'],
        produces: ['Exile your library', 'Win the game'],
        manaValue: 3,
      },
    ]);
    const soft = { id: 'y', cards: ['A', 'B'], produces: ['Gain life'], infinite: false };
    expect(infiniteCombos([soft], lookup)).toEqual([]);
  });

  it('una combo con tre carte conta: il valore di mana è la somma di tutte', async () => {
    const cards = cardsOf('Isochron Scepter', 'Dramatic Reversal', 'Sol Ring');
    const lookup = await scryfall.lookup(cards.map((c) => c.name));
    const three = {
      id: 'x',
      cards: ['Isochron Scepter', 'Dramatic Reversal', 'Sol Ring'],
      produces: ['Infinite mana'],
      infinite: true,
    };
    expect(infiniteCombos([three], lookup)).toEqual([
      { id: 'x', cards: three.cards, produces: three.produces, manaValue: 5 },
    ]);
  });

  it('la combo scelta a mano vale 7 (tardiva) o 0 (rapida)', () => {
    expect(manualCombo('late').manaValue).toBe(7);
    expect(manualCombo('rapid').manaValue).toBe(0);
  });
});

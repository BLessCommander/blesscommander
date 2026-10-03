import { describe, expect, it } from 'vitest';
import { fakeSpellbookFetch } from '../../../tests/fixtures/spellbook-fake.js';
import { createSpellbook, normalizeCombo } from './spellbook.js';

describe('createSpellbook', () => {
  it('manda comandanti e carte e legge le combo complete', async () => {
    let sent;
    const spellbook = createSpellbook({
      fetchImpl: (url, init) => {
        sent = { url, body: JSON.parse(init.body) };
        return fakeSpellbookFetch(url, init);
      },
    });
    const combos = await spellbook.findCombos({
      commanders: ['Tymna the Weaver'],
      cards: [
        { name: 'Basalt Monolith', qty: 1 },
        { name: 'Rings of Brighthearth', qty: 1 },
      ],
    });
    expect(sent.url).toBe('https://backend.commanderspellbook.com/find-my-combos');
    expect(sent.body.commanders).toEqual([{ card: 'Tymna the Weaver', quantity: 1 }]);
    expect(sent.body.main).toHaveLength(2);
    expect(combos).toEqual([
      {
        id: '100-200',
        cards: ['Basalt Monolith', 'Rings of Brighthearth'],
        produces: ['Infinite colorless mana'],
        infinite: true,
      },
    ]);
  });

  it('una risposta di errore diventa un errore', async () => {
    const spellbook = createSpellbook({ fetchImpl: async () => ({ ok: false, status: 503 }) });
    await expect(spellbook.findCombos({ commanders: [], cards: [] })).rejects.toThrow('503');
  });
});

describe('normalizeCombo', () => {
  it('è «infinita» se produce un effetto infinito o la vittoria', () => {
    const make = (...names) => ({
      id: 1,
      uses: [],
      produces: names.map((name) => ({ feature: { name } })),
    });
    expect(normalizeCombo(make('Infinite mana')).infinite).toBe(true);
    expect(normalizeCombo(make('Win the game')).infinite).toBe(true);
    expect(normalizeCombo(make('Gain life')).infinite).toBe(false);
  });
});

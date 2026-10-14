import { describe, expect, it } from 'vitest';
import { comboGroup, filterCombos, groupCombos } from './combo-filter.js';

const combo = (id, cards, produces) => ({ id, cards, produces });
const many = (n, produces = ['Infinite mana']) =>
  Array.from({ length: n }, (_, i) => combo(`c${i}`, [`Carta ${i}`, 'Altra'], produces));

describe('comboGroup', () => {
  it('vittoria diretta prima di infinito, poi altro', () => {
    expect(comboGroup(combo('a', ['A'], ['Infinite mana', 'Win the game']))).toBe('win');
    expect(comboGroup(combo('a', ['A'], ['Infinite ETB']))).toBe('infinite');
    expect(comboGroup(combo('a', ['A'], ['Draw a card']))).toBe('other');
    expect(comboGroup(combo('a', ['A']))).toBe('other');
  });
});

describe('filterCombos', () => {
  const list = [
    combo('1', ['Thassa’s Oracle', 'Demonic Consultation'], ['Win the game']),
    combo('2', ['Isochron Scepter', 'Dramatic Reversal'], ['Infinite mana']),
  ];
  it('senza testo restituisce tutto', () => {
    expect(filterCombos(list, '  ')).toHaveLength(2);
  });
  it('cerca per carta senza accenti né apostrofi', () => {
    expect(filterCombos(list, 'thassas').map((c) => c.id)).toEqual(['1']);
  });
  it('cerca per risultato e vuole tutte le parole', () => {
    expect(filterCombos(list, 'infinite mana').map((c) => c.id)).toEqual(['2']);
    expect(filterCombos(list, 'infinite oracle')).toEqual([]);
  });
});

describe('groupCombos', () => {
  it('sotto la soglia un solo gruppo senza titolo', () => {
    expect(groupCombos(many(7))).toEqual([{ id: null, combos: many(7) }]);
  });
  it('dalla soglia divide per risultato e salta i gruppi vuoti', () => {
    const list = [...many(5), ...many(3, ['Win the game'])];
    const groups = groupCombos(list);
    expect(groups.map((g) => [g.id, g.combos.length])).toEqual([
      ['win', 3],
      ['infinite', 5],
    ]);
  });
});

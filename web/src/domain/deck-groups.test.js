import { describe, expect, it } from 'vitest';
import { filterGroups, groupDecksByOwner } from './deck-groups.js';

const decks = [
  { id: 1, name: 'A', ownerLogin: 'zeta' },
  { id: 2, name: 'B', ownerLogin: 'anna' },
  { id: 3, name: 'C', ownerLogin: 'zeta' },
  { id: 4, name: 'D', ownerLogin: 'io' },
  { id: 5, name: 'E', ownerLogin: 'bruno' },
];
const names = { zeta: 'Zeta', anna: 'Anna', io: 'Io', bruno: 'Bruno' };

describe('groupDecksByOwner', () => {
  it('i miei mazzi per primi, gli altri giocatori in ordine alfabetico', () => {
    const groups = groupDecksByOwner(decks, { me: 'io', nameOf: (l) => names[l] });
    expect(groups.map((g) => g.label)).toEqual(['Io', 'Anna', 'Bruno', 'Zeta']);
    expect(groups[0].mine).toBe(true);
    expect(groups.slice(1).every((g) => !g.mine)).toBe(true);
  });

  it('dentro un gruppo i mazzi restano nell’ordine ricevuto', () => {
    const groups = groupDecksByOwner(decks, { me: 'io' });
    expect(groups.find((g) => g.login === 'zeta').decks.map((d) => d.id)).toEqual([1, 3]);
  });

  it('senza utente collegato nessun gruppo è «mio»; senza nomi si usa il login', () => {
    const groups = groupDecksByOwner(decks);
    expect(groups.some((g) => g.mine)).toBe(false);
    expect(groups.map((g) => g.label)).toEqual(['anna', 'bruno', 'io', 'zeta']);
  });

  it('nessun mazzo: nessun gruppo', () => {
    expect(groupDecksByOwner([])).toEqual([]);
  });
});

describe('filterGroups', () => {
  const groups = groupDecksByOwner(decks, { me: 'io' });

  it('«all» li mostra tutti', () => {
    expect(filterGroups(groups, 'all')).toHaveLength(4);
  });

  it('un giocatore: solo il suo gruppo', () => {
    expect(filterGroups(groups, 'anna').map((g) => g.login)).toEqual(['anna']);
  });

  it('un giocatore che non c’è più: si mostrano tutti', () => {
    expect(filterGroups(groups, 'sparito')).toHaveLength(4);
  });
});

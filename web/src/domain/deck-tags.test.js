import { describe, expect, it } from 'vitest';
import { addTag, cleanTag, filterGroupsByTag, removeTag, usedTags } from './deck-tags.js';

describe('cleanTag', () => {
  it('toglie gli spazi ai bordi e riduce quelli multipli', () => {
    expect(cleanTag('  molto   veloce ')).toBe('molto veloce');
  });
});

describe('addTag', () => {
  it('aggiunge un tag pulito', () => {
    expect(addTag(['a'], ' b ')).toEqual({ ok: true, tags: ['a', 'b'] });
    expect(addTag(undefined, 'x')).toEqual({ ok: true, tags: ['x'] });
  });

  it('rifiuta vuoti, troppo lunghi, doppioni (senza badare alle maiuscole) e oltre il massimo', () => {
    expect(addTag([], '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(addTag([], 'x'.repeat(25))).toEqual({ ok: false, reason: 'too-long' });
    expect(addTag(['Veloce'], 'veloce')).toEqual({ ok: false, reason: 'duplicate' });
    const eight = Array.from({ length: 8 }, (_, i) => `t${i}`);
    expect(addTag(eight, 'nuovo')).toEqual({ ok: false, reason: 'too-many' });
  });
});

describe('removeTag', () => {
  it('toglie solo quel tag', () => {
    expect(removeTag(['a', 'b'], 'a')).toEqual(['b']);
    expect(removeTag(undefined, 'a')).toEqual([]);
  });
});

describe('usedTags', () => {
  it('elenca i tag senza doppioni, in ordine, con il numero di mazzi', () => {
    const decks = [{ tags: ['veloce', 'combo'] }, { tags: ['Veloce'] }, {}];
    expect(usedTags(decks)).toEqual([
      { tag: 'combo', count: 1 },
      { tag: 'veloce', count: 2 },
    ]);
  });
});

describe('filterGroupsByTag', () => {
  const groups = [
    { login: 'a', decks: [{ id: 1, tags: ['veloce'] }, { id: 2 }] },
    { login: 'b', decks: [{ id: 3, tags: ['lento'] }] },
  ];

  it('con `all` non cambia nulla', () => {
    expect(filterGroupsByTag(groups, 'all')).toBe(groups);
  });

  it('tiene solo i mazzi col tag e toglie i gruppi vuoti', () => {
    const out = filterGroupsByTag(groups, 'VELOCE');
    expect(out).toHaveLength(1);
    expect(out[0].login).toBe('a');
    expect(out[0].decks.map((d) => d.id)).toEqual([1]);
  });
});

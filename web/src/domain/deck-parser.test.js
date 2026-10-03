import { describe, expect, it } from 'vitest';
import {
  commanderNames,
  deckCards,
  mergeDuplicates,
  parseDeckText,
  toggleCommander,
} from './deck-parser.js';

describe('parseDeckText', () => {
  it('legge quantità e nomi, con o senza "x"', () => {
    expect(parseDeckText('1 Sol Ring\n2x Island\nCounterspell')).toEqual([
      { name: 'Sol Ring', qty: 1, section: 'main' },
      { name: 'Island', qty: 2, section: 'main' },
      { name: 'Counterspell', qty: 1, section: 'main' },
    ]);
  });

  it('toglie edizione, numero e marcatori (formato Moxfield/Archidekt)', () => {
    const [a, b, c] = parseDeckText(
      '1 Sol Ring (CMM) 400\n1x Arcane Signet (ELD) 331 *F*\n1 Command Tower (CMD) 281 [Land]',
    );
    expect(a).toMatchObject({ name: 'Sol Ring', set: 'cmm', collector: '400' });
    expect(b).toMatchObject({ name: 'Arcane Signet', set: 'eld', collector: '331' });
    expect(c).toMatchObject({ name: 'Command Tower', set: 'cmd' });
  });

  it('riconosce i comandanti, anche più di uno, dalle intestazioni', () => {
    const lines = parseDeckText(
      'Commander\n1 Tymna the Weaver\n1 Thrasios, Triton Hero\n\nDeck\n1 Sol Ring',
    );
    expect(commanderNames(lines)).toEqual(['Tymna the Weaver', 'Thrasios, Triton Hero']);
    expect(lines.find((l) => l.name === 'Sol Ring').section).toBe('main');
  });

  it('mette sideboard e maybeboard fuori dal mazzo', () => {
    const lines = parseDeckText(
      '1 Sol Ring\nSideboard (2)\n1 Island\nSB: 1 Swamp\nMaybeboard\n1 Forest',
    );
    expect(deckCards(lines).map((l) => l.name)).toEqual(['Sol Ring']);
  });

  it('ignora righe vuote e commenti, accetta fine riga Windows', () => {
    expect(parseDeckText('// nota\r\n\r\n1 Sol Ring\r\n')).toHaveLength(1);
  });

  it('tiene intero il nome delle carte doppie', () => {
    expect(parseDeckText('1 Fire // Ice')[0].name).toBe('Fire // Ice');
  });

  it('un testo vuoto o nullo dà un elenco vuoto', () => {
    expect(parseDeckText('')).toEqual([]);
    expect(parseDeckText(undefined)).toEqual([]);
  });

  it('legge una lista di 100 carte con comandante', () => {
    const body = Array.from({ length: 98 }, (_, i) => `1 Carta ${i}`).join('\n');
    const lines = parseDeckText(
      `Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n${body}\n1 Sol Ring`,
    );
    expect(lines).toHaveLength(100);
    expect(commanderNames(lines)).toEqual(["Atraxa, Praetors' Voice"]);
  });
});

describe('mergeDuplicates', () => {
  it('somma le quantità della stessa carta', () => {
    expect(mergeDuplicates(parseDeckText('1 Island\n3 island'))).toEqual([
      { name: 'Island', qty: 4, section: 'main' },
    ]);
  });
});

describe('toggleCommander', () => {
  it('imposta e toglie più comandanti', () => {
    let lines = parseDeckText('1 Tymna the Weaver\n1 Thrasios, Triton Hero\n1 Sol Ring');
    lines = toggleCommander(lines, 'Tymna the Weaver');
    lines = toggleCommander(lines, 'Thrasios, Triton Hero');
    expect(commanderNames(lines)).toHaveLength(2);
    lines = toggleCommander(lines, 'Tymna the Weaver');
    expect(commanderNames(lines)).toEqual(['Thrasios, Triton Hero']);
  });

  it('non tocca le carte fuori dal mazzo', () => {
    const lines = parseDeckText('Sideboard\n1 Island');
    expect(toggleCommander(lines, 'Island')[0].section).toBe('side');
  });
});

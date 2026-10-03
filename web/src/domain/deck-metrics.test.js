import { describe, expect, it } from 'vitest';
import { detailCards } from './deck-cards.js';
import {
  colorBalance,
  curveByColor,
  deckSize,
  drawCategories,
  drawOdds,
  drawProbability,
  manaCurve,
  saltSummary,
  typeBreakdown,
} from './deck-metrics.js';

const info = {
  sol: { cmc: 1, typeLine: 'Artifact', colors: [], manaCost: '{1}', producedMana: ['C'] },
  counter: { cmc: 2, typeLine: 'Instant', colors: ['U'], manaCost: '{U}{U}', producedMana: [] },
  atraxa: {
    cmc: 4,
    typeLine: 'Legendary Creature — Angel',
    colors: ['W', 'U', 'B', 'G'],
    manaCost: '{G}{W}{U}{B}',
    producedMana: [],
  },
  island: {
    cmc: 0,
    typeLine: 'Basic Land — Island',
    colors: [],
    manaCost: '',
    producedMana: ['U'],
  },
  plains: {
    cmc: 0,
    typeLine: 'Basic Land — Plains',
    colors: [],
    manaCost: '',
    producedMana: ['W'],
  },
  colosso: {
    cmc: 9,
    typeLine: 'Artifact Creature — Construct',
    colors: [],
    manaCost: '{9}',
    producedMana: [],
  },
  hybrid: {
    cmc: 2,
    typeLine: 'Sorcery',
    colors: ['W', 'U'],
    manaCost: '{W/U}{W/U}',
    producedMana: [],
  },
};
const cards = detailCards(
  [
    { name: 'Sol Ring', qty: 1, scryfallId: 'sol' },
    { name: 'Counterspell', qty: 2, scryfallId: 'counter', isGameChanger: true },
    { name: 'Atraxa', qty: 1, scryfallId: 'atraxa' },
    { name: 'Island', qty: 10, scryfallId: 'island' },
    { name: 'Plains', qty: 5, scryfallId: 'plains' },
    { name: 'Colosso', qty: 1, scryfallId: 'colosso' },
    { name: 'Ibrida', qty: 1, scryfallId: 'hybrid' },
    { name: 'Carta senza dati', qty: 2 },
  ],
  info,
);

describe('deckSize', () => {
  it('conta anche le carte senza dati', () => {
    expect(deckSize(cards)).toBe(23);
  });
});

describe('manaCurve', () => {
  it('conta le sole magie per costo, con 8 o più nell’ultimo gruppo', () => {
    const { counts, total, average } = manaCurve(cards);
    expect(counts).toEqual([0, 1, 3, 0, 1, 0, 0, 0, 1]);
    expect(total).toBe(6);
    expect(average).toBeCloseTo(20 / 6, 5);
  });

  it('senza magie la media non c’è', () => {
    expect(manaCurve([])).toEqual({ counts: [0, 0, 0, 0, 0, 0, 0, 0, 0], total: 0, average: null });
  });
});

describe('curveByColor', () => {
  it('una magia multicolore conta in tutti i suoi colori, senza colore è «C»', () => {
    const curve = curveByColor(cards);
    expect(curve.C).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 1]);
    expect(curve.U).toEqual([0, 0, 3, 0, 1, 0, 0, 0, 0]);
    expect(curve.W).toEqual([0, 0, 1, 0, 1, 0, 0, 0, 0]);
    expect(curve.B[4]).toBe(1);
    expect(curve.G[4]).toBe(1);
    expect(curve.R.every((n) => n === 0)).toBe(true);
  });
});

describe('colorBalance', () => {
  const balance = colorBalance(cards);

  it('conta i simboli di mana, con gli ibridi in entrambi i colori', () => {
    expect(balance.U).toMatchObject({ pips: 7, costCards: 4 });
    expect(balance.W).toMatchObject({ pips: 3, costCards: 2 });
    expect(balance.B).toMatchObject({ pips: 1, costCards: 1 });
    expect(balance.R).toMatchObject({ pips: 0, costCards: 0 });
  });

  it('conta le carte che producono ogni colore, terre comprese', () => {
    expect(balance.U.sources).toBe(10);
    expect(balance.W.sources).toBe(5);
    expect(balance.C.sources).toBe(1);
    expect(balance.G.sources).toBe(0);
  });
});

describe('typeBreakdown', () => {
  it('conta per tipo principale nell’ordine fisso, senza le carte sconosciute', () => {
    expect(typeBreakdown(cards)).toEqual([
      { type: 'Creature', count: 2 },
      { type: 'Instant', count: 2 },
      { type: 'Sorcery', count: 1 },
      { type: 'Artifact', count: 1 },
      { type: 'Land', count: 15 },
    ]);
  });
});

describe('drawProbability', () => {
  const base = { size: 60, successes: 24, draws: 7 };

  it('almeno una: 1 − C(36,7)/C(60,7)', () => {
    expect(drawProbability({ ...base, wanted: 1 })).toBeCloseTo(0.97838, 4);
  });

  it('esattamente zero e al massimo zero coincidono', () => {
    const none = drawProbability({ ...base, wanted: 0, mode: 'exactly' });
    expect(none).toBeCloseTo(0.0216, 3);
    expect(drawProbability({ ...base, wanted: 0, mode: 'atMost' })).toBeCloseTo(none, 10);
  });

  it('le probabilità «esattamente» sommano a 1', () => {
    let total = 0;
    for (let i = 0; i <= 7; i += 1)
      total += drawProbability({ ...base, wanted: i, mode: 'exactly' });
    expect(total).toBeCloseTo(1, 8);
  });

  it('almeno zero è sempre certo; senza carte buone «almeno una» è impossibile', () => {
    expect(drawProbability({ ...base, wanted: 0 })).toBeCloseTo(1, 10);
    expect(drawProbability({ ...base, successes: 0, wanted: 1 })).toBe(0);
  });

  it('se si pesca tutto il mazzo ogni carta buona esce', () => {
    expect(drawProbability({ size: 40, successes: 5, draws: 40, wanted: 5 })).toBeCloseTo(1, 10);
  });

  it('non si pesca più del mazzo e non esplode con numeri grandi', () => {
    expect(drawProbability({ size: 3, successes: 1, draws: 10, wanted: 1 })).toBeCloseTo(1, 10);
    const big = drawProbability({ size: 250, successes: 100, draws: 20, wanted: 8 });
    expect(big).toBeGreaterThan(0);
    expect(big).toBeLessThanOrEqual(1);
  });
});

describe('drawCategories e drawOdds', () => {
  it('categorie per tipo, con «Game changer» in fondo', () => {
    expect(drawCategories(cards, 'type')).toEqual([
      { key: 'Creature', qty: 2 },
      { key: 'Instant', qty: 2 },
      { key: 'Sorcery', qty: 1 },
      { key: 'Artifact', qty: 1 },
      { key: 'Land', qty: 15 },
      { key: 'gameChanger', qty: 2 },
    ]);
  });

  it('categorie per costo e per colore', () => {
    const cmc = drawCategories(cards, 'cmc').map((r) => r.key);
    expect(cmc).toEqual(['0', '1', '2', '4', '8', 'gameChanger']);
    const colors = drawCategories(cards, 'color').map((r) => r.key);
    expect(colors).toEqual(['U', 'M', 'C', 'gameChanger']);
  });

  it('la tabella usa la dimensione del mazzo con anche le carte senza dati', () => {
    const table = drawOdds(cards, { by: 'type', wanted: 1, draws: 7 });
    expect(table.size).toBe(23);
    expect(table.draws).toBe(7);
    const land = table.rows.find((r) => r.key === 'Land');
    expect(land.odds).toBeCloseTo(
      drawProbability({ size: 23, successes: 15, draws: 7, wanted: 1 }),
      10,
    );
  });

  it('le carte da pescare non superano il mazzo', () => {
    expect(drawOdds(cards, { draws: 99 }).draws).toBe(23);
  });
});

describe('saltSummary', () => {
  const salt = { 'Sol Ring': 0.2, Counterspell: 1.5, Atraxa: 0.7, Island: 0, Colosso: 3.2 };

  it('somma pesata per quantità, media sulle carte con punteggio, carte coperte', () => {
    const summary = saltSummary(cards, salt);
    expect(summary.available).toBe(true);
    // 0.2 + 1.5*2 + 0.7 + 0*10 + 3.2 = 7.1
    expect(summary.total).toBeCloseTo(7.1, 10);
    expect(summary.covered).toBe(1 + 2 + 1 + 10 + 1);
    expect(summary.average).toBeCloseTo(7.1 / 15, 10);
    expect(summary.size).toBe(23);
  });

  it('distribuisce le carte per fasce, con i limiti esclusi', () => {
    const edge = detailCards(
      [
        { name: 'A', qty: 1 },
        { name: 'B', qty: 2 },
        { name: 'C', qty: 1 },
        { name: 'D', qty: 1 },
        { name: 'E', qty: 3 },
      ],
      {},
    );
    const summary = saltSummary(edge, { A: 0.49, B: 0.5, C: 1, D: 2, E: 3.9 });
    expect(summary.buckets).toEqual([1, 2, 1, 4]);
  });

  it('elenca le carte più salate, senza quelle a zero, al massimo dieci', () => {
    const many = detailCards(
      Array.from({ length: 15 }, (_, i) => ({ name: `Carta ${i}`, qty: 1 })),
      {},
    );
    const scores = Object.fromEntries(many.map((c, i) => [c.name, i / 4]));
    const { top } = saltSummary(many, scores);
    expect(top).toHaveLength(10);
    expect(top[0]).toEqual({ name: 'Carta 14', salt: 3.5, qty: 1 });
    expect(top.every((c) => c.salt > 0)).toBe(true);
  });

  it('a pari punteggio ordina per nome', () => {
    const pair = detailCards(
      [
        { name: 'Zeta', qty: 1 },
        { name: 'Alfa', qty: 1 },
      ],
      {},
    );
    const { top } = saltSummary(pair, { Zeta: 1, Alfa: 1 });
    expect(top.map((c) => c.name)).toEqual(['Alfa', 'Zeta']);
  });

  it('senza punteggi non c’è nulla da mostrare', () => {
    for (const none of [undefined, {}]) {
      const summary = saltSummary(cards, none);
      expect(summary.available).toBe(false);
      expect(summary.average).toBeNull();
      expect(summary.total).toBe(0);
      expect(summary.top).toEqual([]);
    }
  });
});

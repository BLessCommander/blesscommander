// Statistiche di un mazzo (C-08g): curva di mana, colori, tipi e probabilità di pescata.
// Funzioni pure sulle carte già unite ai dati di Scryfall (`detailCards`). Le carte senza dati
// (`known: false`) non entrano nei conteggi, ma contano nelle dimensioni del mazzo.

import { colorGroup, primaryType, TYPE_ORDER } from './deck-cards.js';

/** @typedef {import('./deck-cards.js').DetailedCard} DetailedCard */

export const COLORS = ['W', 'U', 'B', 'R', 'G'];
/** Colori più l'incolore, nell'ordine in cui si mostrano. */
export const MANA_COLORS = [...COLORS, 'C'];
/** Ultimo gruppo della curva: `8` significa «8 o più». */
export const CURVE_MAX = 8;

const qtyOf = (card) => card.qty ?? 1;
const isSpell = (card) => card.known && card.type !== 'Land';
const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);
const bucket = (cmc) => Math.min(Math.floor(cmc), CURVE_MAX);

/** Quante carte ha il mazzo, comprese quelle senza dati. @param {DetailedCard[]} cards */
export const deckSize = (cards) => sum(cards, qtyOf);

/**
 * Curva di mana delle sole magie (terre escluse): carte per ogni costo, da 0 a «8 o più».
 * @param {DetailedCard[]} cards
 * @returns {{ counts: number[], total: number, average: number | null }}
 */
export function manaCurve(cards) {
  const counts = Array.from({ length: CURVE_MAX + 1 }, () => 0);
  const spells = cards.filter(isSpell);
  for (const card of spells) counts[bucket(card.cmc)] += qtyOf(card);
  const total = sum(spells, qtyOf);
  return {
    counts,
    total,
    average: total ? sum(spells, (card) => card.cmc * qtyOf(card)) / total : null,
  };
}

/**
 * Curva di ogni colore. Una magia multicolore conta in tutti i suoi colori; senza colore è «C».
 * @param {DetailedCard[]} cards
 * @returns {Record<string, number[]>}
 */
export function curveByColor(cards) {
  const result = Object.fromEntries(
    MANA_COLORS.map((c) => [c, Array.from({ length: CURVE_MAX + 1 }, () => 0)]),
  );
  for (const card of cards.filter(isSpell)) {
    const colors = card.colors.length ? card.colors : ['C'];
    for (const color of colors) {
      if (result[color]) result[color][bucket(card.cmc)] += qtyOf(card);
    }
  }
  return result;
}

/** Simboli di mana colorati di un costo; un simbolo ibrido conta per entrambi i colori. */
function pipsOf(manaCost) {
  const pips = Object.fromEntries(COLORS.map((c) => [c, 0]));
  for (const [, symbol] of String(manaCost).matchAll(/\{([^}]+)\}/g)) {
    for (const color of COLORS) if (symbol.split('/').includes(color)) pips[color] += 1;
  }
  return pips;
}

/**
 * Colori richiesti dalle magie (simboli e carte) e colori che il mazzo sa produrre (carte).
 * @param {DetailedCard[]} cards
 * @returns {Record<string, { pips: number, costCards: number, sources: number }>}
 */
export function colorBalance(cards) {
  const result = Object.fromEntries(
    MANA_COLORS.map((c) => [c, { pips: 0, costCards: 0, sources: 0 }]),
  );
  for (const card of cards.filter((c) => c.known)) {
    const qty = qtyOf(card);
    if (card.type !== 'Land') {
      const pips = pipsOf(card.manaCost);
      for (const color of COLORS) {
        result[color].pips += pips[color] * qty;
        if (pips[color] > 0) result[color].costCards += qty;
      }
    }
    for (const color of new Set(card.producedMana ?? [])) {
      if (result[color]) result[color].sources += qty;
    }
  }
  return result;
}

/**
 * Carte per tipo principale, nell'ordine fisso dei tipi, senza i tipi vuoti.
 * @param {DetailedCard[]} cards
 * @returns {{ type: string, count: number }[]}
 */
export function typeBreakdown(cards) {
  const counts = new Map();
  for (const card of cards.filter((c) => c.known)) {
    counts.set(card.type, (counts.get(card.type) ?? 0) + qtyOf(card));
  }
  return [...TYPE_ORDER, 'Other']
    .filter((type) => counts.has(type))
    .map((type) => ({ type, count: counts.get(type) }));
}

/** Logaritmi dei fattoriali, per i coefficienti binomiali senza overflow. */
const logFactorial = (() => {
  const table = [0];
  return (n) => {
    for (let i = table.length; i <= n; i += 1) table.push(table[i - 1] + Math.log(i));
    return table[n];
  };
})();
const logChoose = (n, k) =>
  k < 0 || k > n ? -Infinity : logFactorial(n) - logFactorial(k) - logFactorial(n - k);

/**
 * Probabilità (0–1) di trovare in `draws` carte pescate da un mazzo di `size` carte, con
 * `successes` carte buone, almeno / esattamente / al più `wanted` carte buone (ipergeometrica).
 * @param {{ size: number, successes: number, draws: number, wanted: number, mode?: 'atLeast' | 'exactly' | 'atMost' }} input
 */
export function drawProbability({ size, successes, draws, wanted, mode = 'atLeast' }) {
  const n = Math.max(0, Math.min(draws, size));
  const K = Math.max(0, Math.min(successes, size));
  const pmf = (i) => Math.exp(logChoose(K, i) + logChoose(size - K, n - i) - logChoose(size, n));
  let probability = 0;
  const top = Math.min(K, n);
  for (let i = 0; i <= top; i += 1) {
    const hit = mode === 'exactly' ? i === wanted : mode === 'atMost' ? i <= wanted : i >= wanted;
    if (hit) probability += pmf(i);
  }
  return Math.min(1, Math.max(0, probability));
}

/**
 * Categorie di carte per le probabilità: tipo, costo di mana o colore, più «Game changer».
 * @param {DetailedCard[]} cards
 * @param {'type' | 'cmc' | 'color'} by
 * @returns {{ key: string, qty: number }[]}
 */
export function drawCategories(cards, by) {
  const counts = new Map();
  const add = (key, qty) => counts.set(key, (counts.get(key) ?? 0) + qty);
  for (const card of cards.filter((c) => c.known)) {
    const qty = qtyOf(card);
    if (by === 'cmc') add(String(bucket(card.cmc)), qty);
    else if (by === 'color') add(colorGroup(card.colors), qty);
    else add(card.type ?? primaryType(card.typeLine), qty);
  }
  const order =
    by === 'cmc'
      ? Array.from({ length: CURVE_MAX + 1 }, (_, i) => String(i))
      : by === 'color'
        ? ['W', 'U', 'B', 'R', 'G', 'M', 'C']
        : [...TYPE_ORDER, 'Other'];
  const rows = order.filter((key) => counts.has(key)).map((key) => ({ key, qty: counts.get(key) }));
  const gameChangers = sum(
    cards.filter((c) => c.isGameChanger),
    qtyOf,
  );
  if (gameChangers > 0) rows.push({ key: 'gameChanger', qty: gameChangers });
  return rows;
}

/**
 * Tabella delle probabilità per categoria.
 * @param {DetailedCard[]} cards
 * @param {{ by?: 'type' | 'cmc' | 'color', mode?: 'atLeast' | 'exactly' | 'atMost', wanted?: number, draws?: number }} [options]
 * @returns {{ size: number, draws: number, rows: { key: string, qty: number, odds: number }[] }}
 */
export function drawOdds(cards, { by = 'type', mode = 'atLeast', wanted = 1, draws = 7 } = {}) {
  const size = deckSize(cards);
  return {
    size,
    draws: Math.min(draws, size),
    rows: drawCategories(cards, by).map(({ key, qty }) => ({
      key,
      qty,
      odds: drawProbability({ size, successes: qty, draws, wanted, mode }),
    })),
  };
}

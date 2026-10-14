// Ricerca e raggruppamento delle combo nella chiusura partita (C-10d). Funzioni pure.
import { comboLabel } from './game-close.js';

/** Da questo numero di combo (dopo la ricerca) l'elenco si divide in gruppi per risultato. */
export const GROUP_FROM = 8;

/** Gruppi, nell'ordine in cui compaiono. */
export const COMBO_GROUPS = ['win', 'infinite', 'other'];

const plain = (text) =>
  String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').toLowerCase();

/** Gruppo di una combo, dal risultato prodotto: «Win the game», «Infinite…» o altro. */
export function comboGroup(combo) {
  const produces = (combo.produces ?? []).map(plain);
  if (produces.some((p) => p.startsWith('win the game'))) return 'win';
  if (produces.some((p) => p.startsWith('infinite'))) return 'infinite';
  return 'other';
}

/**
 * Combo che contengono tutte le parole cercate nel nome di una carta o in un risultato.
 * Senza testo restituisce tutte le combo.
 * @param {any[]} combos
 * @param {string} query
 */
export function filterCombos(combos, query) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return combos;
  return combos.filter((c) => {
    const text = plain(`${comboLabel(c)} ${(c.produces ?? []).join(' ')}`);
    return words.every((w) => text.includes(w));
  });
}

/**
 * Divide le combo in gruppi solo se sono almeno `GROUP_FROM`; altrimenti un solo gruppo senza titolo.
 * @param {any[]} combos
 * @param {number} [threshold]
 * @returns {{ id: string | null, combos: any[] }[]}
 */
export function groupCombos(combos, threshold = GROUP_FROM) {
  if (combos.length < threshold) return [{ id: null, combos }];
  return COMBO_GROUPS.map((id) => ({
    id,
    combos: combos.filter((c) => comboGroup(c) === id),
  })).filter((g) => g.combos.length);
}

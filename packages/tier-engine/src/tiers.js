// Utilità sulle fasce F1–F5 e sulle loro finestre di turno (SPEC §2 e §3.4).

/** @typedef {'F1'|'F2'|'F3'|'F4'|'F5'} TierId */

/** @param {TierId} tier @returns {number} da 1 a 5 */
export function tierNumber(tier) {
  const n = Number(String(tier).slice(1));
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error(`Fascia non valida: ${tier}`);
  return n;
}

/** @param {number} n @returns {TierId} */
export function tierId(n) {
  return /** @type {TierId} */ (`F${Math.min(5, Math.max(1, n))}`);
}

/** @param {TierId} a @param {TierId} b @returns {TierId} la più alta */
export function maxTier(a, b) {
  return tierNumber(a) >= tierNumber(b) ? a : b;
}

/** Fascia di velocità (Fv) per un TMV. @param {number} tmv @param {Record<string, number>} thresholds */
export function tierFromTmv(tmv, thresholds) {
  if (tmv <= thresholds.F5) return tierId(5);
  if (tmv <= thresholds.F4) return tierId(4);
  if (tmv <= thresholds.F3) return tierId(3);
  if (tmv <= thresholds.F2) return tierId(2);
  return tierId(1);
}

/** Turno massimo (incluso) della finestra di una fascia: F1 non ha limite. */
export function upperLimit(tier, thresholds) {
  const n = tierNumber(tier);
  return n === 1 ? Infinity : thresholds[tier];
}

/** Turno minimo (escluso) della finestra di una fascia: F5 non ha limite. */
export function lowerLimit(tier, thresholds) {
  const n = tierNumber(tier);
  return n === 5 ? -Infinity : thresholds[tierId(n + 1)];
}

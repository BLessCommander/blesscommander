// Motore fasce: JavaScript puro, senza dipendenze da browser, GitHub o Firebase (docs/spec/01 e 02).

/** Fasce di gioco, dalla più lenta (F1) alla più veloce (F5). */
export const TIER_IDS = Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5']);

export { DEFAULT_FORMATS, DEFAULT_PARAMS, DEFAULT_VARIANTS, buildConfig } from './defaults.js';
export { evaluateDeck } from './decision.js';
export { computeFloor } from './floor.js';
export {
  analyzeGame,
  computeDominance,
  computeTmv,
  effectiveTurn,
  tableWeight,
} from './metrics.js';
export { recalculate } from './recalc.js';
export { tierFromTmv, tierId, tierNumber } from './tiers.js';

// Pavimento di costruzione (SPEC §3.2): la fascia minima permessa dalla lista.
import { maxTier } from './tiers.js';

/**
 * @typedef {object} DeckFeatures
 * @property {number} [gameChangers] numero di game changer
 * @property {boolean} [massLandDestruction] terre distrutte di massa
 * @property {boolean} [chainExtraTurns] turni extra concatenabili
 * @property {{ manaValue: number }|null} [twoCardCombo] valore di mana totale dei due pezzi
 */

/**
 * @param {DeckFeatures} features
 * @param {{ maxGameChangerF3: number }} params
 * @returns {import('./tiers.js').TierId}
 */
export function computeFloor(features, params) {
  /** @type {import('./tiers.js').TierId} */
  let floor = 'F1';
  const gc = features.gameChangers ?? 0;
  if (gc > params.maxGameChangerF3) floor = maxTier(floor, 'F4');
  else if (gc >= 1) floor = maxTier(floor, 'F3');
  if (features.massLandDestruction) floor = maxTier(floor, 'F4');
  if (features.chainExtraTurns) floor = maxTier(floor, 'F4');
  if (features.twoCardCombo) {
    floor = maxTier(floor, features.twoCardCombo.manaValue >= 7 ? 'F3' : 'F4');
  }
  return floor;
}

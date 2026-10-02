// Regole di decisione del motore (SPEC §3.6, §3.7).
import { computeDominance, computeTmv } from './metrics.js';
import { lowerLimit, tierFromTmv, tierId, tierNumber, upperLimit } from './tiers.js';

/**
 * Stato di un mazzo durante il calcolo.
 * @typedef {object} DeckState
 * @property {import('./tiers.js').TierId} tier
 * @property {import('./tiers.js').TierId} floor
 * @property {boolean} f5Confirmed il proprietario ha confermato la fascia F5
 * @property {number} gamesPlayed partite che contano per le fasce
 * @property {number} gamesSinceChange
 * @property {import('./metrics.js').SpeedRecord[]} speed
 * @property {import('./metrics.js').DominanceRecord[]} dominance
 */

/**
 * @typedef {object} Evaluation
 * @property {import('./tiers.js').TierId} tier fascia dopo la valutazione
 * @property {number|null} tmv
 * @property {import('./tiers.js').TierId|null} speedTier Fv, null se i dati non bastano
 * @property {number|null} dominance D, null se i dati non bastano
 * @property {string[]} reasons motivi: velocita, dominio, lentezza, inefficacia, pavimento, F5_richiede_conferma
 * @property {string[]} badges
 * @property {'provvisorio'|'stabile'|'in_osservazione'|'dominante'} status
 */

/**
 * Valuta un mazzo dopo una partita. Non modifica lo stato.
 * @param {DeckState} deck
 * @param {Record<string, any>} params
 * @returns {Evaluation}
 */
export function evaluateDeck(deck, params) {
  const { tmv, wins } = computeTmv(deck.speed, params);
  const speedTier =
    tmv !== null && wins >= params.minVittorieVelocita ? tierFromTmv(tmv, params.soglieTMV) : null;
  const { d, games: dominanceGames } = computeDominance(deck.dominance, params);

  const current = tierNumber(deck.tier);
  const margin = params.margineIsteresi;
  const thresholds = params.soglieTMV;
  const target = tierId(current + 1);
  const fv = speedTier ? tierNumber(speedTier) : null;
  // Un mazzo che vince tanto ma piano non sale: il TMV deve essere vicino alla fascia di arrivo.
  const dominanceTargetOk =
    tmv !== null && current < 5 && tmv <= upperLimit(target, thresholds) + 1;

  let next = current;
  /** @type {string[]} */
  const reasons = [];
  if (deck.gamesSinceChange >= params.cooldownPartite) {
    if (
      fv !== null &&
      fv > current &&
      current < 5 &&
      tmv <= upperLimit(target, thresholds) - margin
    ) {
      next = current + 1;
      reasons.push('velocita');
    } else if (d !== null && d >= params.dominioAlto && dominanceTargetOk) {
      next = current + 1;
      reasons.push('dominio');
    } else if (
      current > 1 &&
      fv !== null &&
      fv < current &&
      tmv > upperLimit(deck.tier, thresholds) + margin
    ) {
      next = current - 1;
      reasons.push('lentezza');
    } else if (
      current > 1 &&
      d !== null &&
      d <= params.dominioBasso &&
      dominanceGames >= params.minPartiteInefficacia
    ) {
      next = current - 1;
      reasons.push('inefficacia');
    }
  }

  const badges = [];
  if (next < tierNumber(deck.floor)) {
    next = tierNumber(deck.floor);
    reasons.push('pavimento');
    badges.push('Sovradimensionato in lista');
  }
  if (next === 5 && current < 5 && !deck.f5Confirmed) {
    next = 4;
    reasons.push('F5_richiede_conferma');
  }

  const dominant =
    d !== null && d >= params.dominioAlto && current < 5 && next === current && !dominanceTargetOk;
  if (dominant) badges.push('Dominante della fascia');

  const nearEdge =
    tmv !== null &&
    speedTier !== null &&
    (tmv > upperLimit(deck.tier, thresholds) - margin ||
      tmv < lowerLimit(deck.tier, thresholds) + margin);
  /** @type {Evaluation['status']} */
  let status = 'stabile';
  if (deck.gamesPlayed < params.minPartiteStabile) status = 'provvisorio';
  else if (dominant) status = 'dominante';
  else if (next === current && ((fv !== null && fv !== current) || nearEdge))
    status = 'in_osservazione';

  return { tier: tierId(next), tmv, speedTier, dominance: d, reasons, badges, status };
}

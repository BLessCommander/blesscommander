/**
 * @typedef {object} Tier
 * @property {string} id
 * @property {string} name
 * @property {string} turns Turno di vittoria atteso (SPEC §2)
 */

/** @type {readonly Tier[]} */
export const TIERS = Object.freeze([
  { id: 'F1', name: 'Esibizione', turns: '10 o più' },
  { id: 'F2', name: 'Base', turns: '8 – 9' },
  { id: 'F3', name: 'Potenziata', turns: '6 – 7' },
  { id: 'F4', name: 'Ottimizzata', turns: '4 – 5' },
  { id: 'F5', name: 'Competitiva', turns: '3 o meno' },
]);

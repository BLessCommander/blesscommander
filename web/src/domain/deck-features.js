import { DEFAULT_PARAMS, TIER_IDS, computeFloor, tierNumber } from '@blesscommander/tier-engine';
import { cardKey } from '../platform/scryfall.js';

// Caratteristiche del mazzo che fissano il pavimento (SPEC §3.2). Terre distrutte di massa e turni
// extra non si rilevano al 100%: l'app propone le carte sospette e il proprietario conferma.

/** @typedef {import('../platform/scryfall.js').CardLookup} CardLookup */
/** @typedef {import('../platform/spellbook.js').Combo} Combo */
/** @typedef {'F1'|'F2'|'F3'|'F4'|'F5'} TierId */

/** Carte note che distruggono (quasi) tutte le terre. */
const MASS_LAND_DESTRUCTION = [
  'Armageddon',
  'Ravages of War',
  'Catastrophe',
  'Devastation',
  'Ruination',
  'Jokulhaups',
  'Obliterate',
  'Decree of Annihilation',
  'Apocalypse',
  'Wake of Destruction',
  'Boil',
  'Boiling Seas',
  'Impending Disaster',
  'Sunder',
  'Death Cloud',
  'Global Ruin',
  'Wildfire',
  'Burning of Xinye',
];

const MASS_LAND_TEXT = /destroy all (?:[\w-]+ )?lands|each player sacrifices (?:all|every) lands?/i;
const EXTRA_TURN_TEXT = /takes? an extra turn|extra turn after this one|additional turn/i;

/** Da questo numero di carte con turno extra in poi il turno extra è proposto come «a catena». */
export const CHAIN_EXTRA_TURNS_FROM = 2;

const massLandKeys = new Set(MASS_LAND_DESTRUCTION.map(cardKey));

/**
 * Carte da far confermare al proprietario.
 * @param {{ name: string }[]} cards
 * @param {CardLookup} lookup
 * @returns {{ massLand: string[], extraTurns: string[] }}
 */
export function detectSuspects(cards, lookup) {
  const massLand = [];
  const extraTurns = [];
  for (const { name } of cards) {
    const info = lookup.cards[cardKey(name)];
    const text = info?.oracleText ?? '';
    if (massLandKeys.has(cardKey(info?.name ?? name)) || MASS_LAND_TEXT.test(text)) {
      massLand.push(info?.name ?? name);
    } else if (EXTRA_TURN_TEXT.test(text)) {
      extraTurns.push(info?.name ?? name);
    }
  }
  return { massLand, extraTurns };
}

/**
 * Combo con esattamente due carte che producono un effetto infinito o la vittoria, col valore di mana
 * totale dei due pezzi (somma dei valori di mana delle due carte).
 * @param {Combo[]} combos
 * @param {CardLookup} lookup
 * @returns {{ id: string, cards: string[], produces: string[], manaValue: number }[]}
 */
export function twoCardCombos(combos, lookup) {
  return combos
    .filter((c) => c.cards.length === 2 && c.infinite)
    .map((c) => ({
      id: c.id,
      cards: c.cards,
      produces: c.produces,
      manaValue: c.cards.reduce((sum, name) => sum + (lookup.cards[cardKey(name)]?.cmc ?? 0), 0),
    }));
}

/**
 * Le cinque fasce, con quelle sotto il pavimento non selezionabili.
 * @param {string} floor
 * @returns {{ tier: string, disabled: boolean }[]}
 */
export function tierChoices(floor) {
  return TIER_IDS.map((tier) => ({ tier, disabled: tierNumber(tier) < tierNumber(floor) }));
}

/** Combo scelta a mano quando Spellbook non risponde: tardiva (7) o rapida (0). @param {'late'|'rapid'} kind */
export const manualCombo = (kind) => ({
  cards: [],
  produces: [],
  manaValue: kind === 'late' ? 7 : 0,
});

/**
 * Pavimento del mazzo dalle risposte del wizard.
 * @param {{ gameChangers: number, massLandDestruction: boolean, chainExtraTurns: boolean,
 *   combos: { manaValue: number }[] }} input
 * @param {{ maxGameChangerF3: number }} [params]
 * @returns {TierId}
 */
export function deckFloor(input, params = DEFAULT_PARAMS) {
  const weakest = input.combos.length ? Math.min(...input.combos.map((c) => c.manaValue)) : null;
  return computeFloor(
    {
      gameChangers: input.gameChangers,
      massLandDestruction: input.massLandDestruction,
      chainExtraTurns: input.chainExtraTurns,
      twoCardCombo: weakest === null ? null : { manaValue: weakest },
    },
    params,
  );
}

/**
 * Ciò che il wizard mostra per un mazzo: game changer e carte sospette.
 * @param {{ name: string }[]} cards carte del mazzo (senza duplicati)
 * @param {CardLookup} lookup
 */
export function wizardInput(cards, lookup) {
  return {
    gameChangers: cards
      .map((c) => lookup.cards[cardKey(c.name)])
      .filter((info) => info?.isGameChanger)
      .map((info) => info.name),
    suspects: detectSuspects(cards, lookup),
  };
}

/**
 * Combo a due carte del mazzo, chieste a Commander Spellbook tramite l'Action `import`
 * (dal browser non risponde). `null` se la richiesta fallisce: il wizard le fa dichiarare a mano.
 * @param {object} input
 * @param {string[]} input.commanders
 * @param {{ name: string, qty: number }[]} input.cards
 * @param {CardLookup} input.lookup
 * @param {(deckJson: string) => Promise<{ combos?: Combo[] }>} input.request
 */
export async function findDeckCombos({ commanders, cards, lookup, request }) {
  try {
    const done = await request(
      JSON.stringify({ commanders, cards: cards.map((c) => ({ name: c.name, qty: c.qty })) }),
    );
    return twoCardCombos(done.combos ?? [], lookup);
  } catch {
    return null;
  }
}

import { buildDeckFromImport, checkImport } from './deck-import.js';
import { findDeckCombos, wizardInput } from './deck-features.js';
import { commanderNames, deckCards, mergeDuplicates, parseDeckText } from './deck-parser.js';

/**
 * @typedef {{ name: string, url: string }} DeckToImport
 * @typedef {{ name: string, status: 'imported' | 'review' | 'failed' | 'skipped', reason?: string }} ImportOutcome
 * @typedef {{ status: 'ready', entry: DeckToImport, name: string, lines: any[], lookup: any,
 *   combos: any[] | null, gameChangers: string[], suspects: { massLand: string[], extraTurns: string[] } }} PreparedDeck
 */

/**
 * Prepara un mazzo di Archidekt per il wizard: scarica la lista, cerca le carte e le combo.
 * Un mazzo va avanti solo se la lista è completa: comandante presente e carte tutte trovate.
 * Gli altri restano da importare a mano dal loro link (`review`) oppure sono falliti (`failed`).
 * @param {object} input
 * @param {DeckToImport} input.entry
 * @param {(url: string) => Promise<{ deckName?: string, result: string, salt?: Record<string, number> }>} input.requestDeck
 * @param {(names: string[]) => Promise<any>} input.lookup
 * @param {(deckJson: string) => Promise<{ combos?: any[] }>} input.requestCombos
 * @returns {Promise<PreparedDeck | ImportOutcome>}
 */
export async function prepareDeck({ entry, requestDeck, lookup, requestCombos }) {
  try {
    const state = await requestDeck(entry.url);
    const lines = parseDeckText(state.result);
    const found = await lookup(deckCards(lines).map((l) => l.name));
    const check = checkImport(lines, found);
    if (!check.ok) return { name: entry.name, status: 'review', reason: check.reasons.join(',') };
    const cards = mergeDuplicates(deckCards(lines));
    const combos = await findDeckCombos({
      commanders: commanderNames(lines),
      cards,
      lookup: found,
      request: requestCombos,
    });
    return {
      status: 'ready',
      entry,
      name: state.deckName || entry.name || '',
      lines,
      lookup: found,
      combos,
      salt: state.salt,
      ...wizardInput(cards, found),
    };
  } catch (error) {
    return { name: entry.name, status: 'failed', reason: error?.message || '' };
  }
}

/**
 * Mazzo e versione da salvare, con la scelta fatta nel wizard.
 * @param {PreparedDeck} prepared
 * @param {{ declaredTier: string, assessment: any }} choice
 * @param {string} importedAt
 */
export function buildPreparedDeck(prepared, { declaredTier, assessment }, importedAt) {
  return buildDeckFromImport({
    name: prepared.name,
    lines: prepared.lines,
    lookup: prepared.lookup,
    declaredTier,
    assessment,
    importedAt,
    sourceUrl: prepared.entry.url,
    salt: prepared.salt,
  });
}

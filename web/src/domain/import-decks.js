import { buildDeckFromImport, checkImport } from './deck-import.js';
import { deckCards, parseDeckText } from './deck-parser.js';

/**
 * @typedef {{ name: string, url: string, tier?: string }} DeckToImport `tier` è la fascia dichiarata per quel mazzo
 * @typedef {{ name: string, status: 'imported' | 'review' | 'failed', reason?: string }} ImportOutcome
 */

/**
 * Importa più mazzi di Archidekt, uno dopo l'altro (le scritture sul repository non vanno in parallelo).
 * Un mazzo va salvato solo se la lista è completa: comandante presente e carte tutte trovate.
 * Gli altri restano da importare a mano dal loro link (`review`) oppure sono falliti (`failed`).
 * @param {object} input
 * @param {DeckToImport[]} input.decks
 * @param {string} input.declaredTier fascia per i mazzi che non ne indicano una
 * @param {(url: string) => Promise<{ deckName?: string, result: string }>} input.requestDeck
 * @param {(names: string[]) => Promise<any>} input.lookup
 * @param {(deck: any, version: any) => Promise<void>} input.save
 * @param {() => string} input.now
 * @param {(done: number, total: number) => void} [input.onProgress]
 * @returns {Promise<ImportOutcome[]>}
 */
export async function importDecks({
  decks,
  declaredTier,
  requestDeck,
  lookup,
  save,
  now,
  onProgress,
}) {
  /** @type {ImportOutcome[]} */
  const outcomes = [];
  for (const [index, entry] of decks.entries()) {
    onProgress?.(index, decks.length);
    try {
      const state = await requestDeck(entry.url);
      const lines = parseDeckText(state.result);
      const found = await lookup(deckCards(lines).map((l) => l.name));
      const check = checkImport(lines, found);
      if (!check.ok) {
        outcomes.push({ name: entry.name, status: 'review', reason: check.reasons.join(',') });
        continue;
      }
      const { deck, version } = buildDeckFromImport({
        name: state.deckName || entry.name || '',
        lines,
        lookup: found,
        declaredTier: entry.tier ?? declaredTier,
        importedAt: now(),
        sourceUrl: entry.url,
      });
      await save(deck, version);
      outcomes.push({ name: entry.name, status: 'imported' });
    } catch (error) {
      outcomes.push({ name: entry.name, status: 'failed', reason: error?.message || '' });
    }
  }
  onProgress?.(decks.length, decks.length);
  return outcomes;
}

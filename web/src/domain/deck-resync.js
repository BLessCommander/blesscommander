import { buildDeckFromImport, checkImport } from './deck-import.js';
import { parseDeckText } from './deck-parser.js';

/**
 * @typedef {{ name: string, qty: number }} VersionCard
 * @typedef {{ added: string[], removed: string[], changed: string[] }} CardDiff
 */

/**
 * Differenze tra due liste di carte: entrate, uscite e carte con quantità diversa.
 * @param {VersionCard[]} before
 * @param {VersionCard[]} after
 * @returns {CardDiff}
 */
export function diffCards(before, after) {
  const qty = (cards) => new Map(cards.map((c) => [c.name, c.qty]));
  const old = qty(before);
  const now = qty(after);
  return {
    added: [...now.keys()].filter((n) => !old.has(n)).sort(),
    removed: [...old.keys()].filter((n) => !now.has(n)).sort(),
    changed: [...now.keys()].filter((n) => old.has(n) && old.get(n) !== now.get(n)).sort(),
  };
}

const sameList = (a, b) =>
  a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

/**
 * Confronta il mazzo scaricato di nuovo con quello salvato e dice cosa fare.
 * - `same`: nessuna differenza, non si salva nulla;
 * - `review`: la lista scaricata non è completa (comandante mancante o carte non trovate);
 * - `update`: `deck` è il mazzo da salvare e `version` la nuova versione (`null` se le carte sono
 *   uguali e cambiano solo nome o comandanti).
 * @param {object} input
 * @param {any} input.deck mazzo salvato (con `source.url`)
 * @param {any} [input.current] ultima versione salvata
 * @param {{ deckName?: string, result: string }} input.fetched esito dell'Action `import`
 * @param {any} input.lookup dati Scryfall per le carte scaricate
 * @param {string} input.now
 */
export function planResync({ deck, current, fetched, lookup, now }) {
  const lines = parseDeckText(fetched.result);
  const check = checkImport(lines, lookup);
  if (!check.ok) return { status: 'review', reasons: check.reasons };

  const built = buildDeckFromImport({
    name: fetched.deckName || deck.name,
    lines,
    lookup,
    declaredTier: deck.declaredTier,
    importedAt: now,
    sourceUrl: deck.source?.url,
  });
  const diff = diffCards(current?.cards ?? [], built.version.cards);
  const cardsChanged = diff.added.length + diff.removed.length + diff.changed.length > 0;
  const deckChanged =
    built.deck.name !== deck.name ||
    !sameList(built.deck.commanders, deck.commanders ?? []) ||
    !sameList(built.deck.colorIdentity, deck.colorIdentity ?? []);
  if (!cardsChanged && !deckChanged) return { status: 'same' };

  return {
    status: 'update',
    deck: {
      ...deck,
      name: built.deck.name,
      commanders: built.deck.commanders,
      colorIdentity: built.deck.colorIdentity,
      source: built.deck.source,
    },
    version: cardsChanged
      ? { ...built.version, diff: { added: diff.added, removed: diff.removed } }
      : null,
    summary: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      renamed: built.deck.name !== deck.name,
    },
  };
}

import { cardKey } from '../platform/scryfall.js';
import { commanderNames, deckCards, mergeDuplicates } from './deck-parser.js';

/** @typedef {import('./deck-parser.js').DeckLine} DeckLine */
/** @typedef {import('../platform/scryfall.js').CardLookup} CardLookup */

/**
 * Esito del wizard di autovalutazione (C-07).
 * @typedef {{ floor: string, massLandDestruction: boolean, chainExtraTurns: boolean,
 *   combos: { id?: string, cards: string[], produces?: string[], manaValue: number }[] }} Assessment
 */

const COLORS = ['W', 'U', 'B', 'R', 'G'];

/**
 * Pronto per il salvataggio? Serve almeno un comandante e nessuna carta non trovata.
 * @param {DeckLine[]} lines
 * @param {CardLookup | null} lookup
 * @returns {{ ok: boolean, reasons: ('no-commander' | 'not-found' | 'empty')[] }}
 */
export function checkImport(lines, lookup) {
  const cards = deckCards(lines);
  const reasons = [];
  if (!cards.length) reasons.push('empty');
  else if (!commanderNames(lines).length) reasons.push('no-commander');
  if (lookup?.notFound.some((name) => cards.some((l) => cardKey(l.name) === cardKey(name)))) {
    reasons.push('not-found');
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Costruisce mazzo e prima versione dalla lista letta e dai dati Scryfall.
 * L'identità di colore è l'unione di quella di tutti i comandanti.
 * @param {{ name: string, lines: DeckLine[], lookup: CardLookup, declaredTier: string, importedAt: string, sourceUrl?: string, assessment?: Assessment }} input
 * `sourceUrl` è il link di Archidekt, se il mazzo viene da lì; `assessment` è l'esito del wizard.
 */
export function buildDeckFromImport({
  name,
  lines,
  lookup,
  declaredTier,
  importedAt,
  sourceUrl,
  assessment,
}) {
  const cards = mergeDuplicates(deckCards(lines));
  const commanders = commanderNames(lines);
  const info = (cardName) => lookup.cards[cardKey(cardName)];
  const identity = new Set(commanders.flatMap((c) => info(c)?.colorIdentity ?? []));

  const versionCards = cards.map((line) => {
    const card = info(line.name);
    return {
      name: card?.name ?? line.name,
      qty: line.qty,
      ...(card ? { scryfallId: card.scryfallId, isGameChanger: card.isGameChanger } : {}),
    };
  });

  return {
    deck: {
      name: name.trim(),
      commanders: commanders.map((c) => info(c)?.name ?? c),
      colorIdentity: COLORS.filter((c) => identity.has(c)),
      declaredTier,
      ...(assessment
        ? {
            selfAssessment: {
              mld: assessment.massLandDestruction,
              extraTurns: assessment.chainExtraTurns,
            },
          }
        : {}),
      source: sourceUrl
        ? { type: 'archidekt', url: sourceUrl, importedAt }
        : { type: 'text', importedAt },
    },
    version: {
      cards: versionCards,
      gameChangers: versionCards.filter((c) => c.isGameChanger).map((c) => c.name),
      diff: { added: versionCards.map((c) => c.name), removed: [] },
      ...(assessment
        ? {
            floor: assessment.floor,
            combos: assessment.combos,
            flags: { mld: assessment.massLandDestruction, extraTurns: assessment.chainExtraTurns },
          }
        : {}),
    },
  };
}

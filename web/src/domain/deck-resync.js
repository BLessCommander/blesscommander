import { tierId, tierNumber } from '@blesscommander/tier-engine';
import { buildDeckFromImport, checkImport } from './deck-import.js';
import { CHAIN_EXTRA_TURNS_FROM, deckFloor, wizardInput } from './deck-features.js';
import { commanderNames, deckCards, mergeDuplicates, parseDeckText } from './deck-parser.js';

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

const sameSalt = (a = {}, b = {}) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

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
 * @param {{ deckName?: string, result: string, salt?: Record<string, number> }} input.fetched esito dell'Action `import`
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
    salt: fetched.salt,
  });
  const diff = diffCards(current?.cards ?? [], built.version.cards);
  const cardsChanged = diff.added.length + diff.removed.length + diff.changed.length > 0;
  // Il salt si aggiorna anche se le carte sono le stesse (nei mazzi importati prima non c'era).
  const saltChanged = fetched.salt !== undefined && !sameSalt(built.deck.salt, deck.salt);
  const deckChanged =
    saltChanged ||
    built.deck.name !== deck.name ||
    !sameList(built.deck.commanders, deck.commanders ?? []) ||
    !sameList(built.deck.colorIdentity, deck.colorIdentity ?? []);
  if (!cardsChanged && !deckChanged) return { status: 'same' };

  return {
    status: 'update',
    cards: mergeDuplicates(deckCards(lines)),
    commanders: commanderNames(lines),
    deck: {
      ...deck,
      name: built.deck.name,
      commanders: built.deck.commanders,
      colorIdentity: built.deck.colorIdentity,
      source: built.deck.source,
      ...(built.deck.salt ? { salt: built.deck.salt } : {}),
    },
    version: cardsChanged
      ? { ...built.version, diff: { added: diff.added, removed: diff.removed } }
      : null,
    summary: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      renamed: built.deck.name !== deck.name,
      salt: saltChanged,
    },
  };
}

const sameSet = (a, b) => a.length === b.length && sameList(a, b);
const comboKeys = (combos) =>
  (combos ?? [])
    .filter((c) => c.cards?.length)
    .map((c) => [...c.cards].sort().join('+'))
    .sort();

/**
 * Dopo un aggiornamento che cambia le carte: ricontrolla game changer, combo e carte sospette.
 * - `needsWizard` è vero se qualcosa è cambiato (game changer, combo, carte sospette nuove), se le
 *   combo non si sono potute verificare o se la versione salvata non ha un pavimento (mazzi vecchi);
 * - altrimenti `assessment` è già pronto e l'aggiornamento si salva senza chiedere nulla.
 * Le risposte di prima (terre distrutte, turni extra) restano: si chiede solo per le carte nuove.
 * @param {object} input
 * @param {any} input.deck mazzo salvato
 * @param {any} [input.current] ultima versione salvata
 * @param {{ cards: { name: string, qty: number }[] }} input.plan esito di `planResync` (`update`)
 * @param {any} input.lookup dati Scryfall delle carte scaricate
 * @param {any[] | null} input.combos combo infinite; `null` se Spellbook non ha risposto
 */
export function planRecheck({ deck, current, plan, lookup, combos }) {
  const { gameChangers, suspects } = wizardInput(plan.cards, lookup);
  const before = new Set((current?.cards ?? []).map((c) => c.name));
  const fresh = (names) => names.filter((n) => !before.has(n));
  const newMassLand = fresh(suspects.massLand);
  const newExtraTurns = fresh(suspects.extraTurns);

  const prev = deck.selfAssessment ?? {};
  const massLand =
    prev.mld === undefined ? suspects.massLand.length > 0 : prev.mld || newMassLand.length > 0;
  const chainExtraTurns =
    prev.extraTurns === undefined
      ? suspects.extraTurns.length >= CHAIN_EXTRA_TURNS_FROM
      : prev.extraTurns ||
        (newExtraTurns.length > 0 && suspects.extraTurns.length >= CHAIN_EXTRA_TURNS_FROM);

  const manual = (current?.combos ?? []).filter((c) => !c.cards?.length);
  const usedCombos = combos ?? manual;
  const floor = deckFloor({
    gameChangers: gameChangers.length,
    massLandDestruction: massLand,
    chainExtraTurns,
    combos: usedCombos,
  });
  const needsWizard =
    current?.floor === undefined ||
    combos === null ||
    !sameSet(gameChangers, current.gameChangers ?? []) ||
    !sameSet(comboKeys(combos), comboKeys(current.combos)) ||
    newMassLand.length > 0 ||
    newExtraTurns.length > 0;
  const declaredTier = tierId(Math.max(tierNumber(deck.declaredTier), tierNumber(floor)));

  return {
    needsWizard,
    input: { gameChangers, suspects, combos },
    defaults: { massLand, chainExtraTurns, declaredTier },
    assessment: { floor, massLandDestruction: massLand, chainExtraTurns, combos: usedCombos },
    declaredTier,
  };
}

/**
 * Versione da salvare con l'esito del controllo (pavimento, combo, segnalazioni).
 * @param {any} version versione di `planResync`
 * @param {{ floor: string, massLandDestruction: boolean, chainExtraTurns: boolean, combos: any[] }} assessment
 */
export const withAssessment = (version, assessment) => ({
  ...version,
  floor: assessment.floor,
  combos: assessment.combos,
  flags: { mld: assessment.massLandDestruction, extraTurns: assessment.chainExtraTurns },
});

// Diagnosi in SOLA LETTURA di un mazzo Archidekt sul repository dati vero: scarica il mazzo da Archidekt,
// lo confronta con la versione salvata e dice cosa farebbe «Aggiorna da Archidekt» (wizard sì/no, perché).
// Non scrive nulla. Usa `gh` già collegato al tuo account (nessun token da incollare).
// Uso: npm run live:diagnose -- <link Archidekt> [Carta1] [Carta2] ...   (le carte sono quelle da controllare)
import { execFileSync } from 'node:child_process';
import { archidektToText } from '../../web/src/domain/archidekt-import.js';
import { archidektDeckId } from '../../web/src/domain/archidekt-link.js';
import { findDeckCombos } from '../../web/src/domain/deck-features.js';
import { planRecheck, planResync } from '../../web/src/domain/deck-resync.js';
import {
  commanderNames,
  deckCards,
  mergeDuplicates,
  parseDeckText,
} from '../../web/src/domain/deck-parser.js';
import { cardKey, createScryfall } from '../../web/src/platform/scryfall.js';
import { createSpellbook } from '../../web/src/platform/spellbook.js';

const REPO = 'BLessCommander/blesscommander-data';
const [url, ...watch] = process.argv.slice(2);
const id = archidektDeckId(url ?? '');
if (!id) {
  console.error('Uso: npm run live:diagnose -- <link Archidekt> [Carta1] [Carta2] ...');
  process.exit(1);
}

const gh = (path) => {
  try {
    return JSON.parse(
      Buffer.from(
        JSON.parse(
          execFileSync('gh', ['api', `repos/${REPO}/contents/${path}`], { encoding: 'utf8' }),
        ).content,
        'base64',
      ).toString('utf8'),
    );
  } catch {
    return null;
  }
};

const archidekt = await (
  await fetch(`https://archidekt.com/api/decks/${id}/`, { headers: { accept: 'application/json' } })
).json();
const { name, text } = archidektToText(archidekt);
const lines = parseDeckText(text);
const cards = mergeDuplicates(deckCards(lines));
const inDeck = new Set(cards.map((c) => cardKey(c.name)));
const leftOut = lines.filter((l) => l.section === 'side');
console.log(`Mazzo Archidekt «${name}»: ${cards.reduce((n, c) => n + c.qty, 0)} carte nella lista`);
console.log(`Comandanti: ${commanderNames(lines).join(', ') || '(nessuno)'}`);
console.log(`Lasciate fuori (Maybeboard/Sideboard o categoria esclusa): ${leftOut.length}`);
for (const card of watch) {
  const where = inDeck.has(cardKey(card))
    ? 'NELLA LISTA'
    : leftOut.some((l) => cardKey(l.name) === cardKey(card))
      ? 'LASCIATA FUORI (Maybeboard/Sideboard)'
      : 'ASSENTE';
  console.log(`  ${card}: ${where}`);
}

// Fuori dal browser Scryfall vuole un nome del programma nell'intestazione.
const scryfall = createScryfall({
  fetchImpl: (url, init) =>
    fetch(url, {
      ...init,
      headers: { ...init?.headers, 'User-Agent': 'BLessCommander-diagnose/1.0' },
    }),
});
const lookup = await scryfall.lookup(cards.map((c) => c.name));
const combos = await findDeckCombos({
  commanders: commanderNames(lines),
  cards,
  lookup,
  request: async (json) => ({ combos: await createSpellbook().findCombos(JSON.parse(json)) }),
});
console.log(
  `\nCombo infinite trovate da Commander Spellbook: ${combos === null ? 'NON RAGGIUNGIBILE' : combos.length}`,
);
for (const c of combos ?? [])
  console.log(`  ${c.cards.join(' + ')} → ${c.produces.join(', ')} (mana ${c.manaValue})`);

const savedIds = JSON.parse(
  execFileSync('gh', ['api', `repos/${REPO}/contents/decks`], { encoding: 'utf8' }),
)
  .filter((f) => f.type === 'file')
  .map((f) => f.name.replace(/\.json$/, ''));
let saved = null;
let deckFile = null;
for (const deckId of savedIds) {
  const file = gh(`decks/${deckId}.json`);
  if (file?.source?.url?.includes(`/decks/${id}`)) {
    saved = { id: deckId };
    deckFile = file;
  }
}
if (!deckFile) {
  console.log(
    '\nQuesto mazzo non è salvato nel repository dati: niente confronto con una versione salvata.',
  );
  process.exit(0);
}
const current = gh(`decks/${saved.id}/v${deckFile.currentVersion}.json`);
console.log(
  `\nMazzo salvato «${deckFile.name}», versione ${deckFile.currentVersion}: pavimento ${current?.floor ?? '(nessuno)'}, combo salvate ${current?.combos?.length ?? 0}`,
);
const deck = { ...deckFile, id: saved.id };
const plan = planResync({
  deck,
  current,
  fetched: { deckName: name, result: text },
  lookup,
  now: new Date().toISOString(),
});
console.log(`Aggiorna da Archidekt: esito «${plan.status}»`);
if (plan.status === 'update' && plan.version) {
  const recheck = planRecheck({ deck, current, plan, lookup, combos });
  console.log(`Il wizard di ricontrollo si aprirebbe: ${recheck.needsWizard ? 'SÌ' : 'NO'}`);
  console.log(
    `  pavimento calcolato: ${recheck.assessment.floor}; combo contate: ${recheck.assessment.combos.length}`,
  );
  console.log(
    `  carte aggiunte: ${plan.version.diff.added.join(', ') || '-'}; tolte: ${plan.version.diff.removed.join(', ') || '-'}`,
  );
} else if (plan.status === 'same') {
  console.log(
    'Nessuna differenza tra Archidekt e il mazzo salvato: non c’è nulla da ricontrollare.',
  );
}

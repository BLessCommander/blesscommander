/**
 * @typedef {{ name: string, qty: number, section: 'main' | 'commander' | 'side', set?: string, collector?: string }} DeckLine
 */

const SECTIONS = {
  commander: 'commander',
  commanders: 'commander',
  companion: 'side',
  deck: 'main',
  mainboard: 'main',
  main: 'main',
  sideboard: 'side',
  maybeboard: 'side',
  maybe: 'side',
};

// "1 Sol Ring", "1x Sol Ring (CMD) 123 *F*", "SB: 1 Sol Ring"
const LINE = /^(?:(SB):\s*)?(?:(\d+)\s*x?\s+)?(.+?)\s*$/i;
const SET_SUFFIX =
  /\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([A-Za-z0-9-★]+))?(?:\s+\*[A-Za-z]+\*)?(?:\s+\[.*\])*$/;

const sectionOf = (line) => {
  const label = line
    .replace(/[:\s]+$/, '')
    .replace(/\s*\(\d+\)$/, '')
    .toLowerCase();
  return SECTIONS[label];
};

/**
 * Legge una lista mazzo incollata (Archidekt, Moxfield, MTG Arena, testo semplice).
 * Le intestazioni "Commander", "Sideboard", "Maybeboard" cambiano sezione; le righe `// ...` sono commenti.
 * Le sezioni sideboard/maybeboard sono lette ma non fanno parte del mazzo.
 * @param {string} text
 * @returns {DeckLine[]}
 */
export function parseDeckText(text) {
  /** @type {DeckLine[]} */
  const lines = [];
  let section = 'main';
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    const heading = sectionOf(line);
    if (heading) {
      section = heading;
      continue;
    }
    const match = LINE.exec(line);
    if (!match) continue;
    let name = match[3];
    let set;
    let collector;
    const suffix = SET_SUFFIX.exec(name);
    if (suffix) {
      name = name.slice(0, suffix.index);
      set = suffix[1].toLowerCase();
      collector = suffix[2];
    }
    // I nomi delle carte doppie si leggono per intero ("A // B"): Scryfall li accetta.
    name = name.replace(/\s+/g, ' ').trim();
    if (!name) continue;
    lines.push({
      name,
      qty: match[2] ? Number(match[2]) : 1,
      section: match[1] ? 'side' : section,
      ...(set ? { set } : {}),
      ...(collector ? { collector } : {}),
    });
  }
  return lines;
}

/**
 * Unisce le righe con lo stesso nome (somma le quantità); tiene la sezione della prima.
 * @param {DeckLine[]} lines
 * @returns {DeckLine[]}
 */
export function mergeDuplicates(lines) {
  const byKey = new Map();
  for (const line of lines) {
    const key = `${line.section}|${line.name.toLowerCase()}`;
    const found = byKey.get(key);
    if (found) found.qty += line.qty;
    else byKey.set(key, { ...line });
  }
  return [...byKey.values()];
}

/**
 * Carte del mazzo (comandanti inclusi), senza sideboard e maybeboard.
 * @param {DeckLine[]} lines
 */
export const deckCards = (lines) => lines.filter((l) => l.section !== 'side');

/**
 * Cambia lo stato "comandante" di una carta. Una carta comandante torna nel mazzo; una carta del
 * mazzo diventa comandante (qualsiasi numero: partner, background, ecc.) con quantità 1.
 * @param {DeckLine[]} lines
 * @param {string} name
 * @returns {DeckLine[]}
 */
export function toggleCommander(lines, name) {
  return lines.map((l) =>
    l.name === name && l.section !== 'side'
      ? { ...l, section: l.section === 'commander' ? 'main' : 'commander' }
      : l,
  );
}

/** Nomi dei comandanti. @param {DeckLine[]} lines */
export const commanderNames = (lines) =>
  lines.filter((l) => l.section === 'commander').map((l) => l.name);

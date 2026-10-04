// Mazzi finti del repository di prova: ogni giocatore finto ha una copia dello stesso mazzo con Sanar.
// Servono solo per provare lobby e partite dal vivo; non sono mazzi veri di nessuno.

export const SANAR_COMMANDER = 'Sanar, Innovative First-Year';

const SPELLS = [
  'Sol Ring',
  'Arcane Signet',
  'Izzet Signet',
  'Talisman of Creativity',
  'Thought Vessel',
  'Mind Stone',
  'Fellwar Stone',
  'Command Tower',
  'Steam Vents',
  'Shivan Reef',
  'Izzet Boilerworks',
  'Izzet Guildgate',
  'Mystic Sanctuary',
  'Evolving Wilds',
  'Terramorphic Expanse',
  'Rhystic Study',
  'Mystic Remora',
  'Brainstorm',
  'Ponder',
  'Preordain',
  'Opt',
  'Counterspell',
  'Negate',
  'Swan Song',
  'Mana Drain',
  'Cyclonic Rift',
  'Lightning Bolt',
  'Chain Lightning',
  'Fire // Ice',
  'Arcane Denial',
  'Frantic Search',
  'Faithless Looting',
  'Wheel of Fortune',
  'Windfall',
  'Fact or Fiction',
  'Treasure Cruise',
  'Dig Through Time',
  'Expressive Iteration',
  'Young Pyromancer',
  'Talrand, Sky Summoner',
  'Niv-Mizzet, Parun',
  'Archmage Emeritus',
  'Magecraft Mentor',
  'Thing in the Ice',
  'Murmuring Mystic',
  'Storm-Kiln Artist',
  'Jeskai Ascendancy',
  'Guttersnipe',
  'Beast Within',
  'Blasphemous Act',
  'Fiery Confluence',
  'Pyroclasm',
  'Reverberate',
  'Chaos Warp',
  'Vandalblast',
  'Tormenting Voice',
  'Thrill of Possibility',
  'Magma Opus',
  'Sphinx’s Revelation',
  'Mizzix’s Mastery',
  'Time Warp',
];

const BASICS = [
  ['Island', 20],
  ['Mountain', 18],
];

/** Elenco carte del mazzo: 1 comandante + 99 tra magie e terre (qty per carta). */
export function sanarDeckCards() {
  const cards = [
    ...SPELLS.map((name) => ({ name, qty: 1 })),
    ...BASICS.map(([name, qty]) => ({ name, qty })),
  ];
  return cards;
}

/**
 * File del mazzo e della versione 1 per un giocatore finto.
 * @param {string} ownerLogin
 * @param {number} n numero progressivo (1..8)
 */
export function sanarDeckFiles(ownerLogin, n) {
  const deck = {
    ownerLogin,
    name: `Sanar di prova ${n}`,
    commanders: [SANAR_COMMANDER],
    colorIdentity: ['U', 'R'],
    source: { type: 'text', url: '', importedAt: '2026-10-04' },
    currentVersion: 1,
    declaredTier: 'F2',
    selfAssessment: { mld: false, extraTurns: false, notes: 'Mazzo finto per le prove.' },
  };
  const version = {
    version: 1,
    cards: sanarDeckCards(),
    gameChangers: [],
    combos: [],
    flags: { mld: false, extraTurns: false },
    floor: 'F2',
  };
  return { deck, version };
}

/** Identificativo (ULID valido) fisso del mazzo n, così rilanciare lo script non crea doppioni. */
export const testDeckId = (n) => `01DMTEST${String(n).padStart(18, '0')}`.slice(0, 26);

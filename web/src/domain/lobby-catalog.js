// Catalogo delle modalità che la lobby mostrerà. Per ora il motore delle fasce calcola solo il
// Commander classico a 3 e 4 giocatori: tutto il resto è visibile ma inibito (`enabled: false`).
// Per accendere una voce basta metterla a `true` quando il motore la supporta. Nomi e note stanno in `it.js`.

/** @typedef {{ id: string, enabled: boolean, group?: 'table' | 'roles' }} CatalogEntry */

/** Modalità di tavolo e ruoli nascosti (gli `id` che esistono nel motore sono quelli di `DEFAULT_FORMATS`). @type {CatalogEntry[]} */
export const TABLE_MODES = [
  { id: 'ffa4', enabled: true, group: 'table' },
  { id: 'ffa3', enabled: true, group: 'table' },
  { id: 'ffa56', enabled: false, group: 'table' },
  { id: '1v1', enabled: false, group: 'table' },
  { id: '2v2', enabled: false, group: 'table' },
  { id: '3v3', enabled: false, group: 'table' },
  { id: 'emperor', enabled: false, group: 'table' },
  { id: 'star', enabled: false, group: 'table' },
  { id: 'grand-melee', enabled: false, group: 'table' },
  { id: 'treachery', enabled: false, group: 'roles' },
  { id: 'kingdoms', enabled: false, group: 'roles' },
];

/** Varianti di costruzione del mazzo. @type {CatalogEntry[]} */
export const DECK_BUILDING = [
  { id: 'commander', enabled: true },
  ...[
    'cedh',
    'duel',
    'pauper',
    'pauper-edh',
    'peasant',
    'oathbreaker',
    'brawl',
    'historic-brawl',
    'tiny-leaders',
    'predh',
    'vanguard',
    'draft',
    'sealed',
    'cube',
    'un',
  ].map((id) => ({ id, enabled: false })),
];

/** Carte, mini-giochi e opzioni di tavolo aggiuntivi (caselle da spuntare). @type {CatalogEntry[]} */
export const TABLE_OPTIONS = [
  'archenemy',
  'planechase',
  'bounty',
  'monarch',
  'initiative',
  'influence-range',
  'attack-neighbour',
].map((id) => ({ id, enabled: false }));

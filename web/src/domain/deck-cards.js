// Carte di un mazzo: unione con i dati di Scryfall, raggruppamento, ordine e filtro per la scheda
// mazzo (C-08c). Funzioni pure.

/** @typedef {import('../platform/scryfall.js').CardInfo} CardInfo */
/**
 * @typedef {{ name: string, qty: number, scryfallId?: string, isGameChanger?: boolean }} DeckCard
 * @typedef {DeckCard & { known: boolean, cmc: number, typeLine: string, colors: string[],
 *   manaCost: string, type: string }} DetailedCard
 * @typedef {{ key: string, count: number, cards: DetailedCard[] }} CardGroup
 */

export const GROUP_BY = ['type', 'cmc', 'color'];
export const SORT_BY = ['name', 'cmc'];

/** Tipo principale, in ordine di precedenza: una terra-creatura è una terra. */
const TYPE_ORDER = [
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Land',
];
const TYPE_PRIORITY = [
  'Land',
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
];
export const UNKNOWN = 'unknown';
const GROUP_ORDER = {
  type: [...TYPE_ORDER, 'Other', UNKNOWN],
  cmc: ['0', '1', '2', '3', '4', '5', '6', '7', UNKNOWN],
  color: ['W', 'U', 'B', 'R', 'G', 'M', 'C', UNKNOWN],
};

/** Tipo principale dalla riga tipo; per le carte a più facce conta la prima. @param {string} typeLine */
export function primaryType(typeLine) {
  const front = String(typeLine).split('//')[0];
  return TYPE_PRIORITY.find((type) => front.includes(type)) ?? 'Other';
}

/** `W U B R G`, `M` (due o più colori) oppure `C` (incolore). @param {string[]} colors */
export function colorGroup(colors) {
  if (colors.length === 0) return 'C';
  return colors.length === 1 ? colors[0] : 'M';
}

/**
 * Unisce le carte salvate nel mazzo ai dati di Scryfall; senza dati la carta resta "sconosciuta".
 * @param {DeckCard[]} cards
 * @param {Record<string, CardInfo>} info per id Scryfall
 * @returns {DetailedCard[]}
 */
export function detailCards(cards, info) {
  return cards.map((card) => {
    const data = card.scryfallId ? info[card.scryfallId] : undefined;
    return {
      ...card,
      known: Boolean(data),
      cmc: data?.cmc ?? 0,
      typeLine: data?.typeLine ?? '',
      colors: data?.colors ?? [],
      manaCost: data?.manaCost ?? '',
      type: data ? primaryType(data.typeLine) : UNKNOWN,
    };
  });
}

/** Nome della prima faccia, senza accenti né maiuscole: per confrontare nomi di fonti diverse. */
const frontKey = (name) => normalize(String(name).split('//')[0].trim());

/**
 * Combo del mazzo a cui partecipa una carta.
 * @param {string} name
 * @param {{ cards?: string[], produces?: string[] }[]} combos
 * @returns {{ cards: string[], produces: string[] }[]}
 */
export function combosOfCard(name, combos) {
  const key = frontKey(name);
  return (combos ?? [])
    .filter((c) => Array.isArray(c?.cards) && c.cards.some((n) => frontKey(n) === key))
    .map((c) => ({ cards: c.cards, produces: c.produces ?? [] }));
}

/** @param {DetailedCard} card @param {string} groupBy */
function keyOf(card, groupBy) {
  if (!card.known) return UNKNOWN;
  if (groupBy === 'cmc') return String(Math.min(Math.floor(card.cmc), 7));
  if (groupBy === 'color') return colorGroup(card.colors);
  return card.type;
}

const normalize = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Filtra per nome, ordina e raggruppa. I gruppi vuoti non compaiono; l'ordine dei gruppi è fisso.
 * @param {DetailedCard[]} cards
 * @param {{ groupBy?: string, sortBy?: string, desc?: boolean, query?: string }} [options]
 * @returns {CardGroup[]}
 */
export function groupCards(
  cards,
  { groupBy = 'type', sortBy = 'name', desc = false, query = '' } = {},
) {
  const needle = normalize(query.trim());
  const shown = needle ? cards.filter((card) => normalize(card.name).includes(needle)) : cards;
  const byName = (a, b) => a.name.localeCompare(b.name, 'it');
  const compare = sortBy === 'cmc' ? (a, b) => a.cmc - b.cmc || byName(a, b) : byName;
  const sorted = [...shown].sort(desc ? (a, b) => compare(b, a) : compare);

  /** @type {Map<string, DetailedCard[]>} */
  const buckets = new Map();
  for (const card of sorted) {
    const key = keyOf(card, groupBy);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(card);
  }
  const order = GROUP_ORDER[groupBy] ?? GROUP_ORDER.type;
  return order
    .filter((key) => buckets.has(key))
    .map((key) => {
      const group = buckets.get(key);
      return { key, count: group.reduce((sum, card) => sum + (card.qty ?? 1), 0), cards: group };
    });
}

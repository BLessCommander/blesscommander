export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;

/**
 * Pulisce un tag scritto a mano: spazi multipli ridotti a uno, niente spazi ai bordi.
 * @param {string} raw
 */
export function cleanTag(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

const sameTag = (a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }) === 0;

/**
 * Aggiunge un tag all'elenco. Esito `ok` oppure il motivo del rifiuto.
 * @param {string[] | undefined} tags
 * @param {string} raw
 * @returns {{ ok: true, tags: string[] } | { ok: false, reason: 'empty' | 'too-long' | 'duplicate' | 'too-many' }}
 */
export function addTag(tags, raw) {
  const current = tags ?? [];
  const tag = cleanTag(raw);
  if (!tag) return { ok: false, reason: 'empty' };
  if (tag.length > MAX_TAG_LENGTH) return { ok: false, reason: 'too-long' };
  if (current.some((x) => sameTag(x, tag))) return { ok: false, reason: 'duplicate' };
  if (current.length >= MAX_TAGS) return { ok: false, reason: 'too-many' };
  return { ok: true, tags: [...current, tag] };
}

/**
 * @param {string[] | undefined} tags
 * @param {string} tag
 */
export function removeTag(tags, tag) {
  return (tags ?? []).filter((x) => x !== tag);
}

/**
 * Tag usati dai mazzi, senza doppioni e in ordine alfabetico, con il numero di mazzi che li hanno.
 * @param {{ tags?: string[] }[]} decks
 * @returns {{ tag: string, count: number }[]}
 */
export function usedTags(decks) {
  /** @type {Map<string, { tag: string, count: number }>} */
  const found = new Map();
  for (const deck of decks) {
    for (const tag of deck.tags ?? []) {
      const key = tag.toLocaleLowerCase('it');
      const entry = found.get(key) ?? { tag, count: 0 };
      entry.count += 1;
      found.set(key, entry);
    }
  }
  return [...found.values()].sort((a, b) => a.tag.localeCompare(b.tag, 'it'));
}

/**
 * Tiene in ogni gruppo solo i mazzi con il tag; i gruppi rimasti vuoti spariscono.
 * @template {{ decks: { tags?: string[] }[] }} G
 * @param {G[]} groups
 * @param {string} tag `all` oppure il tag
 * @returns {G[]}
 */
export function filterGroupsByTag(groups, tag) {
  if (tag === 'all') return groups;
  return groups
    .map((g) => ({
      ...g,
      decks: g.decks.filter((d) => (d.tags ?? []).some((x) => sameTag(x, tag))),
    }))
    .filter((g) => g.decks.length > 0);
}

// Dati delle carte da Scryfall (SPEC §4.2). Unico punto dell'app che parla con api.scryfall.com.
// Le richieste sono a blocchi da 75 nomi (endpoint /cards/collection) con una pausa tra un blocco e l'altro,
// come chiede Scryfall. I test intercettano le richieste (tests/fixtures/scryfall-fake.js): nessuna rete vera.
//
// Verificato sull'API vera: /cards/collection NON riconosce il nome completo delle carte a più facce
// ("Fire // Ice", "Esika, God of the Tree // The Prismatic Bridge") ma solo quello della prima faccia, e
// restituisce poi la carta col nome completo. Per questo si cerca sempre per prima faccia e si abbina
// il risultato ignorando accenti, apostrofi tipografici e maiuscole.

/**
 * @typedef {{ name: string, scryfallId: string, manaCost: string, cmc: number, colorIdentity: string[],
 *   typeLine: string, image: string | null, isGameChanger: boolean }} CardInfo
 * @typedef {{ cards: Record<string, CardInfo>, notFound: string[] }} CardLookup  chiavi: `cardKey` del nome richiesto
 * @typedef {{ lookup: (names: string[]) => Promise<CardLookup> }} Scryfall
 */

const API = 'https://api.scryfall.com';
const CHUNK = 75;
const PAUSE_MS = 100;

// "A // B", "A / B" (alcuni export) e "A /// B" (Arena): separano le facce di una carta.
const FACE_SEPARATOR = /\s+\/{1,3}\s+/;
// Carte Alchemy riequilibrate: su Scryfall esiste solo la carta originale.
const ALCHEMY_PREFIX = /^a-(?=\S)/i;

/** Chiave dei nomi nell'elenco restituito: minuscolo, spazi singoli. @param {string} name */
export const cardKey = (name) => name.toLowerCase().replace(/\s+/g, ' ').trim();

/** Chiave di confronto: senza accenti, "æ" come "ae", apostrofi tipografici dritti. @param {string} name */
export const matchKey = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Nome della prima faccia: è quello che Scryfall riconosce. @param {string} name */
export const queryName = (name) => name.split(FACE_SEPARATOR)[0].trim();

/** @template T @param {T[]} items @param {number} size */
export function chunk(items, size = CHUNK) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Riduce una carta di Scryfall ai campi che servono all'app.
 * @param {any} raw
 * @returns {CardInfo}
 */
export function normalizeCard(raw) {
  const face = raw.card_faces?.[0];
  return {
    name: raw.name,
    scryfallId: raw.id,
    manaCost: raw.mana_cost ?? face?.mana_cost ?? '',
    cmc: raw.cmc ?? 0,
    colorIdentity: raw.color_identity ?? [],
    typeLine: raw.type_line ?? face?.type_line ?? '',
    image: raw.image_uris?.small ?? face?.image_uris?.small ?? null,
    isGameChanger: raw.game_changer === true,
  };
}

/**
 * Abbina le carte ricevute ai nomi richiesti: nome intero, solo prima faccia o altra faccia,
 * con o senza accenti, con o senza il prefisso "A-" delle carte Alchemy.
 * @param {string[]} requested
 * @param {any[]} data
 * @returns {CardLookup}
 */
export function matchCards(requested, data) {
  const byName = new Map();
  for (const raw of data) {
    const names = [
      raw.name,
      ...raw.name.split(FACE_SEPARATOR),
      ...(raw.card_faces ?? []).map((f) => f.name),
    ];
    for (const name of names) if (name) byName.set(matchKey(name), raw);
  }
  /** @type {CardLookup} */
  const result = { cards: {}, notFound: [] };
  for (const name of requested) {
    const front = queryName(name);
    const raw =
      byName.get(matchKey(name)) ??
      byName.get(matchKey(front)) ??
      byName.get(matchKey(front.replace(ALCHEMY_PREFIX, '')));
    if (raw) result.cards[cardKey(name)] = normalizeCard(raw);
    else result.notFound.push(name);
  }
  return result;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scryfall vera. `fetchImpl` e `pauseMs` si possono cambiare nei test.
 * @param {{ fetchImpl?: typeof fetch, pauseMs?: number }} [options]
 * @returns {Scryfall}
 */
export function createScryfall({
  fetchImpl = (...args) => fetch(...args),
  pauseMs = PAUSE_MS,
} = {}) {
  /** @param {string[]} queries nomi di prima faccia @returns {Promise<any[]>} */
  async function fetchCards(queries) {
    const unique = [...new Map(queries.map((q) => [matchKey(q), q])).values()];
    /** @type {any[]} */
    const data = [];
    for (const [index, block] of chunk(unique).entries()) {
      if (index > 0) await sleep(pauseMs);
      const response = await fetchImpl(`${API}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ identifiers: block.map((name) => ({ name })) }),
      });
      if (!response.ok) throw new Error(`Scryfall: risposta ${response.status}`);
      data.push(...((await response.json()).data ?? []));
    }
    return data;
  }

  return {
    async lookup(names) {
      const unique = [...new Map(names.map((n) => [cardKey(n), n])).values()];
      const data = await fetchCards(unique.map(queryName));
      let result = matchCards(unique, data);
      const alchemy = result.notFound.filter((n) => ALCHEMY_PREFIX.test(queryName(n)));
      if (alchemy.length) {
        await sleep(pauseMs);
        const stripped = alchemy.map((n) => queryName(n).replace(ALCHEMY_PREFIX, ''));
        data.push(...(await fetchCards(stripped)));
        result = matchCards(unique, data);
      }
      return result;
    },
  };
}

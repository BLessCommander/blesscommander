// Scarico dei mazzi da Archidekt e conversione in testo con sezioni. Funzioni pure rispetto
// all'ambiente (la rete si passa da fuori): le usano l'Action `import` e, in sviluppo con dati
// veri, il MockProvider tramite il ponte locale di Vite (il browser da solo non può: CORS).
import { archidektDeckId } from './archidekt-link.js';

export const ARCHIDEKT_API = 'https://archidekt.com/api/decks';

const USERNAME = /^[A-Za-z0-9_.-]{2,40}$/;
const PAGE_SIZE = 50;
const MAX_PAGES = 4;
const HEADERS = { accept: 'application/json' };

/**
 * Converte la risposta di Archidekt in testo con le sezioni Commander / Deck / Sideboard (le
 * intestazioni che il parser dell'app conosce). Le categorie fuori dal mazzo finiscono in Sideboard.
 * @returns {{ name: string, text: string }}
 */
export function archidektToText(json) {
  const outside = new Set(
    (json.categories ?? []).filter((c) => c.includedInDeck === false).map((c) => c.name),
  );
  const sections = { Commander: [], Deck: [], Sideboard: [] };
  for (const entry of json.cards ?? []) {
    const name = entry.card?.oracleCard?.name;
    if (!name || entry.deletedAt) continue;
    const categories = entry.categories ?? [];
    const section = categories.includes('Commander')
      ? 'Commander'
      : categories.some((c) => outside.has(c))
        ? 'Sideboard'
        : 'Deck';
    sections[section].push(`${entry.quantity ?? 1} ${name}`);
  }
  const text = Object.entries(sections)
    .filter(([, rows]) => rows.length)
    .map(([title, rows]) => `${title}\n${rows.join('\n')}`)
    .join('\n\n');
  return { name: String(json.name ?? '').trim(), text };
}

/**
 * Scarica un mazzo pubblico.
 * @param {{ url: string, fetchImpl: typeof fetch, base?: string }} input
 * @returns {Promise<{ deckName: string, result: string } | { error: string }>}
 */
export async function downloadDeck({ url, fetchImpl, base = ARCHIDEKT_API }) {
  const id = archidektDeckId(url);
  if (!id) return { error: 'Il link non è un mazzo di Archidekt' };
  try {
    const response = await fetchImpl(`${base}/${id}/`, { headers: HEADERS });
    if (response.status === 403 || response.status === 404) {
      return { error: 'Mazzo non trovato o privato: rendilo pubblico su Archidekt' };
    }
    if (!response.ok) return { error: `Archidekt ha risposto con errore ${response.status}` };
    const { name, text } = archidektToText(await response.json());
    return text ? { deckName: name, result: text } : { error: 'Il mazzo è vuoto' };
  } catch {
    return { error: 'Archidekt non risponde: riprova tra poco' };
  }
}

/**
 * Elenco dei mazzi pubblici di un utente: [{ id, name, size, url }]. I privati non si mostrano.
 * @param {{ nick: string, fetchImpl: typeof fetch, base?: string }} input
 * @returns {Promise<{ decks: object[] } | { error: string }>}
 */
export async function downloadUserDecks({ nick, fetchImpl, base = ARCHIDEKT_API }) {
  const name = String(nick ?? '').trim();
  if (!USERNAME.test(name)) return { error: 'Il nome utente non è valido' };
  try {
    const decks = [];
    let next = `${base}/v3/?ownerUsername=${encodeURIComponent(name)}&pageSize=${PAGE_SIZE}`;
    for (let page = 0; next && page < MAX_PAGES; page++) {
      const response = await fetchImpl(next, { headers: HEADERS });
      if (response.status === 404) return { error: 'Utente non trovato su Archidekt' };
      if (!response.ok) return { error: `Archidekt ha risposto con errore ${response.status}` };
      const body = await response.json();
      for (const deck of body.results ?? []) {
        if (deck.private) continue;
        decks.push({
          id: String(deck.id),
          name: String(deck.name ?? '').trim() || `Mazzo ${deck.id}`,
          size: deck.size ?? 0,
          url: `https://archidekt.com/decks/${deck.id}`,
        });
      }
      // La pagina successiva si segue solo se resta su Archidekt.
      next =
        typeof body.next === 'string' && body.next.startsWith(ARCHIDEKT_API)
          ? base + body.next.slice(ARCHIDEKT_API.length)
          : null;
    }
    return decks.length ? { decks } : { error: 'Nessun mazzo pubblico trovato per questo utente' };
  } catch {
    return { error: 'Archidekt non risponde: riprova tra poco' };
  }
}

const ARCHIDEKT_URL =
  /^https?:\/\/(?:www\.)?archidekt\.com\/(?:decks|api\/decks)\/(\d+)(?:[/?#]|$)/i;

/** @returns {string|null} l'id numerico del mazzo, se il link è di Archidekt (lo usa anche l'Action `import`) */
export function archidektDeckId(url) {
  return ARCHIDEKT_URL.exec(String(url ?? '').trim())?.[1] ?? null;
}

// Indirizzi delle immagini delle carte (Scryfall, SPEC §6.9). L'indirizzo si ricava dall'id della
// carta: nessuna chiamata all'API. Il browser scarica ogni immagine una volta sola (Scryfall le
// serve con intestazioni di cache lunghe) e <img loading="lazy"> evita quelle non visibili.

const CDN = 'https://cards.scryfall.io';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `small` 146×204 per le liste, `normal` 488×680 per il dettaglio. */
export const IMAGE_SIZES = {
  small: { width: 146, height: 204 },
  normal: { width: 488, height: 680 },
};

/**
 * @param {string | null | undefined} scryfallId
 * @param {{ version?: 'small' | 'normal', face?: 'front' | 'back' }} [options]
 * @returns {string | null} `null` se l'id non è un id Scryfall valido
 */
export function cardImageUrl(scryfallId, { version = 'small', face = 'front' } = {}) {
  const id = String(scryfallId ?? '').toLowerCase();
  if (!UUID.test(id)) return null;
  return `${CDN}/${version}/${face}/${id[0]}/${id[1]}/${id}.jpg`;
}

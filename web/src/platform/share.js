// Condivisione (SPEC §6.9).

/** @returns {boolean} */
export function canShare() {
  return typeof globalThis.navigator?.share === 'function';
}

/**
 * @param {{ title?: string, text?: string, url?: string }} content
 * @returns {Promise<boolean>} false se la condivisione non è disponibile o è stata annullata
 */
export async function share(content) {
  if (!canShare()) return false;
  try {
    await globalThis.navigator.share(content);
    return true;
  } catch {
    return false;
  }
}

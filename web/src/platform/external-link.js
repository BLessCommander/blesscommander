// Apertura di link esterni (SPEC §6.9): sempre in una nuova scheda, senza dare accesso alla pagina.

/** @param {string} url */
export function openExternal(url) {
  globalThis.open?.(url, '_blank', 'noopener,noreferrer');
}

// Larghezza della finestra (SPEC §6.9): per scegliere la disposizione quando il solo CSS non basta.

/**
 * @param {number} minWidth larghezza in px da cui lo schermo conta come "largo"
 * @param {(wide: boolean) => void} onChange chiamata a ogni cambio
 * @returns {{ wide: boolean, stop: () => void }}
 */
export function watchMinWidth(minWidth, onChange) {
  const query = globalThis.matchMedia?.(`(min-width: ${minWidth}px)`);
  if (!query) return { wide: false, stop: () => {} };
  const listener = (event) => onChange(event.matches);
  query.addEventListener('change', listener);
  return { wide: query.matches, stop: () => query.removeEventListener('change', listener) };
}

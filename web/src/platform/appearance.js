// Funzioni del dispositivo legate all'aspetto (SPEC §6.9).

export const THEME_STORAGE_KEY = 'blesscommander.theme';

/** @returns {boolean} true se il dispositivo chiede il tema scuro */
export function systemPrefersDark() {
  return Boolean(globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

/**
 * Ascolta i cambi di tema del dispositivo.
 * @param {(dark: boolean) => void} callback
 * @returns {() => void} funzione per smettere di ascoltare
 */
export function watchSystemTheme(callback) {
  const query = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  if (!query) return () => {};
  const handler = (event) => callback(event.matches);
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

/**
 * Imposta l'attributo `data-theme` sulla pagina. Con "system" lo toglie e decide il dispositivo.
 * @param {'system' | 'light' | 'dark'} preference
 */
export function applyTheme(preference) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

/** Blocca o sblocca lo scorrimento della pagina dietro a menu e finestre aperte. */
export function lockScroll(locked) {
  globalThis.document?.documentElement.classList.toggle('is-locked', locked);
}

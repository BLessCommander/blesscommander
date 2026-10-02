// Memoria locale del dispositivo (SPEC §6.9). Se il browser la blocca (finestra privata, dati
// bloccati) si usa una copia in memoria: l'app funziona, ma non ricorda le scelte al riavvio.
const fallback = new Map();

/** @returns {Storage | null} */
function backend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @returns {string | null}
 */
export function readStorage(key) {
  try {
    const store = backend();
    if (store) return store.getItem(key);
  } catch {
    // ricade sulla copia in memoria
  }
  return fallback.get(key) ?? null;
}

/**
 * @param {string} key
 * @param {string} value
 */
export function writeStorage(key, value) {
  fallback.set(key, value);
  try {
    backend()?.setItem(key, value);
  } catch {
    // quota piena o accesso negato: resta la copia in memoria
  }
}

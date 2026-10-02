// Archiviazione del token GitHub (SPEC §6.9). Nella versione web usa la memoria locale del
// browser; con Capacitor verrà sostituita dall'archivio sicuro del sistema. Il token non si
// logga e non si mostra mai in chiaro.
import { readStorage, writeStorage } from './storage.js';

const TOKEN_KEY = 'blesscommander.token';

/** @returns {string | null} */
export function readToken() {
  return readStorage(TOKEN_KEY) || null;
}

/** @param {string} token */
export function saveToken(token) {
  writeStorage(TOKEN_KEY, token);
}

export function clearToken() {
  writeStorage(TOKEN_KEY, '');
}

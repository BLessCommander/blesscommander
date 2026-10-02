// Archiviazione del token GitHub (SPEC §6.9). Nella versione web usa la memoria locale del
// browser; con Capacitor verrà sostituita dall'archivio sicuro del sistema. Il token non si
// logga e non si mostra mai in chiaro.
import { readStorage, writeStorage } from './storage.js';

const TOKEN_KEY = 'blesscommander.token';
const TEST_REPO_KEY = 'blesscommander.test-repo';

/** @returns {string | null} */
export function readToken() {
  return readStorage(TOKEN_KEY) || null;
}

/** Il token collegato è quello del repository di prova (non dei dati veri). */
export function readTestRepoFlag() {
  return readStorage(TEST_REPO_KEY) === '1';
}

/**
 * @param {string} token
 * @param {boolean} [testRepo] collega il repository di prova invece di quello reale
 */
export function saveToken(token, testRepo = false) {
  writeStorage(TOKEN_KEY, token);
  writeStorage(TEST_REPO_KEY, testRepo ? '1' : '');
}

export function clearToken() {
  writeStorage(TOKEN_KEY, '');
  writeStorage(TEST_REPO_KEY, '');
}

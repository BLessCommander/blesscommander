// Accesso con token personale GitHub (SPEC §6.7). L'ambiente dati si sceglie all'avvio:
// dopo l'accesso o l'uscita l'app si riavvia.
import { DATA_REPO, ORG, TEST_REPO } from '../config/environment.js';
import { checkRepository } from '../data/connection-check.js';
import { reloadApp } from '../platform/app-lifecycle.js';
import { clearToken, saveToken } from '../platform/secure-storage.js';

/**
 * Verifica il token e, solo se valido e di un membro, lo salva e riavvia l'app.
 * Con `testRepo` collega il repository di prova, che deve avere `testMode` (e viceversa).
 * @param {string} rawToken
 * @param {{ testRepo?: boolean, fetch?: typeof fetch, reload?: () => void }} [options]
 */
export async function signIn(
  rawToken,
  { testRepo = false, fetch: fetchImpl, reload = reloadApp } = {},
) {
  const token = rawToken.trim();
  const repo = testRepo ? TEST_REPO : DATA_REPO;
  const result = await checkRepository({ token, owner: ORG, repo, testRepo, fetch: fetchImpl });
  if (result.ok) {
    saveToken(token, testRepo);
    reload();
  }
  return result;
}

/** Cancella il token da questo dispositivo e riavvia l'app. */
export function signOut({ reload = reloadApp } = {}) {
  clearToken();
  reload();
}

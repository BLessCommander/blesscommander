// Accesso con token personale GitHub (SPEC §6.7). L'ambiente dati si sceglie all'avvio:
// dopo l'accesso o l'uscita l'app si riavvia.
import { DATA_REPO, ORG } from '../config/environment.js';
import { checkRepository } from '../data/connection-check.js';
import { reloadApp } from '../platform/app-lifecycle.js';
import { clearToken, saveToken } from '../platform/secure-storage.js';

/**
 * Verifica il token e, solo se valido e di un membro, lo salva e riavvia l'app.
 * @param {string} rawToken
 * @param {{ fetch?: typeof fetch, reload?: () => void }} [options]
 */
export async function signIn(rawToken, { fetch: fetchImpl, reload = reloadApp } = {}) {
  const token = rawToken.trim();
  const result = await checkRepository({ token, owner: ORG, repo: DATA_REPO, fetch: fetchImpl });
  if (result.ok) {
    saveToken(token);
    reload();
  }
  return result;
}

/** Cancella il token da questo dispositivo e riavvia l'app. */
export function signOut({ reload = reloadApp } = {}) {
  clearToken();
  reload();
}

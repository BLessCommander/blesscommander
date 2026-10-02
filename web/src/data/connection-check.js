// Verifiche di connessione. `checkFakeGithub`: finta API locale (ambiente `fake-github`), con il token
// di un membro finto (`token-<login>`) solo all'indirizzo scelto da `resolveEnvironment`.
// `checkRepository`: token personale sul repository dati reale, prima di salvarlo.
import { DATA_ERROR } from './errors.js';
import { GitHubProvider } from './github-provider.js';

/**
 * @param {string} baseUrl indirizzo locale della finta API
 * @param {string} login membro finto
 * @returns {Promise<{ ok: boolean, login?: string }>}
 */
export async function checkFakeGithub(baseUrl, login) {
  try {
    const response = await fetch(`${baseUrl}/user`, {
      headers: { Authorization: `Bearer token-${login}` },
    });
    if (!response.ok) return { ok: false };
    const user = await response.json();
    return { ok: true, login: user.login };
  } catch {
    return { ok: false };
  }
}

/**
 * Verifica un token sul repository dati reale prima di salvarlo (SPEC §6.7).
 * Rifiuta un repository in modalità prova: i dati veri e quelli di prova non si mescolano.
 * @param {object} options
 * @param {string} options.token
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {typeof fetch} [options.fetch]
 * @returns {Promise<{ ok: true, login: string } | { ok: false, reason: 'auth' | 'not-member' | 'test-mode' | 'network' }>}
 */
export async function checkRepository({ token, owner, repo, fetch: fetchImpl }) {
  const provider = new GitHubProvider({ owner, repo, token, fetch: fetchImpl });
  try {
    const user = await provider.getCurrentUser();
    const config = await provider.getConfig();
    if (config.testMode === true) return { ok: false, reason: 'test-mode' };
    return { ok: true, login: user.login };
  } catch (error) {
    if (error.code === DATA_ERROR.network) return { ok: false, reason: 'network' };
    // Utente fuori dall'elenco, repository non visibile o configurazione mancante: non si entra.
    if (error.code === DATA_ERROR.auth && /non presente/.test(error.message)) {
      return { ok: false, reason: 'not-member' };
    }
    return { ok: false, reason: 'auth' };
  }
}

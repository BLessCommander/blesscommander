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
 * I dati veri e quelli di prova non si mescolano: con `testRepo` il repository DEVE essere in
 * modalità prova, senza `testRepo` NON deve esserlo.
 * @param {object} options
 * @param {string} options.token
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {boolean} [options.testRepo] si sta collegando il repository di prova
 * @param {typeof fetch} [options.fetch]
 * @returns {Promise<{ ok: true, login: string, user: import('./data-provider.js').CurrentUser } | { ok: false, reason: 'auth' | 'no-access' | 'not-member' | 'test-mode' | 'not-test-repo' | 'network' }>}
 */
export async function checkRepository({ token, owner, repo, testRepo = false, fetch: fetchImpl }) {
  const provider = new GitHubProvider({ owner, repo, token, fetch: fetchImpl });
  try {
    const user = await provider.getCurrentUser();
    const config = await provider.getConfig();
    const isTest = config.testMode === true;
    if (testRepo && !isTest) return { ok: false, reason: 'not-test-repo' };
    if (!testRepo && isTest) return { ok: false, reason: 'test-mode' };
    return { ok: true, login: user.login, user };
  } catch (error) {
    if (error.code === DATA_ERROR.network) return { ok: false, reason: 'network' };
    if (error.details?.reason === 'not-member') return { ok: false, reason: 'not-member' };
    // Token valido ma senza permesso sul repository dati (o repository non visibile).
    if (error.code === DATA_ERROR.forbidden || error.code === DATA_ERROR.notFound) {
      return { ok: false, reason: 'no-access' };
    }
    return { ok: false, reason: 'auth' };
  }
}

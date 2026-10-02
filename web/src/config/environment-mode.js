/**
 * @typedef {'demo' | 'fake-github'} EnvironmentMode
 * @typedef {{ mode: EnvironmentMode, label: string, fakeGithubUrl: string | null, fakeLogin: string | null }} Environment
 */

const LABELS = { demo: 'DEMO LOCALE', 'fake-github': 'FINTA API GITHUB' };

/**
 * Sceglie l'ambiente dalle variabili di Vite. Senza configurazione è sempre la demo (SPEC §6.11).
 * La finta API vale solo se l'indirizzo è locale: così non si può puntare per sbaglio a un servizio reale.
 * @param {Record<string, string | undefined>} env
 * @returns {Environment}
 */
export function resolveEnvironment(env) {
  const url = env.VITE_FAKE_GITHUB_URL ?? '';
  const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url);
  if (env.VITE_DATA_MODE === 'fake-github' && isLocal) {
    return {
      mode: 'fake-github',
      label: LABELS['fake-github'],
      fakeGithubUrl: url.replace(/\/$/, ''),
      fakeLogin: env.VITE_FAKE_GITHUB_LOGIN || 'test-owner',
    };
  }
  return { mode: 'demo', label: LABELS.demo, fakeGithubUrl: null, fakeLogin: null };
}

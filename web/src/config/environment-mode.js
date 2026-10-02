/**
 * @typedef {'demo' | 'fake-github' | 'github'} EnvironmentMode
 * @typedef {{ mode: EnvironmentMode, label: string, fakeGithubUrl: string | null, fakeLogin: string | null }} Environment
 */

const LABELS = {
  demo: 'DEMO LOCALE',
  'fake-github': 'FINTA API GITHUB',
  github: 'REPOSITORY REALE',
};

/**
 * Sceglie l'ambiente dalle variabili di Vite. Senza configurazione è sempre la demo (SPEC §6.11).
 * La finta API vale solo se l'indirizzo è locale: così non si può puntare per sbaglio a un servizio reale.
 * Il repository reale vale solo se l'utente l'ha collegato (token salvato) e non si sta usando la finta API.
 * @param {Record<string, string | undefined>} env
 * @param {{ token?: string | null }} [saved] dati salvati sul dispositivo
 * @returns {Environment}
 */
export function resolveEnvironment(env, saved = {}) {
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
  if (saved.token && env.VITE_DATA_MODE !== 'fake-github') {
    return { mode: 'github', label: LABELS.github, fakeGithubUrl: null, fakeLogin: null };
  }
  return { mode: 'demo', label: LABELS.demo, fakeGithubUrl: null, fakeLogin: null };
}

/**
 * @typedef {'demo' | 'fake-github' | 'firebase-emulator' | 'github' | 'signed-out'} EnvironmentMode
 * @typedef {{ mode: EnvironmentMode, label: string, fakeGithubUrl: string | null, fakeLogin: string | null, testRepo: boolean, emulatorHost?: string, emulatorPort?: number }} Environment
 */

const LABELS = {
  demo: 'DEMO LOCALE',
  'fake-github': 'FINTA API GITHUB',
  'firebase-emulator': 'EMULATORE FIREBASE',
  github: 'REPOSITORY REALE',
  'github-test': 'REPOSITORY DI PROVA',
  'signed-out': 'NON COLLEGATO',
};

/**
 * Sceglie l'ambiente dalle variabili di Vite. Senza configurazione è sempre la demo (SPEC §6.11).
 * La finta API vale solo se l'indirizzo è locale: così non si può puntare per sbaglio a un servizio reale.
 * Il repository reale vale solo se l'utente l'ha collegato (token salvato) e non si sta usando la finta API.
 * @param {Record<string, string | undefined>} env
 * Con `saved.testRepo` il token vale per il repository di prova: stesso modo `github`, ma `testRepo: true`.
 * @param {{ token?: string | null, testRepo?: boolean }} [saved] dati salvati sul dispositivo
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
      testRepo: false,
    };
  }
  // Emulatore di Firestore: solo su indirizzo locale, come la finta API.
  const emulator = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(env.VITE_FIRESTORE_EMULATOR_HOST ?? '');
  if (env.VITE_DATA_MODE === 'firebase-emulator' && emulator) {
    return {
      mode: 'firebase-emulator',
      label: LABELS['firebase-emulator'],
      fakeGithubUrl: null,
      fakeLogin: env.VITE_FAKE_GITHUB_LOGIN || 'test-owner',
      testRepo: false,
      emulatorHost: emulator[1],
      emulatorPort: Number(emulator[2]),
    };
  }
  if (saved.token && env.VITE_DATA_MODE !== 'fake-github') {
    const testRepo = saved.testRepo === true;
    const label = testRepo ? LABELS['github-test'] : LABELS.github;
    return { mode: 'github', label, fakeGithubUrl: null, fakeLogin: null, testRepo };
  }
  // Sito pubblicato (impostato solo dal workflow di Pages): senza token niente demo, solo l'accesso.
  if (env.VITE_PUBLIC_SITE === 'true') {
    return {
      mode: 'signed-out',
      label: LABELS['signed-out'],
      fakeGithubUrl: null,
      fakeLogin: null,
      testRepo: false,
    };
  }
  return {
    mode: 'demo',
    label: LABELS.demo,
    fakeGithubUrl: null,
    fakeLogin: null,
    testRepo: false,
  };
}

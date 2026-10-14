import { describe, expect, it } from 'vitest';
import { resolveEnvironment } from './environment-mode.js';

describe('resolveEnvironment', () => {
  it('senza configurazione è la demo', () => {
    expect(resolveEnvironment({}).mode).toBe('demo');
  });

  it("usa la finta API se l'indirizzo è locale", () => {
    const env = resolveEnvironment({
      VITE_DATA_MODE: 'fake-github',
      VITE_FAKE_GITHUB_URL: 'http://127.0.0.1:4500/',
    });
    expect(env).toMatchObject({
      mode: 'fake-github',
      fakeGithubUrl: 'http://127.0.0.1:4500',
      fakeLogin: 'test-owner',
    });
  });

  it('rifiuta indirizzi non locali e torna alla demo', () => {
    for (const url of ['https://api.github.com', 'http://example.com:80', '']) {
      const env = resolveEnvironment({ VITE_DATA_MODE: 'fake-github', VITE_FAKE_GITHUB_URL: url });
      expect(env.mode).toBe('demo');
      expect(env.fakeGithubUrl).toBeNull();
    }
  });

  it("usa l'emulatore Firestore solo su indirizzo locale, anche con un token salvato", () => {
    const env = resolveEnvironment(
      { VITE_DATA_MODE: 'firebase-emulator', VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8081' },
      { token: 'ghp_x' },
    );
    expect(env).toMatchObject({
      mode: 'firebase-emulator',
      emulatorHost: '127.0.0.1',
      emulatorPort: 8081,
      fakeLogin: 'test-owner',
    });
    for (const host of ['firestore.googleapis.com:443', 'example.com:8080', '']) {
      const other = resolveEnvironment({
        VITE_DATA_MODE: 'firebase-emulator',
        VITE_FIRESTORE_EMULATOR_HOST: host,
      });
      expect(other.mode).toBe('demo');
    }
  });

  it('con un token salvato usa il repository reale', () => {
    expect(resolveEnvironment({}, { token: 'ghp_x' })).toMatchObject({
      mode: 'github',
      label: 'REPOSITORY REALE',
      fakeGithubUrl: null,
    });
    expect(resolveEnvironment({}, { token: null }).mode).toBe('demo');
  });

  it('con il flag del repository di prova usa il modo github con etichetta di prova', () => {
    expect(resolveEnvironment({}, { token: 'ghp_x', testRepo: true })).toMatchObject({
      mode: 'github',
      label: 'REPOSITORY DI PROVA',
      testRepo: true,
    });
    expect(resolveEnvironment({}, { token: 'ghp_x' }).testRepo).toBe(false);
    // senza token il flag non basta
    expect(resolveEnvironment({}, { token: null, testRepo: true }).mode).toBe('demo');
  });

  it('sul sito pubblicato senza token non c’è la demo: si resta non collegati', () => {
    expect(resolveEnvironment({ VITE_PUBLIC_SITE: 'true' }).mode).toBe('signed-out');
    expect(resolveEnvironment({ VITE_PUBLIC_SITE: 'true' }, { token: 'ghp_x' }).mode).toBe(
      'github',
    );
    expect(resolveEnvironment({ VITE_PUBLIC_SITE: 'false' }).mode).toBe('demo');
  });

  it('la finta API ha la precedenza e non usa mai un token reale', () => {
    const env = resolveEnvironment(
      { VITE_DATA_MODE: 'fake-github', VITE_FAKE_GITHUB_URL: 'http://localhost:4500' },
      { token: 'ghp_x' },
    );
    expect(env.mode).toBe('fake-github');
  });
});

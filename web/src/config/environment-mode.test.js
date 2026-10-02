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
});

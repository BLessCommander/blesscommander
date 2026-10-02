// Unico punto in cui si sceglie l'implementazione di DataProvider (SPEC §6.3):
// demo → MockProvider; finta API locale o repository reale collegato → GitHubProvider.
import { DATA_REPO, ENVIRONMENT, ORG, TEST_REPO } from '../config/environment.js';
import { readToken } from '../platform/secure-storage.js';
import { GitHubProvider } from './github-provider.js';
import { MockProvider } from './mock-provider.js';

/** @returns {import('./data-provider.js').DataProvider} */
export function createDataProvider() {
  if (ENVIRONMENT.mode === 'fake-github') {
    return new GitHubProvider({
      owner: ORG,
      repo: TEST_REPO,
      baseUrl: ENVIRONMENT.fakeGithubUrl,
      token: `token-${ENVIRONMENT.fakeLogin}`,
      autoFlush: true,
    });
  }
  if (ENVIRONMENT.mode === 'github') {
    return new GitHubProvider({ owner: ORG, repo: DATA_REPO, token: readToken(), autoFlush: true });
  }
  return new MockProvider();
}

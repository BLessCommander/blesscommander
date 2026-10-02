// Unico punto in cui si sceglie l'implementazione di DataProvider (SPEC §6.3):
// demo → MockProvider; finta API locale o repository reale collegato → GitHubProvider.
import { ENVIRONMENT, LINKED_REPO, ORG, TEST_REPO } from '../config/environment.js';
import { readToken } from '../platform/secure-storage.js';
import { GitHubProvider } from './github-provider.js';
import { MockProvider } from './mock-provider.js';

/**
 * @param {{ onQueueEvent?: (event: { type: 'dropped', write: { method: string }, error: unknown }) => void }} [options]
 * @returns {import('./data-provider.js').DataProvider}
 */
export function createDataProvider({ onQueueEvent } = {}) {
  if (ENVIRONMENT.mode === 'fake-github') {
    return new GitHubProvider({
      owner: ORG,
      repo: TEST_REPO,
      baseUrl: ENVIRONMENT.fakeGithubUrl,
      token: `token-${ENVIRONMENT.fakeLogin}`,
      autoFlush: true,
      onQueueEvent,
    });
  }
  if (ENVIRONMENT.mode === 'github') {
    return new GitHubProvider({
      owner: ORG,
      repo: LINKED_REPO,
      token: readToken(),
      autoFlush: true,
      onQueueEvent,
    });
  }
  return new MockProvider();
}

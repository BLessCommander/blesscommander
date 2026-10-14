// Unico punto in cui si sceglie l'implementazione di DataProvider (SPEC §6.3):
// demo → MockProvider; finta API locale o repository reale collegato → GitHubProvider.
import { ENVIRONMENT, LINKED_REPO, ORG, TEST_REPO } from '../config/environment.js';
import { readToken } from '../platform/secure-storage.js';
import { readActiveGroup } from './account.js';
import { createEmulatorProvider, emulatorServices } from './firebase-emulator.js';
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
  if (ENVIRONMENT.mode === 'firebase-emulator') {
    const connection = { host: ENVIRONMENT.emulatorHost, port: ENVIRONMENT.emulatorPort };
    if (ENVIRONMENT.authEmulatorUrl) {
      // Con gli account: l'utente è quello di Google e il gruppo è quello scelto (riavvio dopo la scelta).
      const { auth } = emulatorServices({ ...connection, authUrl: ENVIRONMENT.authEmulatorUrl });
      return createEmulatorProvider({
        ...connection,
        authUrl: ENVIRONMENT.authEmulatorUrl,
        groupId: readActiveGroup() ?? '-',
        resolveUid: async () => (await auth.current())?.uid ?? null,
      });
    }
    return createEmulatorProvider({ ...connection, memberId: ENVIRONMENT.fakeLogin });
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

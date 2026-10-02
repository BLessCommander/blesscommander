// Unico punto in cui si sceglie l'implementazione di DataProvider. Per ora solo il MockProvider
// (modalità demo); GitHubProvider arriva con le voci successive.
import { MockProvider } from './mock-provider.js';

/** @returns {import('./data-provider.js').DataProvider} */
export function createDataProvider() {
  return new MockProvider();
}

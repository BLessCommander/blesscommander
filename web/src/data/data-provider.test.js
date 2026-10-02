import { MockProvider } from './mock-provider.js';
import { DEMO_LOGINS } from './seed-demo.js';
import { runProviderContract } from './provider-contract.js';

runProviderContract(
  'MockProvider',
  (login) => new MockProvider({ login, now: () => '2026-03-01T10:00:00Z' }),
  DEMO_LOGINS,
);

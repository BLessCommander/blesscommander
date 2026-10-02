import { defineConfig } from 'vitest/config';

// Gli script Playwright (*.spec.js in tests/e2e) li esegue Playwright, non Vitest.
export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'test-results/**'],
  },
});

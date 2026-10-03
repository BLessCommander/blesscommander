import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const progetto = JSON.parse(readFileSync(new URL('./docs/progetto.json', import.meta.url), 'utf8'));

// Gli script Playwright (*.spec.js in tests/e2e) li esegue Playwright, non Vitest.
export default defineConfig({
  // Stesse costanti che Vite inietta nell'app (web/vite.config.js).
  define: {
    __APP_NAME__: JSON.stringify(progetto.appName || 'Bracketeer'),
    __ORG__: JSON.stringify(progetto.org || 'BLessCommander'),
    __DATA_REPO__: JSON.stringify(progetto.repos?.data || 'blesscommander-data'),
    __TEST_REPO__: JSON.stringify(progetto.repos?.test || 'blesscommander-data-test'),
    __ARCHIDEKT_LIVE__: false,
  },
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'test-results/**'],
  },
});

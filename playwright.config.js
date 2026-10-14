import { defineConfig, devices } from '@playwright/test';

// Porta propria dei test: non si mescola con `npm run dev` (che usa dati veri da Archidekt).
const PORT = 5174;
// Server per i test degli account (E-04a): emulatori indicati ma mai avviati, servizi finti nel browser.
const ACCOUNTS_PORT = 5175;

// I 6 profili obbligatori di docs/PIANO-Test.md §2.
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-small',
      use: { ...devices['Pixel 7'], viewport: { width: 320, height: 568 } },
    },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'] } },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'desktop-wide',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:test -w web',
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev:test-accounts -w web',
      url: `http://localhost:${ACCOUNTS_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_DATA_MODE: 'firebase-emulator',
        VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8081',
        VITE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        VITE_ACCOUNT_FAKE: 'true',
      },
    },
  ],
});

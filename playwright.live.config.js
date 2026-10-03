import { defineConfig, devices } from '@playwright/test';

// Prova sul sito PUBBLICATO (repository dati vero). Non fa parte di `npm run test:e2e` e non gira in CI:
// si lancia a mano con `npm run test:live`, solo se imposti LIVE_TOKEN (il tuo token, nella variabile
// d'ambiente del tuo terminale: non va mai scritto in file o in chat). Scrive soltanto le richieste di
// import (come fai usando l'app) e non salva né modifica mazzi.
export default defineConfig({
  testDir: 'tests/live',
  testMatch: '**/*.spec.js',
  outputDir: 'test-results/playwright-live',
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: process.env.LIVE_SITE_URL ?? 'https://blesscommander.github.io/blesscommander/',
    // Niente tracce né video: registrerebbero le richieste con il token.
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});

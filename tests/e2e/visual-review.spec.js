import { mkdir } from 'node:fs/promises';
import { mockScryfall } from '../fixtures/scryfall-fake.js';
import { test } from './fixtures.js';

// Screenshot per la revisione del subagent `ui-reviewer` (PIANO-Test §5).
// Si lancia con `npm run test:visual-review` (profili iphone e desktop-chrome, tema chiaro e scuro).
// Aggiungere qui le schermate toccate da ogni nuova voce.
const SCREENS = [
  { name: 'dashboard', path: '/' },
  { name: 'regolamento', path: '/#/regolamento' },
  { name: 'profilo', path: '/#/profilo' },
  { name: 'ambiente', path: '/#/ambiente' },
  { name: 'accesso', path: '/#/accesso' },
  { name: 'mazzi', path: '/#/mazzi' },
  { name: 'segnaposto', path: '/#/partite' },
  { name: 'menu-aperto', path: '/#/mazzi?overlay=menu' },
  { name: 'finestra', path: '/#/profilo?overlay=about' },
  { name: 'notifiche', path: '/#/notifiche' },
  { name: 'gruppo', path: '/#/gruppo' },
  { name: 'gruppo-nuovo-membro', path: '/#/gruppo?overlay=member-form' },
  { name: 'importa', path: '/#/importa' },
];
const THEMES = ['light', 'dark'];

// Repository di prova (C-04b): banner rosso e selettore "Agisci come", con API GitHub intercettata.
const TEST_MEMBERS = {
  amico: { displayName: 'Amico', role: 'admin' },
  'test-giocatore1': { displayName: 'Giocatore uno', role: 'giocatore' },
};
const TEST_GROUP = {
  name: 'Gruppo',
  settings: {},
  formats: [],
  testMode: true,
  testOperators: ['amico'],
};
const asFile = (json) => ({
  type: 'file',
  encoding: 'base64',
  sha: 'abc',
  content: Buffer.from(JSON.stringify(json)).toString('base64'),
});

for (const theme of THEMES) {
  test(`screenshot modalita-prova ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem('blesscommander.token', 'ghp_finto'));
    await page.route('https://api.github.com/**', async (route) => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers: cors });
      const path = new URL(route.request().url()).pathname;
      const bodies = {
        '/user': { login: 'amico' },
        '/config/members.json': asFile(TEST_MEMBERS),
        '/config/group.json': asFile(TEST_GROUP),
        '/derived/snapshot.json': asFile({
          decks: [],
          games: [],
          standings: [],
          updatedAt: '2026-01-01',
        }),
      };
      const key = Object.keys(bodies).find((k) => path.endsWith(k));
      return route.fulfill({
        status: key ? 200 : 404,
        headers: { ...cors, 'content-type': 'application/json', etag: '"abc"' },
        body: JSON.stringify(key ? bodies[key] : { message: 'Not Found' }),
      });
    });
    await page.goto('/#/');
    await page.getByTestId('test-banner').waitFor();
    await page.waitForLoadState('networkidle');
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/modalita-prova-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Elenco con notifiche miste (lette e non lette).
for (const theme of THEMES) {
  test(`screenshot notifiche-miste ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/#/notifiche');
    await page.getByTestId('answer-yes').click();
    await page.getByTestId('mark-read').first().click();
    await page.waitForLoadState('networkidle');
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/notifiche-miste-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Anteprima dell'import (C-05): due comandanti e una carta non trovata.
for (const theme of THEMES) {
  test(`screenshot importa-anteprima ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await mockScryfall(page);
    await page.goto('/#/importa');
    await page
      .getByLabel('Lista del mazzo')
      .fill(
        'Commander\n1 Tymna the Weaver\n1 Thrasios, Triton Hero\n\nDeck\n1 Sol Ring\n1 Rhystic Study\n1 Carta inesistente',
      );
    await page.getByRole('button', { name: 'Controlla la lista' }).click();
    await page.getByTestId('import-preview').waitFor();
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/importa-anteprima-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

for (const screen of SCREENS) {
  for (const theme of THEMES) {
    test(`screenshot ${screen.name} ${theme} @review`, async ({ page }, testInfo) => {
      test.skip(
        !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
        'solo iphone e desktop',
      );
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      await mkdir('review-screenshots', { recursive: true });
      await page.screenshot({
        path: `review-screenshots/${screen.name}-${testInfo.project.name}-${theme}.png`,
        fullPage: true,
      });
    });
  }
}

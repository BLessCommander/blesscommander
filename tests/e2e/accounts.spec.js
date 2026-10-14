import { mkdir } from 'node:fs/promises';
import { test, expect } from './fixtures.js';

// E-04a (UC-63): accesso con Google e gruppi. L'app gira con account e gruppi finti (nessun servizio
// vero, nemmeno gli emulatori): si prova l'interfaccia. Regole e servizio vero sono in Vitest.
test.use({ baseURL: 'http://localhost:5175' });

test.describe('account e gruppi @core', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Una sola volta per test: i dati finti (in localStorage) devono sopravvivere ai ricarichi.
      if (!sessionStorage.getItem('cleared')) {
        localStorage.clear();
        sessionStorage.setItem('cleared', '1');
      }
    });
    await page.goto('/');
  });

  /** Al posto del riavvio dell'app (che aprirebbe dati veri) si segna che è stato chiesto. */
  const stopReload = (page) =>
    page.evaluate(() => {
      const app = document.querySelector('#app').__vue_app__;
      app.config.globalProperties.$pinia._s.get('account').options.reload = () => {
        window.__reloaded = true;
      };
    });

  const signIn = (page) => page.getByTestId('google-signin').click();

  async function createGroup(page, name) {
    const form = page.getByTestId('create-group');
    await form.getByLabel('Nome del gruppo').fill(name);
    await form.getByRole('button', { name: 'Crea il gruppo' }).click();
    await expect(page.getByTestId('group-created')).toBeVisible();
    return page.getByTestId('invite-code').innerText();
  }

  test('prima dell’accesso si vede solo «Accedi con Google» @ui', async ({ page }) => {
    await expect(page.getByTestId('account-gate')).toBeVisible();
    await expect(page.getByTestId('google-signin')).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('si accede e senza gruppi si può crearne uno o entrare con un codice @ui', async ({
    page,
  }) => {
    await signIn(page);
    await expect(page.getByTestId('account-name')).toContainText('Anna Rossi');
    await expect(page.getByTestId('no-groups')).toBeVisible();
    await expect(page.getByTestId('create-group')).toBeVisible();
    await expect(page.getByTestId('join-group')).toBeVisible();
  });

  test('chi crea un gruppo ne vede il codice di invito @ui', async ({ page }) => {
    await signIn(page);
    const code = await createGroup(page, 'Venerdì sera');
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
  });

  test('continuare dopo la creazione sceglie il gruppo e riavvia l’app', async ({ page }) => {
    await signIn(page);
    await createGroup(page, 'Venerdì sera');
    await stopReload(page);
    await page.getByTestId('group-created-continue').click();
    await expect.poll(() => page.evaluate(() => window.__reloaded)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('blc:active-group'))).toBeTruthy();
  });

  test('con il codice si entra in un gruppo esistente', async ({ page }) => {
    await signIn(page);
    const code = await createGroup(page, 'Venerdì sera');
    await page.evaluate(() => {
      // Un altro giocatore: stesso browser, altro account finto.
      const state = JSON.parse(localStorage.getItem('blc:fake-accounts'));
      state.session = { uid: 'google-bruno', displayName: 'Bruno Bianchi' };
      localStorage.setItem('blc:fake-accounts', JSON.stringify(state));
    });
    await page.reload();
    await expect(page.getByTestId('account-name')).toContainText('Bruno Bianchi');
    await stopReload(page);
    const join = page.getByTestId('join-group');
    await join.getByLabel('Codice di invito').fill(code.toLowerCase());
    await join.getByRole('button', { name: 'Entra nel gruppo' }).click();
    await expect.poll(() => page.evaluate(() => window.__reloaded)).toBe(true);
  });

  test('un codice che non esiste dà un messaggio chiaro @ui', async ({ page }) => {
    await signIn(page);
    const join = page.getByTestId('join-group');
    await join.getByLabel('Codice di invito').fill('NONESISTE');
    await join.getByRole('button', { name: 'Entra nel gruppo' }).click();
    await expect(page.getByTestId('account-error')).toContainText('non esiste');
  });

  test('con più gruppi si sceglie quello da aprire @ui', async ({ page }) => {
    await signIn(page);
    await createGroup(page, 'Venerdì sera');
    await page.evaluate(() => localStorage.removeItem('blc:active-group'));
    await page.reload();
    await expect(page.getByTestId('account-name')).toBeVisible();
    await createGroup(page, 'Domenica');
    await page.reload();
    await expect(
      page.locator('[data-testid^="group-"]:not([data-testid="group-created"])'),
    ).toHaveCount(2);
  });

  // Screenshot per la revisione del subagent `ui-reviewer` (profili iphone e desktop-chrome, due temi).
  test('screenshot per la revisione', async ({ page }, testInfo) => {
    test.skip(!['iphone', 'desktop-chrome'].includes(testInfo.project.name));
    await mkdir('review-screenshots', { recursive: true });
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      const shot = (name) =>
        page.screenshot({
          path: `review-screenshots/account-${name}-${testInfo.project.name}-${scheme}.png`,
          fullPage: true,
        });
      await page.evaluate(() => localStorage.clear());
      await page.goto('/');
      await expect(page.getByTestId('google-signin')).toBeVisible();
      await shot('accesso');
      await page.getByTestId('google-signin').click();
      await expect(page.getByTestId('no-groups')).toBeVisible();
      await shot('senza-gruppi');
      await createGroup(page, 'Venerdì sera');
      await shot('gruppo-creato');
    }
  });
});

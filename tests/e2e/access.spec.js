import { test, expect } from './fixtures.js';

// C-03 (UC-01, UC-02, ex B-10): accesso con token al repository reale. Le richieste a api.github.com sono
// intercettate da Playwright: nessun servizio reale viene chiamato.
test.describe('accesso con token @core', () => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-expose-headers': 'ETag',
  };
  const file = (json) => ({
    sha: 'abc',
    encoding: 'base64',
    content: Buffer.from(JSON.stringify(json)).toString('base64'),
  });

  /** Simula il repository dati reale: `members` è l'elenco membri, `group` la configurazione. */
  async function fakeApi(page, { login = 'amico', members, group, status = 200 }) {
    const hosts = new Set();
    await page.route('https://api.github.com/**', async (route) => {
      const request = route.request();
      hosts.add(new URL(request.url()).host);
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = new URL(request.url()).pathname;
      const reply = (body, code = status) =>
        route.fulfill({
          status: code,
          headers: { ...cors, 'content-type': 'application/json', etag: '"abc"' },
          body: JSON.stringify(body),
        });
      if (status === 401) return reply({ message: 'Bad credentials' }, 401);
      if (path === '/user') return reply({ login });
      if (path.endsWith('/config/members.json')) {
        return members ? reply(file(members)) : reply({ message: 'Not Found' }, 404);
      }
      if (path.endsWith('/config/group.json')) return reply(file(group));
      if (path.endsWith('/derived/snapshot.json'))
        return reply(file({ decks: [], games: [], standings: [], updatedAt: '2026-01-01' }));
      return reply({ message: 'Not Found' }, 404);
    });
    return hosts;
  }

  const member = { amico: { displayName: 'Amico', role: 'giocatore' } };
  const group = { name: 'Gruppo', settings: {}, formats: [] };

  async function connect(page, token) {
    await page.goto('/#/accesso');
    await page.getByLabel('Token personale').fill(token);
    await page.getByRole('button', { name: 'Entra' }).click();
  }

  test('token non valido: errore chiaro, il token non si vede e non si salva', async ({ page }) => {
    const hosts = await fakeApi(page, { members: member, group, status: 401 });
    await page.goto('/#/accesso');
    await expect(page.getByLabel('Token personale')).toHaveAttribute('type', 'password');
    await connect(page, 'ghp_token_segreto');
    await expect(page.getByTestId('access-error')).toContainText('Token non valido o scaduto');
    await expect(page.locator('body')).not.toContainText('ghp_token_segreto');
    expect([...hosts]).toEqual(['api.github.com']);
    expect(await page.evaluate(() => localStorage.getItem('blesscommander.token'))).toBeFalsy();
    await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
  });

  test('repository in modalità prova: rifiutato', async ({ page }) => {
    await fakeApi(page, { members: member, group: { ...group, testMode: true } });
    await connect(page, 'ghp_x');
    await expect(page.getByTestId('access-error')).toContainText('modalità prova');
    await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
  });

  test('utente fuori dall’elenco membri: rifiutato', async ({ page }) => {
    await fakeApi(page, { members: {}, group });
    await connect(page, 'ghp_x');
    await expect(page.getByTestId('access-error')).toContainText('elenco dei membri');
  });

  test('token senza accesso al repository: messaggio con il passo da fare', async ({ page }) => {
    await fakeApi(page, { members: null, group });
    await connect(page, 'ghp_x');
    await expect(page.getByTestId('access-error')).toContainText(
      'Il token non vede i dati del gruppo',
    );
    await expect(page.getByTestId('access-error')).toContainText('Repository access');
    await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
  });

  test('guida visibile nella schermata di accesso @ui', async ({ page }) => {
    await page.goto('/#/accesso');
    await expect(page.getByRole('heading', { name: 'Come creare il token' })).toBeVisible();
    await expect(page.getByText('Contents')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crea il token su GitHub' })).toBeVisible();
  });

  test('accede, resta dentro dopo il riavvio, vede il profilo ed esce @ui', async ({ page }) => {
    await fakeApi(page, { members: member, group });
    await connect(page, 'ghp_token_segreto');
    await expect(page.locator('.env-banner')).toHaveText('REPOSITORY REALE');
    await expect(page.getByTestId('access-linked')).toContainText(
      'BLessCommander/blesscommander-data',
    );
    await page.reload();
    await expect(page.locator('.env-banner')).toHaveText('REPOSITORY REALE');

    await page.goto('/#/profilo');
    await expect(page.getByTestId('profile-user')).toContainText('Amico');
    await expect(page.getByTestId('profile-user')).toContainText('Giocatore');
    if (await page.getByTestId('header-user').isVisible()) {
      await expect(page.getByTestId('header-user')).toContainText('Amico');
    }
    await expect(page.locator('body')).not.toContainText('ghp_token_segreto');

    await page.getByRole('button', { name: 'Esci' }).click();
    await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
    expect(await page.evaluate(() => localStorage.getItem('blesscommander.token'))).toBeFalsy();
    await page.goto('/#/accesso');
    await expect(page.getByLabel('Token personale')).toBeVisible();
  });

  test('token scaduto dopo l’accesso: avviso con link per accedere di nuovo', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('blesscommander.token', 'ghp_vecchio'));
    await fakeApi(page, { members: member, group, status: 401 });
    await page.goto('/#/');
    await expect(page.getByTestId('session-expired')).toContainText('non è più valido');
    await page.getByRole('link', { name: 'Accedi di nuovo' }).click();
    await expect(page.getByTestId('access-linked')).toBeVisible();
  });
});

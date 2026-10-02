import { test, expect } from './fixtures.js';

// UC-27 (parte demo): app in modalità demo con banner e schermata Ambiente.
test('la demo mostra il banner e la schermata Ambiente @core @ui', async ({ page }) => {
  await page.goto('/#/ambiente');
  await expect(page.getByRole('heading', { level: 1, name: 'Ambiente' })).toBeVisible();
  await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
  await expect(page.locator('.env-list')).toContainText('DEMO LOCALE');
  await expect(page.getByTestId('connection-status')).toHaveCount(0);
});

// B-10: collegamento facoltativo al repository reale. Le richieste a api.github.com sono
// intercettate da Playwright: nessun servizio reale viene chiamato.
test.describe('collegamento al repository reale @core', () => {
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
      if (path.endsWith('/config/members.json')) return reply(file(members));
      if (path.endsWith('/config/group.json')) return reply(file(group));
      return reply({ message: 'Not Found' }, 404);
    });
    return hosts;
  }

  const member = { amico: { displayName: 'Amico', role: 'giocatore' } };
  const group = { name: 'Gruppo', settings: {}, formats: [] };

  async function connect(page, token) {
    await page.goto('/#/ambiente');
    await page.getByLabel('Token personale').fill(token);
    await page.getByRole('button', { name: 'Collega' }).click();
  }

  test('token non valido: errore chiaro, il token non si vede e non si salva', async ({ page }) => {
    const hosts = await fakeApi(page, { members: member, group, status: 401 });
    await page.goto('/#/ambiente');
    await expect(page.getByLabel('Token personale')).toHaveAttribute('type', 'password');
    await connect(page, 'ghp_token_segreto');
    await expect(page.getByTestId('real-error')).toContainText('Token non valido o scaduto');
    await expect(page.locator('body')).not.toContainText('ghp_token_segreto');
    expect([...hosts]).toEqual(['api.github.com']);
    expect(await page.evaluate(() => localStorage.getItem('blesscommander.token'))).toBeFalsy();
    await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
  });

  test('repository in modalità prova: rifiutato', async ({ page }) => {
    await fakeApi(page, { members: member, group: { ...group, testMode: true } });
    await connect(page, 'ghp_x');
    await expect(page.getByTestId('real-error')).toContainText('modalità prova');
    await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
  });

  test('utente fuori dall’elenco membri: rifiutato', async ({ page }) => {
    await fakeApi(page, { members: {}, group });
    await connect(page, 'ghp_x');
    await expect(page.getByTestId('real-error')).toContainText('elenco dei membri');
  });

  test('collega, resta collegato dopo il riavvio e si può scollegare @ui', async ({ page }) => {
    await fakeApi(page, { members: member, group });
    await connect(page, 'ghp_x');
    await expect(page.locator('.env-banner')).toHaveText('REPOSITORY REALE');
    await expect(page.getByTestId('real-linked')).toContainText(
      'BLessCommander/blesscommander-data',
    );
    await page.reload();
    await expect(page.locator('.env-banner')).toHaveText('REPOSITORY REALE');
    await page.getByRole('button', { name: 'Scollega' }).click();
    await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
    await expect(page.getByLabel('Token personale')).toBeVisible();
  });
});

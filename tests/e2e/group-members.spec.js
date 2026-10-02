import { test, expect } from './fixtures.js';

// C-04 (UC-03): gestione membri dalla pagina Gruppo. Demo locale: l'utente è admin.
test.describe('membri del gruppo come admin @core', () => {
  test('aggiunge un membro, cambia il ruolo e lo rimuove @ui', async ({ page }) => {
    await page.goto('/#/gruppo');
    const list = page.getByTestId('members-list');
    await expect(list.locator('.member').first()).toBeVisible();
    const before = await list.locator('.member').count();

    await page.getByTestId('member-add').click();
    await page.getByLabel('Login GitHub').fill('nuovo-amico');
    await page.getByLabel('Nome visualizzato').fill('Nuovo Amico');
    await page.getByRole('button', { name: 'Salva' }).click();
    const row = list.locator('[data-login="nuovo-amico"]');
    await expect(row).toContainText('Nuovo Amico');
    await expect(row).toContainText('Giocatore');
    await expect(list.locator('.member')).toHaveCount(before + 1);

    await row.getByRole('button', { name: 'Modifica' }).click();
    await page.getByLabel('Ruolo').selectOption('admin');
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(row).toContainText('Amministratore');

    await row.getByRole('button', { name: 'Rimuovi' }).click();
    await page.getByTestId('member-remove-confirm').click();
    await expect(row).toHaveCount(0);
    await expect(list.locator('.member')).toHaveCount(before);
  });

  test('rifiuta un login non valido o già presente', async ({ page }) => {
    await page.goto('/#/gruppo');
    await page.getByTestId('member-add').click();
    await page.getByLabel('Login GitHub').fill('login non valido!');
    await page.getByLabel('Nome visualizzato').fill('X');
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page.getByRole('alert')).toContainText('login GitHub non è valido');

    const existing = await page.getByTestId('members-list').locator('.member').first();
    const login = await existing.getAttribute('data-login');
    await page.getByLabel('Login GitHub').fill(login);
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page.getByRole('alert')).toContainText('già nell’elenco');
  });

  test('non si può rimuovere sé stessi', async ({ page }) => {
    await page.goto('/#/gruppo');
    const me = page.locator('.member', { hasText: '(tu)' });
    await expect(me.getByRole('button', { name: 'Rimuovi' })).toBeDisabled();
  });
});

// Un giocatore vede l'elenco ma non le funzioni di modifica. Le richieste a api.github.com sono
// intercettate: nessun servizio reale viene chiamato.
test.describe('membri del gruppo come giocatore @core', () => {
  test('nessun pulsante di modifica', async ({ page }) => {
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
    const members = {
      capo: { displayName: 'Capo', role: 'admin' },
      amico: { displayName: 'Amico', role: 'giocatore' },
    };
    const writes = [];
    await page.addInitScript(() => localStorage.setItem('blesscommander.token', 'ghp_x'));
    await page.route('https://api.github.com/**', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (request.method() === 'PUT') writes.push(request.url());
      const path = new URL(request.url()).pathname;
      const reply = (body, status = 200) =>
        route.fulfill({
          status,
          headers: { ...cors, 'content-type': 'application/json', etag: '"abc"' },
          body: JSON.stringify(body),
        });
      if (path === '/user') return reply({ login: 'amico' });
      if (path.endsWith('/config/members.json')) return reply(file(members));
      if (path.endsWith('/config/group.json')) {
        return reply(file({ name: 'Gruppo', settings: {}, formats: [] }));
      }
      if (path.endsWith('/derived/snapshot.json')) {
        return reply(file({ decks: [], games: [], standings: [], updatedAt: '2026-01-01' }));
      }
      return reply({ message: 'Not Found' }, 404);
    });

    await page.goto('/#/gruppo');
    await expect(page.getByTestId('members-list')).toContainText('Capo');
    await expect(page.getByTestId('members-readonly')).toBeVisible();
    await expect(page.getByTestId('member-add')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Modifica' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rimuovi' })).toHaveCount(0);
    expect(writes).toEqual([]);
  });
});

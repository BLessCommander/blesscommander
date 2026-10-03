import { test, expect } from './fixtures.js';

// B-11: dashboard e mazzi leggono lo store dati (qui: dati demo); banner di sincronizzazione;
// selettore "Agisci come" solo su un repository di prova.

/** Modifica lo store dati dall'interno della pagina (solo build di sviluppo). */
const patchStore = (page, patch) =>
  page.evaluate((changes) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    Object.assign(pinia.state.value.data, changes);
  }, patch);

test.describe('pagine con dati reali (demo) @core', () => {
  test('la dashboard mostra i numeri dello snapshot @ui', async ({ page }) => {
    await page.goto('/#/');
    const kpi = (title) =>
      page.locator('.kpi').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(kpi('Partite').locator('.kpi__value')).toHaveText('1');
    await expect(kpi('Percentuale di vittorie').locator('.kpi__value')).toHaveText('100%');
    await expect(kpi('Mazzi per fascia').locator('.kpi__value')).toHaveText('4');
    await expect(kpi('Mazzi per fascia')).toContainText('F4: 1');
    await expect(page.getByText('Nessun dato ancora').first()).toBeVisible(); // TMV non ancora calcolato
    const recent = page.getByRole('region', { name: 'Ultime partite' });
    await expect(recent).toContainText('2026-02-01');
    await expect(recent).toContainText('Mazzo Ottimizzato');
  });

  test('i mazzi sono elencati dalla fascia più alta @ui', async ({ page }) => {
    await page.goto('/#/mazzi');
    await expect(page.getByRole('heading', { level: 1, name: 'Mazzi' })).toBeVisible();
    const names = page.locator('.deck__name');
    await expect(names).toHaveText([
      'Mazzo Ottimizzato',
      'Mazzo Potenziato',
      'Mazzo Base',
      'Mazzo Esibizione',
    ]);
    const first = page.locator('.deck').first();
    await expect(first.locator('.tier-badge')).toHaveText('F4');
    await expect(first).toContainText('Vittorie');
  });

  test('senza modifiche in sospeso non compare nessun banner di sincronizzazione', async ({
    page,
  }) => {
    await page.goto('/#/');
    await expect(page.locator('.kpi').first()).toBeVisible();
    await expect(page.locator('.sync')).toHaveCount(0);
  });

  test('banner "in aggiornamento", scritture in coda e scartate @ui', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('.kpi').first()).toBeVisible();
    await patchStore(page, {
      pendingWrites: 2,
      dropped: [{ method: 'saveDeck', message: 'non valido' }],
      snapshot: {
        decks: [],
        games: [],
        standings: [],
        updatedAt: '2026-01-01',
        pending: true,
        pendingKind: 'deck',
      },
    });
    const banner = page.locator('.sync');
    await expect(banner).toContainText('Mazzo salvato: sto aggiornando le schede e le fasce');
    await expect(banner).toContainText('2 modifiche sono in attesa di connessione');
    await expect(banner.getByRole('alert')).toContainText('è stata rifiutata');
    await banner.getByRole('button', { name: 'Ho capito' }).click();
    await expect(banner.getByRole('alert')).toHaveCount(0);
    await expect(banner.getByRole('button', { name: 'Riprova ora' })).toBeVisible();
  });

  test('"Agisci come" non compare in demo', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('.kpi').first()).toBeVisible();
    await expect(page.getByLabel('Agisci come')).toHaveCount(0);
  });
});

// Repository con token salvato: le richieste a api.github.com sono intercettate (nessun servizio
// reale). Il gruppo di prova serve solo a verificare quando il selettore compare.
test.describe('"Agisci come" @core', () => {
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
    amico: { displayName: 'Amico', role: 'admin' },
    'test-uno': { displayName: 'Utente uno', role: 'giocatore' },
  };
  const snapshot = { decks: [], games: [], standings: [], updatedAt: '2026-01-01' };

  async function open(page, group) {
    await page.addInitScript(() => localStorage.setItem('blesscommander.token', 'ghp_finto'));
    await page.route('https://api.github.com/**', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = new URL(request.url()).pathname;
      const reply = (body, code = 200) =>
        route.fulfill({
          status: code,
          headers: { ...cors, 'content-type': 'application/json', etag: '"abc"' },
          body: JSON.stringify(body),
        });
      if (path === '/user') return reply({ login: 'amico' });
      if (path.endsWith('/config/members.json')) return reply(file(members));
      if (path.endsWith('/config/group.json')) return reply(file(group));
      if (path.endsWith('/derived/snapshot.json')) return reply(file(snapshot));
      return reply({ message: 'Not Found' }, 404);
    });
    await page.goto('/#/');
    // In un repository di prova l'etichetta diventa "MODALITÀ PROVA".
    await expect(page.locator('.env-banner')).toContainText(
      group.testMode ? 'MODALITÀ PROVA' : 'REPOSITORY REALE',
    );
  }
  const base = { name: 'Gruppo', settings: {}, formats: [] };

  test('repository reale (senza testMode): il selettore non esiste, anche per un admin', async ({
    page,
  }) => {
    await open(page, { ...base, testOperators: ['amico'] });
    await expect(page.locator('.kpi').first()).toBeVisible();
    await expect(page.getByLabel('Agisci come')).toHaveCount(0);
    await expect(page.getByTestId('test-banner')).toHaveCount(0);
  });

  test('repository di prova con operatore: il selettore compare e funziona @ui', async ({
    page,
  }) => {
    await open(page, { ...base, testMode: true, testOperators: ['amico'] });
    await expect(page.getByTestId('test-banner')).toBeVisible();
    await expect(page.getByTestId('test-banner')).toHaveText('MODALITÀ PROVA');
    const select = page.getByLabel('Agisci come');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveText(['Me stesso', 'Amico', 'Utente uno']);
    await select.selectOption('test-uno');
    await expect(select).toHaveValue('test-uno');
  });

  test('repository di prova ma utente non operatore: nessun selettore', async ({ page }) => {
    await open(page, { ...base, testMode: true, testOperators: ['altro'] });
    await expect(page.locator('.kpi').first()).toBeVisible();
    await expect(page.getByLabel('Agisci come')).toHaveCount(0);
    await expect(page.getByTestId('test-banner')).toBeVisible();
  });
});

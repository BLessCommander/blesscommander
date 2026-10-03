import { mockCardImages, mockScryfall } from '../fixtures/scryfall-fake.js';
import { test, expect } from './fixtures.js';

// C-08g: statistiche del mazzo a schede (panoramica, curva, colori, probabilità di pescata).

const SCRYFALL = {
  'id-sol': {
    name: 'Sol Ring',
    cmc: 1,
    type_line: 'Artifact',
    colors: [],
    mana_cost: '{1}',
    produced_mana: ['C'],
  },
  'id-counter': {
    name: 'Counterspell',
    cmc: 2,
    type_line: 'Instant',
    colors: ['U'],
    mana_cost: '{U}{U}',
  },
  'id-atraxa': {
    name: 'Atraxa, Praetors Voice',
    cmc: 4,
    type_line: 'Legendary Creature — Phyrexian Angel',
    colors: ['W', 'U', 'B', 'G'],
    mana_cost: '{G}{W}{U}{B}',
  },
  'id-island': {
    name: 'Island',
    cmc: 0,
    type_line: 'Basic Land — Island',
    colors: [],
    mana_cost: '',
    produced_mana: ['U'],
  },
};
const CARDS = [
  { name: 'Sol Ring', qty: 1, scryfallId: 'id-sol' },
  { name: 'Counterspell', qty: 2, scryfallId: 'id-counter', isGameChanger: true },
  { name: 'Atraxa, Praetors Voice', qty: 1, scryfallId: 'id-atraxa' },
  { name: 'Island', qty: 10, scryfallId: 'id-island' },
  { name: 'Carta senza dati', qty: 1 },
];

/** Scryfall finto con carte diverse (per id); con `fail` risponde con un errore. */
async function mockCards(page, { fail = false } = {}) {
  await page.route('https://api.scryfall.com/cards/collection', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors });
    }
    if (fail) return route.fulfill({ status: 500, headers: cors, body: 'errore' });
    const { identifiers } = route.request().postDataJSON();
    const data = identifiers
      .filter((i) => SCRYFALL[i.id])
      .map((i) => ({ id: i.id, color_identity: [], ...SCRYFALL[i.id] }));
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ object: 'list', not_found: [], data }),
    });
  });
}

/** Fa leggere alla scheda un mazzo con queste carte. */
const withCards = (page, cards) =>
  page.evaluate((list) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    pinia._s.get('data').getDeck = async () => ({
      deck: { currentVersion: 1 },
      versions: [{ version: 1, cards: list, gameChangers: [], combos: [] }],
    });
  }, cards);

async function openStats(page) {
  await page.goto('/#/mazzi');
  await withCards(page, CARDS);
  await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();
  await expect(page.getByTestId('deck-stats')).toBeVisible();
  await expect(page.getByTestId('stat-cards')).toHaveText('15');
}

test.describe('statistiche del mazzo @core', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfall(page);
    await mockCardImages(page);
  });

  test('la panoramica mostra totali, costo medio, tipi e carte senza dati @ui', async ({
    page,
  }) => {
    await mockCards(page);
    await openStats(page);
    await expect(page.getByTestId('stat-spells')).toHaveText('4');
    await expect(page.getByTestId('stat-lands')).toHaveText('10');
    await expect(page.getByTestId('stat-average')).toHaveText('2.25');
    await expect(page.getByTestId('stat-game-changers')).toHaveText('2');
    await expect(page.getByTestId('stat-type')).toHaveCount(4);
    await expect(page.getByTestId('stats-unknown')).toHaveText(
      '1 carta senza dati non entra nei conteggi.',
    );
  });

  test('la curva di mana ha un riassunto per il lettore di schermo @ui', async ({ page }) => {
    await mockCards(page);
    await openStats(page);
    await page.getByTestId('stats-tab-curve').click();
    const chart = page.getByTestId('stats-curve').getByRole('img').first();
    await expect(chart).toHaveAttribute(
      'aria-label',
      'Carte per costo di mana: 0: 0, 1: 1, 2: 2, 3: 0, 4: 1, 5: 0, 6: 0, 7: 0, 8+: 0',
    );
    await expect(page.getByTestId('stats-curve')).toContainText('Blu');
    await expect(page.getByTestId('stats-overview')).toBeHidden();
  });

  test('i colori mostrano simboli, carte e produzione @ui', async ({ page }) => {
    await mockCards(page);
    await openStats(page);
    await page.getByTestId('stats-tab-colors').click();
    const blue = page.locator('[data-testid="stat-color"][data-color="U"]');
    await expect(blue.getByTestId('color-cost')).toContainText('5 simboli · 3 carte');
    await expect(blue.getByTestId('color-production')).toContainText('10 carte');
    const red = page.locator('[data-testid="stat-color"][data-color="R"]');
    await expect(red.getByTestId('color-cost')).toContainText('0 simboli');
  });

  test('la probabilità di pescata si calcola e cambia con le scelte @ui', async ({ page }) => {
    await mockCards(page);
    await openStats(page);
    await page.getByTestId('stats-tab-draw').click();
    const row = (key) => page.locator(`[data-testid="odds-row"][data-key="${key}"]`);
    await expect(row('Land').getByTestId('odds-value')).toHaveText('100%');
    await expect(row('Creature').getByTestId('odds-value')).toHaveText('47%');
    await expect(row('Instant').getByTestId('odds-value')).toHaveText('73%');
    await page.getByTestId('draw-wanted').fill('2');
    await expect(row('Instant').getByTestId('odds-value')).toHaveText('20%');
    await expect(page.getByTestId('draw-summary')).toContainText('almeno 2 carte');
    await page.getByTestId('draw-by').selectOption({ label: 'Colore' });
    await expect(row('U')).toBeVisible();
    await expect(row('gameChanger')).toBeVisible();
  });

  test('le schede si scorrono con le frecce della tastiera', async ({ page }) => {
    await mockCards(page);
    await openStats(page);
    await page.getByTestId('stats-tab-overview').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('stats-tab-curve')).toBeFocused();
    await expect(page.getByTestId('stats-tab-curve')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('stats-curve')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('stats-tab-overview')).toHaveAttribute('aria-selected', 'true');
  });

  test('senza i dati delle carte lo dice invece di mostrare numeri falsi', async ({ page }) => {
    await mockCards(page, { fail: true });
    await openStats(page);
    await expect(page.getByTestId('deck-stats')).toContainText('non si possono calcolare');
  });

  test('la pagina non scorre in orizzontale in nessuna scheda @ui', async ({ page }) => {
    await mockCards(page);
    await openStats(page);
    for (const id of ['overview', 'curve', 'colors', 'draw']) {
      await page.getByTestId(`stats-tab-${id}`).click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, id).toBeLessThanOrEqual(0);
    }
  });
});

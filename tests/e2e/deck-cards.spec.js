import { mockCardImages, mockScryfall } from '../fixtures/scryfall-fake.js';
import { test, expect } from './fixtures.js';

// C-08c: le carte del mazzo in pile, lista, griglia e tabella, con raggruppa, ordina e cerca.

const SCRYFALL = {
  'id-sol': {
    name: 'Sol Ring',
    cmc: 1,
    type_line: 'Artifact',
    colors: [],
    mana_cost: '{1}',
    oracle_text: '{T}: Add {C}{C}.',
  },
  'id-counter': {
    name: 'Counterspell',
    cmc: 2,
    type_line: 'Instant',
    colors: ['U'],
    mana_cost: '{U}{U}',
    oracle_text: 'Counter target spell.',
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
  },
};
const CARDS = [
  { name: 'Sol Ring', qty: 1, scryfallId: 'id-sol' },
  { name: 'Counterspell', qty: 1, scryfallId: 'id-counter', isGameChanger: true },
  { name: 'Atraxa, Praetors Voice', qty: 1, scryfallId: 'id-atraxa' },
  { name: 'Island', qty: 10, scryfallId: 'id-island' },
  { name: 'Carta senza dati', qty: 1 },
];
const COMBOS = [{ cards: ['Sol Ring', 'Counterspell'], produces: ['Infinite mana'] }];

/** Scryfall finto con carte diverse tra loro (per id). */
async function mockCards(page) {
  await page.route('https://api.scryfall.com/cards/collection', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors });
    }
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
const withCards = (page, cards, combos = []) =>
  page.evaluate(
    ({ list, comboList }) => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      pinia._s.get('data').getDeck = async () => ({
        deck: { currentVersion: 1 },
        versions: [{ version: 1, cards: list, gameChangers: [], combos: comboList }],
      });
    },
    { list: cards, comboList: combos },
  );

async function openDeck(page) {
  await page.goto('/#/mazzi');
  await withCards(page, CARDS, COMBOS);
  await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();
  await expect(page.getByTestId('deck-cards')).toBeVisible();
  await expect(page.getByTestId('cards-count')).toHaveText('14 carte');
}

const isWide = (page) => page.viewportSize().width >= 768;
const groupKeys = (page) =>
  page
    .locator('[data-testid^="view-"] [data-group]')
    .evaluateAll((els) => els.map((e) => e.dataset.group));

test.describe('carte del mazzo @core', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfall(page);
    await mockCardImages(page);
    await mockCards(page);
  });

  test('pile su schermo largo, lista sul telefono, raggruppate per tipo @ui', async ({ page }) => {
    await openDeck(page);
    await expect(page.getByTestId(isWide(page) ? 'view-piles' : 'view-list')).toBeVisible();
    await expect
      .poll(() => groupKeys(page))
      .toEqual(['Creature', 'Instant', 'Artifact', 'Land', 'unknown']);
    await expect(page.locator('[data-group="Land"]')).toContainText('10');
    await expect(page.locator('[data-group="unknown"]')).toContainText('Sconosciute');
  });

  test('sul telefono la vista «Pile» non c’è, su schermo largo sì', async ({ page }) => {
    await openDeck(page);
    const options = await page.getByTestId('cards-view').locator('option').allTextContents();
    expect(options.includes('Pile')).toBe(isWide(page));
    expect(options).toEqual(expect.arrayContaining(['Lista', 'Griglia', 'Tabella']));
  });

  test('si cambia vista e in ogni vista ci sono tutte le carte @ui', async ({ page }) => {
    await openDeck(page);
    for (const [label, testId] of [
      ['Lista', 'view-list'],
      ['Griglia', 'view-grid'],
      ['Tabella', 'view-table'],
    ]) {
      await page.getByTestId('cards-view').selectOption({ label });
      await expect(page.getByTestId(testId)).toBeVisible();
      await expect(page.getByTestId(testId).getByTestId('card-item')).toHaveCount(5);
    }
    await expect(page.getByTestId('view-table')).toContainText('Counterspell');
  });

  test('si raggruppa per costo di mana e per colore', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Lista' });
    await page.getByTestId('cards-group').selectOption({ label: 'Costo di mana' });
    await expect.poll(() => groupKeys(page)).toEqual(['0', '1', '2', '4', 'unknown']);
    await page.getByTestId('cards-group').selectOption({ label: 'Colore' });
    await expect.poll(() => groupKeys(page)).toEqual(['U', 'M', 'C', 'unknown']);
  });

  test('si ordina per costo, anche al contrario', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Lista' });
    await page.getByTestId('cards-group').selectOption({ label: 'Colore' });
    const colorless = page.locator('[data-group="C"] .row__name');
    await expect(colorless).toHaveText(['Island', 'Sol Ring']);
    await page.getByTestId('cards-sort').selectOption({ label: 'Costo, dal più basso' });
    await expect(colorless).toHaveText(['Island', 'Sol Ring']);
    await page.getByTestId('cards-sort').selectOption({ label: 'Costo, dal più alto' });
    await expect(colorless).toHaveText(['Sol Ring', 'Island']);
  });

  test('la ricerca filtra per nome e dice quando non trova nulla', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Lista' });
    await page.getByTestId('cards-search').fill('sol');
    await expect(page.getByTestId('card-item')).toHaveText([/Sol Ring/]);
    await page.getByTestId('cards-search').fill('zzz');
    await expect(page.getByText('Nessuna carta trovata.')).toBeVisible();
    await expect(page.getByTestId('cards-count')).toHaveText('0 di 14 carte');
  });

  test('ricorda vista e raggruppamento dopo il ricaricamento', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Griglia' });
    await page.getByTestId('cards-group').selectOption({ label: 'Colore' });
    await page.goto('/#/mazzi');
    await page.reload();
    await withCards(page, CARDS);
    await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();
    await expect(page.getByTestId('cards-view')).toHaveValue('grid');
    await expect(page.getByTestId('cards-group')).toHaveValue('color');
  });

  test('la pagina non scorre in orizzontale in nessuna vista @ui', async ({ page }) => {
    await openDeck(page);
    const views = isWide(page)
      ? ['Pile', 'Lista', 'Griglia', 'Tabella']
      : ['Lista', 'Griglia', 'Tabella'];
    for (const label of views) {
      await page.getByTestId('cards-view').selectOption({ label });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, label).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('dettaglio carta @core', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfall(page);
    await mockCardImages(page);
    await mockCards(page);
  });

  const open = (page, name) =>
    page.getByTestId('card-item').filter({ hasText: name }).getByTestId('card-open').click();
  const dialog = (page) => page.getByRole('dialog');

  test('toccando una carta si apre il dettaglio, in ogni vista @ui', async ({ page }) => {
    await openDeck(page);
    const views = isWide(page)
      ? ['Pile', 'Lista', 'Griglia', 'Tabella']
      : ['Lista', 'Griglia', 'Tabella'];
    for (const label of views) {
      await page.getByTestId('cards-view').selectOption({ label });
      await open(page, 'Counterspell');
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole('heading', { name: 'Counterspell' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toBeHidden();
    }
  });

  test('mostra tipo, costo, testo, game changer, combo e quantità @ui', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Lista' });
    await open(page, 'Counterspell');
    const detail = page.getByTestId('card-detail');
    await expect(detail).toContainText('Instant');
    await expect(detail).toContainText('U U');
    await expect(detail).toContainText('Blu');
    await expect(detail).toContainText('Counter target spell.');
    await expect(page.getByTestId('detail-game-changer')).toBeVisible();
    await expect(page.getByTestId('detail-combos')).toContainText('Con Sol Ring');
    await expect(page.getByTestId('detail-combos')).toContainText('Infinite mana');
    await expect(page.getByTestId('detail-qty')).toHaveText('1');
  });

  test('le frecce passano alla carta precedente e successiva @ui', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Lista' });
    await open(page, 'Atraxa');
    await expect(page.getByTestId('card-position')).toHaveText('1 di 5');
    await expect(page.getByTestId('card-prev')).toBeDisabled();
    await page.getByTestId('card-next').click();
    await expect(dialog(page).getByRole('heading', { name: 'Counterspell' })).toBeVisible();
    await expect(page.getByTestId('card-position')).toHaveText('2 di 5');
    await page.getByTestId('card-prev').click();
    await expect(dialog(page).getByRole('heading', { name: /Atraxa/ })).toBeVisible();
    for (let i = 0; i < 4; i += 1) await page.getByTestId('card-next').click();
    await expect(page.getByTestId('card-position')).toHaveText('5 di 5');
    await expect(page.getByTestId('card-next')).toBeDisabled();
  });

  test('il tasto indietro chiude il dettaglio senza lasciare la scheda', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Lista' });
    await open(page, 'Sol Ring');
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/overlay=card/);
    await page.goBack();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId('deck-cards')).toBeVisible();
  });

  test('il pulsante chiude il dettaglio', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Lista' });
    await open(page, 'Sol Ring');
    await dialog(page).getByRole('button', { name: 'Chiudi la finestra' }).click();
    await expect(dialog(page)).toBeHidden();
  });

  test('una carta senza dati mostra nome e quantità', async ({ page }) => {
    await openDeck(page);
    await page.getByTestId('cards-view').selectOption({ label: 'Lista' });
    await open(page, 'Carta senza dati');
    await expect(dialog(page).getByRole('heading', { name: 'Carta senza dati' })).toBeVisible();
    await expect(page.getByTestId('card-detail')).toContainText('Dati della carta non disponibili');
    await expect(page.getByTestId('detail-qty')).toHaveText('1');
  });
});

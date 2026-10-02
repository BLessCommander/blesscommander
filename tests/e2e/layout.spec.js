import { test, expect } from './fixtures.js';

// B-04: layout responsive, navigazione mobile e temi (UC-30, UC-31, UC-32).
const PAGES = [
  '/',
  '/mazzi',
  '/importa',
  '/nuovo-tavolo',
  '/partite',
  '/statistiche',
  '/regolamento',
  '/gruppo',
  '/profilo',
];

const isPhone = (page) => page.viewportSize().width < 768;
const isDesktop = (page) => page.viewportSize().width >= 1024;

test('UC-30 giro responsive: tutte le pagine passano i controlli @ui', async ({
  page,
  uiChecks,
}) => {
  for (const path of PAGES) {
    await page.goto(`/#${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await uiChecks.check();
  }
});

test('UC-30 la navigazione giusta compare a ogni larghezza @ui', async ({ page }) => {
  await page.goto('/');
  const bottomNav = page.getByRole('navigation', { name: 'Navigazione rapida' });
  const sidebar = page.locator('.sidebar');
  if (isPhone(page)) {
    await expect(bottomNav).toBeVisible();
    await expect(sidebar).toBeHidden();
    await expect(page.getByRole('button', { name: 'Apri il menu' })).toBeVisible();
    await expect(page.locator('.header__profile')).toBeHidden();
  } else {
    await expect(page.getByRole('button', { name: 'Apri il menu' })).toBeHidden();
    await expect(page.locator('.header__profile')).toBeVisible();
    await expect(bottomNav).toBeHidden();
    await expect(sidebar).toBeVisible();
    const width = (await sidebar.boundingBox()).width;
    if (isDesktop(page)) expect(width).toBeGreaterThan(200);
    else expect(width).toBeLessThan(100);
  }
});

test('UC-30 il menu laterale si comprime e ricorda la scelta @ui', async ({ page }) => {
  test.skip(!isDesktop(page), 'solo da 1024px in su');
  await page.goto('/');
  const sidebar = page.locator('.sidebar');
  await page.getByRole('button', { name: 'Riduci il menu laterale' }).click();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeLessThan(100);
  await page.reload();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeLessThan(100);
  await page.getByRole('button', { name: 'Espandi il menu laterale' }).click();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeGreaterThan(200);
});

test('UC-31 il tasto indietro chiude il menu a scomparsa prima di cambiare pagina @ui', async ({
  page,
}) => {
  test.skip(!isPhone(page), 'solo telefono');
  await page.goto('/#/mazzi');
  await page.getByRole('button', { name: 'Apri il menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();
  await page.goBack();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/#\/mazzi$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mazzi' })).toBeVisible();
});

test('UC-30 il menu a scomparsa copre tutto lo schermo, barra in basso compresa @ui', async ({
  page,
}) => {
  test.skip(!isPhone(page), 'solo telefono');
  await page.goto('/#/mazzi');
  await page.getByRole('button', { name: 'Apri il menu' }).click();
  const panel = page.locator('.drawer__panel');
  await expect(panel).toBeVisible();
  const { width, height } = page.viewportSize();
  const box = await panel.boundingBox();
  expect(box.y).toBe(0);
  expect(box.y + box.height).toBe(height);
  // Sopra la barra in basso e sopra l'intestazione c'è la maschera, non l'app.
  const covered = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.className ?? '',
    { x: width - 4, y: height - 4 },
  );
  expect(covered).toContain('drawer__backdrop');
  const top = await page.evaluate(({ x }) => document.elementFromPoint(x, 4)?.className ?? '', {
    x: width - 4,
  });
  expect(top).toContain('drawer__backdrop');
  // Il contenuto del cassetto rispetta l'area sicura in alto.
  const padding = await panel.evaluate((el) => getComputedStyle(el).paddingTop);
  expect(padding).toBe('0px'); // nei browser di prova non c'è notch: vale env(...) = 0
});

test('UC-31 dal menu a scomparsa si raggiungono le voci secondarie @ui', async ({ page }) => {
  test.skip(!isPhone(page), 'solo telefono');
  await page.goto('/');
  await page.getByRole('button', { name: 'Apri il menu' }).click();
  await page
    .getByRole('dialog', { name: 'Menu' })
    .getByRole('link', { name: 'Regolamento' })
    .click();
  await expect(page).toHaveURL(/#\/regolamento$/);
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
});

test('UC-31 il tasto indietro chiude la finestra prima di cambiare pagina @ui', async ({
  page,
}) => {
  await page.goto('/#/profilo');
  await page.getByRole('button', { name: "Informazioni sull'app" }).click();
  const modal = page.getByRole('dialog', { name: 'Informazioni' });
  await expect(modal).toBeVisible();
  await page.goBack();
  await expect(modal).toBeHidden();
  await expect(page).toHaveURL(/#\/profilo$/);
});

test('UC-31 la finestra si chiude con Esc e con il pulsante @ui', async ({ page }) => {
  await page.goto('/#/profilo');
  const modal = page.getByRole('dialog', { name: 'Informazioni' });
  await page.getByRole('button', { name: "Informazioni sull'app" }).click();
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await page.getByRole('button', { name: "Informazioni sull'app" }).click();
  await modal.getByRole('button', { name: 'Chiudi la finestra' }).click();
  await expect(modal).toBeHidden();
});

test('UC-32 il tema scelto resta dopo il ricaricamento, con contrasto valido @ui', async ({
  page,
  uiChecks,
}) => {
  await page.goto('/#/profilo');
  await page.getByLabel('Scuro', { exact: true }).check({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await uiChecks.check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await uiChecks.check();
  await page.getByLabel('Chiaro', { exact: true }).check({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await uiChecks.check();
});

test('UC-32 il pulsante nell’intestazione cambia tema @ui', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Passa al tema scuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Passa al tema chiaro' })).toBeVisible();
});

import { mockScryfall } from '../fixtures/scryfall-fake.js';
import { mockSpellbook } from '../fixtures/spellbook-fake.js';
import { test, expect } from './fixtures.js';

// C-06 (UC-05): import da link di Archidekt. In demo l'Action `import` è simulata dal MockProvider
// (prima lettura "in attesa", poi un mazzo di esempio). Archidekt e Scryfall non vengono chiamate.

const open = async (page) => {
  await mockScryfall(page);
  await mockSpellbook(page);
  await page.goto('/#/importa');
  await page.getByLabel('Link di Archidekt').check();
};

test.describe('import da Archidekt @core', () => {
  test('il link viene scaricato e il mazzo importato ha comandante e carte @ui', async ({
    page,
  }) => {
    await open(page);
    await page
      .getByLabel('Link del mazzo su Archidekt')
      .fill('https://archidekt.com/decks/14637766/jodah');
    await page.getByRole('button', { name: 'Scarica il mazzo' }).click();
    await expect(page.getByTestId('import-waiting')).toBeVisible();
    await expect(page.getByTestId('import-preview')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('commanders')).toContainText("Atraxa, Praetors' Voice");
    await expect(page.getByTestId('card-row')).toHaveCount(4);
    await page.getByRole('button', { name: 'Avanti: autovalutazione' }).click();
    await page.getByTestId('wizard-save').click();
    await expect(page).toHaveURL(/#\/mazzi$/);
    await expect(
      page.locator('.deck__name').filter({ hasText: 'Mazzo di esempio (demo)' }),
    ).toBeVisible();
  });

  test('un link che non è di Archidekt viene respinto subito', async ({ page }) => {
    await open(page);
    await page.getByLabel('Link del mazzo su Archidekt').fill('https://example.com/mazzo');
    await page.getByRole('button', { name: 'Scarica il mazzo' }).click();
    await expect(page.getByTestId('import-error')).toContainText('link di un mazzo di Archidekt');
    await expect(page.getByTestId('import-waiting')).toHaveCount(0);
  });

  test('si può tornare alla lista incollata', async ({ page }) => {
    await open(page);
    await page.getByLabel('Incolla la lista').check();
    await expect(page.getByLabel('Lista del mazzo')).toBeVisible();
  });
});

// C-06b: mazzi di un utente. In demo l'elenco è finto (3 mazzi) e ogni mazzo scelto torna con la
// stessa lista di esempio. Il nick e il link di prova sono quelli del proprietario (nessuna rete).
test.describe('import dei mazzi di un utente Archidekt @core', () => {
  const openUser = async (page) => {
    await open(page);
    await page.getByLabel('Mazzi di un utente Archidekt').check();
  };

  test('cerca per nome utente, spunta due mazzi e li importa @ui', async ({ page }) => {
    test.setTimeout(60_000);
    await openUser(page);
    await page.getByLabel('Nome utente su Archidekt').fill('r3dl0g');
    await page.getByRole('button', { name: 'Cerca i mazzi' }).click();
    await expect(page.getByTestId('import-waiting')).toBeVisible();
    const list = page.getByTestId('user-decks');
    await expect(list).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '3 mazzi di r3dl0g' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Importa i mazzi scelti' })).toBeDisabled();

    await list.getByRole('checkbox', { name: 'Mazzo demo uno' }).check();
    await list.getByRole('checkbox', { name: 'Mazzo demo tre' }).check();
    await page.getByRole('button', { name: 'Importa 2 mazzi' }).click();
    await expect(page.getByTestId('import-summary')).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText('Tutti i 2 mazzi sono stati importati.')).toBeVisible();
    await expect(page.getByTestId('import-problems')).toHaveCount(0);

    await page.getByRole('link', { name: 'Vai ai mazzi' }).click();
    await expect(page).toHaveURL(/#\/mazzi$/);
    await expect(page.locator('.deck__name').filter({ hasText: 'Mazzo demo uno' })).toBeVisible();
    await expect(page.locator('.deck__name').filter({ hasText: 'Mazzo demo tre' })).toBeVisible();
    await expect(page.locator('.deck__name').filter({ hasText: 'Mazzo demo due' })).toHaveCount(0);
  });

  test('"Seleziona tutti" spunta e toglie tutti i mazzi', async ({ page }) => {
    await openUser(page);
    await page.getByLabel('Nome utente su Archidekt').fill('r3dl0g');
    await page.getByRole('button', { name: 'Cerca i mazzi' }).click();
    const list = page.getByTestId('user-decks');
    await expect(list).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Seleziona tutti').check();
    await expect(page.getByRole('button', { name: 'Importa 3 mazzi' })).toBeEnabled();
    await page.getByLabel('Seleziona tutti').uncheck();
    await expect(page.getByRole('button', { name: 'Importa i mazzi scelti' })).toBeDisabled();
  });

  test('senza nome utente il pulsante resta spento', async ({ page }) => {
    await openUser(page);
    await expect(page.getByRole('button', { name: 'Cerca i mazzi' })).toBeDisabled();
  });
});

test.describe('elenco mazzi di un utente: fascia e nomi @core', () => {
  test('ogni mazzo ha la sua fascia e il contatore dei selezionati @ui', async ({ page }) => {
    await open(page);
    await page.getByLabel('Mazzi di un utente Archidekt').check();
    await page.getByLabel('Nome utente su Archidekt').fill('r3dl0g');
    await page.getByRole('button', { name: 'Cerca i mazzi' }).click();
    const list = page.getByTestId('user-decks');
    await expect(list).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('0 di 3 selezionati')).toBeVisible();
    await expect(list.getByRole('combobox')).toHaveCount(3);
    await list.getByRole('combobox', { name: 'Fascia di Mazzo demo due' }).selectOption('F4');
    await list.getByRole('checkbox', { name: 'Mazzo demo due' }).check();
    await expect(page.getByText('1 di 3 selezionati')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Fascia dichiarata' })).toHaveCount(0);
  });
});

// Aggiornamento di un mazzo già importato. In demo la prima volta Archidekt "ha una carta in più".
test.describe('aggiorna il mazzo da Archidekt @core', () => {
  const importOne = async (page) => {
    await open(page);
    await page
      .getByLabel('Link del mazzo su Archidekt')
      .fill('https://archidekt.com/decks/14637766/jodah');
    await page.getByRole('button', { name: 'Scarica il mazzo' }).click();
    await expect(page.getByTestId('import-preview')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Avanti: autovalutazione' }).click();
    await page.getByTestId('wizard-save').click();
    await expect(page).toHaveURL(/#\/mazzi$/);
  };

  test('il tasto compare solo sui mazzi di Archidekt e mostra le modifiche, poi "già aggiornato" @ui', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await importOne(page);
    const resync = page.getByTestId('resync');
    await expect(resync).toHaveCount(1); // gli altri mazzi di esempio non vengono da Archidekt
    await expect(resync).toHaveText('Aggiorna da Archidekt');

    await resync.click();
    await expect(page.getByTestId('resync-status')).toContainText(
      'Mazzo aggiornato: 1 carta entrata.',
      { timeout: 30_000 },
    );

    await resync.click();
    await expect(page.getByTestId('resync-status')).toContainText('già aggiornato', {
      timeout: 30_000,
    });
  });
});

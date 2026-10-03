import { mockScryfall } from '../fixtures/scryfall-fake.js';
import { test, expect } from './fixtures.js';

// C-05 (UC-04): import del mazzo da testo incollato. Scryfall è intercettata (nessuna rete):
// ogni nome è trovato, tranne quelli che contengono "inesistente".

const hundred = () => {
  const body = Array.from({ length: 98 }, (_, i) => `1 Carta di prova ${i}`).join('\n');
  return `Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n${body}\n1 Rhystic Study`;
};

const paste = async (page, text) => {
  await mockScryfall(page);
  await page.goto('/#/importa');
  await page.getByLabel('Lista del mazzo').fill(text);
  await page.getByRole('button', { name: 'Controlla la lista' }).click();
  await expect(page.getByTestId('import-preview')).toBeVisible();
};

test.describe('import da testo @core', () => {
  test('100 carte con comandante: il mazzo viene creato e compare nell’elenco @ui', async ({
    page,
  }) => {
    await paste(page, hundred());
    await expect(page.getByTestId('commanders')).toContainText("Atraxa, Praetors' Voice");
    await expect(page.getByText('1 game changer trovato')).toBeVisible();
    await expect(page.getByTestId('not-found')).toHaveCount(0);
    await page.getByRole('button', { name: 'Salva il mazzo' }).click();
    await expect(page).toHaveURL(/#\/mazzi$/);
    await expect(
      page.locator('.deck__name').filter({ hasText: "Atraxa, Praetors' Voice" }),
    ).toBeVisible();
  });

  test('le carte non trovate sono elencate e bloccano il salvataggio @ui', async ({ page }) => {
    await paste(page, 'Commander\n1 Tymna the Weaver\n1 Sol Ring\n1 Carta inesistente');
    await expect(page.getByTestId('not-found')).toContainText('Carta inesistente');
    await expect(page.getByRole('button', { name: 'Salva il mazzo' })).toBeDisabled();
    await page.getByRole('button', { name: 'Modifica la lista' }).click();
    await expect(page.getByLabel('Lista del mazzo')).toHaveValue(/Carta inesistente/);
  });

  test('le carte a due facce col nome completo "A // B" si trovano e si salvano', async ({
    page,
  }) => {
    await paste(
      page,
      'Commander\n1 Esika, God of the Tree // The Prismatic Bridge\n\nDeck\n1 Fire // Ice\n1 Lim-Dul the Necromancer',
    );
    await expect(page.getByTestId('not-found')).toHaveCount(0);
    await expect(page.getByTestId('commanders')).toContainText(
      'Esika, God of the Tree // The Prismatic Bridge',
    );
    await page.getByRole('button', { name: 'Salva il mazzo' }).click();
    await expect(page).toHaveURL(/#\/mazzi$/);
    await expect(
      page.getByText('Esika, God of the Tree // The Prismatic Bridge').first(),
    ).toBeVisible();
  });

  test('senza comandante si sceglie dall’elenco, anche più di uno', async ({ page }) => {
    await paste(page, '1 Tymna the Weaver\n1 Thrasios, Triton Hero\n1 Sol Ring');
    await expect(page.getByTestId('import-reasons')).toContainText('Scegli almeno un comandante');
    await expect(page.getByRole('button', { name: 'Salva il mazzo' })).toBeDisabled();

    const row = (name) => page.getByTestId('card-row').filter({ hasText: name });
    await row('Tymna').getByRole('button', { name: 'Comandante', pressed: false }).click();
    await row('Thrasios').getByRole('button', { name: 'Comandante', pressed: false }).click();
    await expect(page.getByTestId('commanders').locator('.chip')).toHaveText([
      'Tymna the Weaver',
      'Thrasios, Triton Hero',
    ]);
    await expect(page.getByRole('button', { name: 'Salva il mazzo' })).toBeEnabled();

    await row('Tymna').getByRole('button', { name: 'Comandante', pressed: true }).click();
    await expect(page.getByTestId('commanders').locator('.chip')).toHaveText([
      'Thrasios, Triton Hero',
    ]);
  });

  test('il doppio click su una carta la imposta come comandante', async ({ page }) => {
    await paste(page, '1 Sol Ring\n1 Krenko, Mob Boss');
    await page
      .getByTestId('card-row')
      .filter({ hasText: 'Krenko' })
      .locator('.card-row__name')
      .dblclick();
    await expect(page.getByTestId('commanders')).toContainText('Krenko, Mob Boss');
  });

  test('se Scryfall non risponde si resta nel modulo con la lista intatta', async ({ page }) => {
    await page.route('https://api.scryfall.com/**', (route) => route.abort());
    await page.goto('/#/importa');
    await page.getByLabel('Lista del mazzo').fill('1 Sol Ring');
    await page.getByRole('button', { name: 'Controlla la lista' }).click();
    await expect(page.getByTestId('import-error')).toContainText(
      'Non riesco a contattare Scryfall',
    );
    await expect(page.getByLabel('Lista del mazzo')).toHaveValue('1 Sol Ring');
  });

  test('una lista vuota dà un messaggio chiaro', async ({ page }) => {
    await page.goto('/#/importa');
    await page.getByLabel('Lista del mazzo').fill('// solo un commento');
    await page.getByRole('button', { name: 'Controlla la lista' }).click();
    await expect(page.getByTestId('import-error')).toContainText('La lista è vuota');
  });

  test('la pagina Mazzi ha il pulsante per importare', async ({ page }) => {
    await page.goto('/#/mazzi');
    await page.getByRole('link', { name: 'Importa mazzo' }).click();
    await expect(page).toHaveURL(/#\/importa$/);
  });
});

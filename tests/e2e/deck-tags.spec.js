import { mockCardImages, mockScryfall } from '../fixtures/scryfall-fake.js';
import { test, expect } from './fixtures.js';

// C-08e: tag ai mazzi (scheda del mazzo) e filtro per tag (pagina Mazzi). Dati demo.

test.describe('tag dei mazzi @core', () => {
  test.beforeEach(async ({ page }) => {
    await mockScryfall(page);
    await mockCardImages(page);
  });

  const addTag = async (page, text) => {
    await page.getByTestId('tag-input').fill(text);
    await page.getByTestId('tag-add').click();
  };

  test('si aggiunge e si toglie un tag dalla scheda del mazzo @ui', async ({ page }) => {
    await page.goto('/#/mazzi');
    await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();
    const tags = page.getByTestId('deck-tags');
    await expect(tags).toContainText('Nessun tag.');

    await addTag(page, '  veloce ');
    await expect(tags.locator('.tag__name')).toHaveText(['veloce']);
    await expect(page.getByTestId('tag-input')).toHaveValue('');

    await addTag(page, 'Combo');
    await expect(tags.locator('.tag__name')).toHaveText(['veloce', 'Combo']);

    await tags.getByRole('button', { name: 'Togli il tag veloce' }).click();
    await expect(tags.locator('.tag__name')).toHaveText(['Combo']);
  });

  test('rifiuta un doppione con un messaggio chiaro', async ({ page }) => {
    await page.goto('/#/mazzi');
    await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();
    await addTag(page, 'veloce');
    await addTag(page, 'VELOCE');
    await expect(page.getByTestId('tag-error')).toHaveText('Questo tag c’è già.');
    await expect(page.getByTestId('deck-tags').locator('.tag__name')).toHaveText(['veloce']);
  });

  test('il filtro per tag mostra solo i mazzi con quel tag @ui', async ({ page }) => {
    await page.goto('/#/mazzi');
    await expect(page.getByTestId('tag-filter')).toHaveCount(0); // nessun tag, nessun filtro
    await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();
    await addTag(page, 'veloce');
    await page.getByRole('link', { name: /Tutti i mazzi/ }).click();

    const filter = page.getByTestId('tag-filter');
    await expect(filter.locator('option')).toHaveText(['Tutti i tag', 'veloce (1)']);
    await expect(page.getByTestId('deck-tags-list')).toContainText('veloce');

    await filter.selectOption({ label: 'veloce (1)' });
    await expect(page.locator('.deck__name')).toHaveText(['Mazzo Ottimizzato']);
    await expect(page.locator('.deck-group')).toHaveCount(1);

    await filter.selectOption({ label: 'Tutti i tag' });
    await expect(page.locator('.deck-group')).toHaveCount(4);
  });

  test('i tag dei mazzi altrui si vedono ma non si modificano', async ({ page }) => {
    await page.goto('/#/mazzi');
    await page.getByTestId('expand-all').click();
    await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      const store = pinia._s.get('data');
      store.user = { ...store.user, role: 'giocatore' };
    });
    await page.getByRole('link', { name: 'Mazzo Base' }).click();
    await expect(page.getByTestId('deck-tags')).toBeVisible();
    await expect(page.getByTestId('tag-input')).toHaveCount(0);
  });
});

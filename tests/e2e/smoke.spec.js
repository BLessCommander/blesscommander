import { test, expect } from './fixtures.js';

// Prova dell'infrastruttura (B-03): la pagina si apre e passa i controlli automatici di §3.
test('il regolamento mostra le cinque fasce @core @ui', async ({ page }) => {
  await page.goto('/#/regolamento');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.tier')).toHaveCount(5);
});

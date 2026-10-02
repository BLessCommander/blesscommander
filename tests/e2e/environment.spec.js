import { test, expect } from './fixtures.js';

// UC-27 (parte demo): app in modalità demo con banner e schermata Ambiente.
test('la demo mostra il banner e la schermata Ambiente @core @ui', async ({ page }) => {
  await page.goto('/#/ambiente');
  await expect(page.getByRole('heading', { level: 1, name: 'Ambiente' })).toBeVisible();
  await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
  await expect(page.locator('.env-list')).toContainText('DEMO LOCALE');
  await expect(page.getByTestId('connection-status')).toHaveCount(0);
});

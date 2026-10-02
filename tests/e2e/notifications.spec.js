import { test, expect } from './fixtures.js';

// C-04c (UC-65): centro notifiche. Demo locale: 3 notifiche di prova, 1 con risposta sì/no.
test.describe('centro notifiche @core', () => {
  test('campanella con contatore, lettura e risposta @ui', async ({ page }) => {
    await page.goto('/#/');
    const count = page.getByTestId('bell-count');
    await expect(count).toHaveText('3');
    await expect(page.getByTestId('bell')).toHaveAccessibleName('Notifiche: 3 non lette');

    await page.getByTestId('bell').click();
    await expect(page).toHaveURL(/#\/notifiche/);
    const items = page.getByTestId('notification');
    await expect(items).toHaveCount(3);
    await expect(items.first()).toContainText("sostituire l'admin");

    // La domanda con azioni: si risponde sì, diventa letta e mostra la risposta.
    await page.getByTestId('answer-yes').click();
    await expect(page.getByTestId('answered')).toContainText('Hai risposto: sì');
    await expect(count).toHaveText('2');

    // Una singola notifica come letta.
    await items.nth(1).getByTestId('mark-read').click();
    await expect(count).toHaveText('1');

    // Tutte come lette: il contatore sparisce.
    await page.getByTestId('mark-all-read').click();
    await expect(count).toHaveCount(0);
    await expect(page.locator('[data-testid="notification"][data-read="false"]')).toHaveCount(0);
  });
});

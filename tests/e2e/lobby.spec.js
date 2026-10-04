import { test, expect } from './fixtures.js';

// C-09 / UC-09: lobby. Crea un tavolo da 4 con i mazzi demo, sceglie il registratore e inizia.
// Dati demo: l'utente è `demo-admin`, ogni giocatore ha un solo mazzo.

test.describe('lobby @core', () => {
  test('crea un tavolo da 4 e mostra il promemoria del dado @ui', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    await expect(page.getByRole('heading', { name: 'Nuovo tavolo', level: 1 })).toBeVisible();

    // Chi crea il tavolo è già seduto; il pulsante resta spento finché mancano i giocatori.
    const start = page.getByTestId('lobby-start');
    await expect(start).toBeDisabled();
    await expect(page.getByTestId('lobby-problems')).toContainText('Mancano dei giocatori.');

    for (const login of ['demo-giocatore1', 'demo-giocatore2', 'demo-giocatore3']) {
      await page.getByTestId(`lobby-player-${login}`).locator('label.seat__main').click();
    }
    await expect(page.getByTestId('lobby-problems')).toHaveCount(0);
    await expect(start).toBeEnabled();

    // Il primo giocatore e il registratore (di default chi crea il tavolo).
    await expect(page.getByTestId('lobby-recorder')).toHaveValue('demo-admin');
    await page.getByTestId('lobby-first').selectOption('demo-giocatore2');

    await start.click();
    const reminder = page.getByTestId('lobby-reminder');
    await expect(reminder).toBeVisible();
    await expect(page.getByTestId('dice-reminder')).toHaveText(
      'Metti il dado su 1 accanto a Giocatore 2.',
    );
    await expect(reminder.locator('ol li')).toHaveCount(4);
    await expect(reminder.locator('ol li').first()).toContainText('Posto 1 · Giocatore 2');
  });

  test('il promemoria ricompare se si riapre la pagina durante la partita', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    for (const login of ['demo-giocatore1', 'demo-giocatore2', 'demo-giocatore3']) {
      await page.getByTestId(`lobby-player-${login}`).locator('label.seat__main').click();
    }
    await page.getByTestId('lobby-start').click();
    await expect(page.getByTestId('lobby-reminder')).toBeVisible();

    await page.goto('/#/mazzi');
    await page.goto('/#/nuovo-tavolo');
    await expect(page.getByTestId('lobby-reminder')).toBeVisible();
    await expect(page.getByTestId('lobby-start')).toHaveCount(0);
  });

  test('un altro registratore vede chi girerà il dado', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    for (const login of ['demo-giocatore1', 'demo-giocatore2', 'demo-giocatore3']) {
      await page.getByTestId(`lobby-player-${login}`).locator('label.seat__main').click();
    }
    await page.getByTestId('lobby-recorder').selectOption('demo-giocatore1');
    await page.getByTestId('lobby-start').click();
    await expect(page.getByTestId('dice-reminder')).toContainText(
      'Giocatore 1 è il registratore: metterà il dado su 1 accanto a',
    );
  });

  test('il formato a 3 non accetta un quarto giocatore', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    await page.getByTestId('lobby-format').selectOption('ffa3');
    for (const login of ['demo-giocatore1', 'demo-giocatore2']) {
      await page.getByTestId(`lobby-player-${login}`).locator('label.seat__main').click();
    }
    await expect(
      page.getByTestId('lobby-player-demo-giocatore3').getByRole('checkbox'),
    ).toBeDisabled();
    await expect(page.getByTestId('lobby-start')).toBeEnabled();
  });
});

import { test, expect } from './fixtures.js';
import { setupTableF2 } from './lobby-helpers.js';

// C-10c: «Partite in corso». Si riprende la partita da una sezione del menu, senza passare dalla lobby.
// Dati demo: l'utente è `demo-admin`.

const startTable = async (page, { recorder } = {}) => {
  await setupTableF2(page);
  if (recorder) await page.getByTestId('lobby-recorder').selectOption(recorder);
  await page.getByTestId('lobby-start').click();
  await expect(page.getByTestId('lobby-reminder')).toBeVisible();
};

test.describe('partite in corso @core', () => {
  test('senza partite la pagina è vuota e rimanda al nuovo tavolo @ui', async ({ page }) => {
    await page.goto('/#/in-corso');
    await expect(page.getByRole('heading', { name: 'Partite in corso', level: 1 })).toBeVisible();
    await expect(page.getByTestId('live-empty')).toContainText('Nessuna partita in corso.');
    await expect(page.getByTestId('live-badge')).toHaveCount(0);
    await expect(
      page.getByTestId('live-empty').getByRole('link', { name: 'Nuovo tavolo' }),
    ).toHaveAttribute('href', '#/nuovo-tavolo');
  });

  test('dopo «Inizia» la partita si ritrova nell’elenco e si chiude da lì @ui', async ({
    page,
  }) => {
    await startTable(page);

    // Si esce dalla lobby e si torna: la partita è nell'elenco con promemoria, posti e «Chiudi».
    await page.goto('/#/mazzi');
    await page.goto('/#/in-corso');
    const list = page.getByTestId('live-list');
    await expect(list.locator('li.game')).toHaveCount(1);
    await expect(page.getByTestId('live-dice')).toContainText('Metti il dado su 1 accanto a');
    await expect(list.locator('ol li')).toHaveCount(4);
    await expect(list).toContainText('Fascia del tavolo: F2');

    await page.getByTestId('live-close').click();
    await expect(page.getByRole('heading', { name: 'Chiudi partita', level: 1 })).toBeVisible();
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    await page.getByTestId('close-turn-input').fill('5');
    await page.getByTestId('close-wintype').getByRole('radio', { name: 'Combo' }).check();
    await page.getByTestId('close-save').click();
    await expect(page.getByTestId('close-done')).toBeVisible();

    // Chiusa: sparisce dall'elenco.
    await page.goto('/#/in-corso');
    await expect(page.getByTestId('live-empty')).toBeVisible();
  });

  test('una voce del menu con il numero delle partite aperte', async ({ page }) => {
    await startTable(page);
    // Sul telefono il menu si apre dal pulsante; da 768px c'è già la barra laterale (a icone o estesa).
    const menuButton = page.getByRole('button', { name: 'Apri il menu' });
    const phone = await menuButton.isVisible();
    if (phone) await menuButton.click();
    const menu = phone ? page.getByRole('dialog', { name: 'Menu' }) : page.locator('.sidebar');
    await expect(menu.getByTestId('live-badge')).toHaveText('1');
    await menu.getByRole('link', { name: 'In corso' }).click();
    await expect(page.getByTestId('live-list')).toBeVisible();
  });

  test('chi non è registratore vede il registratore e nessun pulsante di chiusura', async ({
    page,
  }) => {
    await startTable(page, { recorder: 'demo-giocatore1' });
    await page.goto('/#/in-corso');
    await expect(page.getByTestId('live-list')).toContainText('Registratore: Giocatore 1');
    await expect(page.getByTestId('live-close')).toHaveCount(0);
    await expect(page.getByTestId('live-not-recorder')).toBeVisible();
  });
});

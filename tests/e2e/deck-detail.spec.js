import { test, expect } from './fixtures.js';

// C-08 (UC-18): la scheda di un mazzo con metriche, storico fasce, tipi di vittoria e avversari.

/** Aggiunge allo snapshot demo cambi di fascia e statistiche, come farebbe il ricalcolo. */
const addHistory = (page) =>
  page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const snapshot = pinia.state.value.data.snapshot;
    const deck = snapshot.decks.find((d) => d.name === 'Mazzo Ottimizzato');
    deck.tier = { current: 'F4', tmv: 5.4, dominance: 1.85, status: 'stabile' };
    deck.stats = { games: 1, wins: 1, winTypes: { combattimento: 2, combo: 1 } };
    snapshot.events = [
      {
        id: 'g1:' + deck.id,
        deckId: deck.id,
        gameId: 'g1',
        from: 'F3',
        to: 'F4',
        reasons: ['vince in media al turno 5,4'],
        createdAt: '2026-02-01T20:00:00Z',
      },
    ];
  });

test.describe('scheda mazzo @core', () => {
  test('si apre dall’elenco e mostra metriche, storico, tipi di vittoria e avversari @ui', async ({
    page,
  }) => {
    await page.goto('/#/mazzi');
    await addHistory(page);
    await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Mazzo Ottimizzato' })).toBeVisible();
    await expect(page.getByTestId('metric-tmv')).toHaveText('5.4');
    await expect(page.getByTestId('metric-dominance')).toHaveText('1.85');

    const history = page.getByTestId('deck-history');
    await expect(history.locator('li')).toHaveCount(2);
    await expect(history).toContainText('Fascia di partenza');
    await expect(history).toContainText('2026-02-01');
    await expect(history.getByRole('img')).toHaveAttribute('aria-label', /F3, poi F4/);

    const wins = page.getByTestId('deck-wintypes');
    await expect(wins).toContainText('combattimento');
    await expect(wins.getByRole('img')).toHaveAttribute('aria-label', /combattimento 2, combo 1/);

    // La partita demo è vinta da questo mazzo: gli altri tre risultano battuti.
    await expect(page.getByTestId('deck-opponents')).toContainText('1 volta');
    await expect(page.getByTestId('deck-features')).toContainText('Game changer');
  });

  test('torna all’elenco e gestisce un mazzo inesistente', async ({ page }) => {
    await page.goto('/#/mazzi/non-esiste');
    await expect(page.getByRole('alert')).toContainText('Mazzo non trovato');
    await page.getByRole('link', { name: /Tutti i mazzi/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mazzi' })).toBeVisible();
  });

  test('senza dati calcolati mostra messaggi chiari @ui', async ({ page }) => {
    await page.goto('/#/mazzi');
    await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();
    await expect(page.getByTestId('metric-tmv')).toHaveText('Non ancora calcolato');
    await expect(page.getByTestId('deck-history')).toContainText('Nessun cambio di fascia');
  });
});

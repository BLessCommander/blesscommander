import { test, expect } from './fixtures.js';

// C-13 / UC-21 e UC-67: storico partite con filtri e pagina di dettaglio. L'utente demo è `demo-admin`.
// Nel demo c'è una sola partita ufficiale (4 giocatori, vince `demo-admin`, 1 febbraio 2026).

/** Aggiunge due partite ufficiali allo snapshot, come farebbe il ricalcolo. */
const addGames = (page) =>
  page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const snapshot = pinia.state.value.data.snapshot;
    const [first] = snapshot.games;
    const copy = (id, extra) => ({
      ...JSON.parse(JSON.stringify(first)),
      id,
      ...extra,
    });
    const decks = snapshot.decks;
    snapshot.games.push(
      copy('g-marzo', {
        formatId: 'ffa3',
        tableTier: 'F3',
        createdAt: '2026-03-05T20:00:00Z',
        endedAt: '2026-03-05T22:00:00Z',
        players: first.players.slice(0, 3).map((p, i) => ({
          ...p,
          seat: i + 1,
          ...(i === 2 ? { eliminatedTurn: 5, eliminatedBy: 'Mazzo Esibizione' } : {}),
        })),
        winners: [{ login: first.players[0].login, deckId: first.players[0].deckId }],
        winType: 'combo',
        winTurn: 6,
        turnSource: 'stima',
        winCombos: [{ cards: ['Carta Uno', 'Carta Due'] }],
        winCards: ['Carta Uno'],
      }),
      copy('g-aprile', {
        tableTier: 'F2',
        createdAt: '2026-04-10T20:00:00Z',
        endedAt: '2026-04-10T22:00:00Z',
        winners: [{ login: first.players[0].login, deckId: first.players[0].deckId }],
        winType: 'creature',
        winTurn: 9,
      }),
    );
    return decks.length;
  });

test.describe('storico partite @core', () => {
  test('UC-21: elenco dalla più recente e filtri combinati @ui', async ({ page }) => {
    await page.goto('/#/partite');
    await expect(page.getByTestId('match')).toHaveCount(1);
    await addGames(page);
    await page.goto('/#/mazzi');
    await page.goto('/#/partite');
    await expect(page.getByRole('heading', { name: 'Partite', level: 1 })).toBeVisible();

    const rows = page.getByTestId('match');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('2026-04-10');
    await expect(page.getByTestId('matches-count')).toHaveText('3 partite');

    // I filtri sono chiusi sul telefono e aperti sullo schermo largo: si aprono se serve.
    const filters = page.getByTestId('matches-filters');
    if ((await filters.getAttribute('open')) === null) {
      await filters.locator('.filters__summary').click();
    }

    await page.getByTestId('filter-format').selectOption('ffa3');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('2026-03-05');
    await expect(rows.first()).toContainText('turno 6 (stimato)');
    await expect(page.getByTestId('matches-count')).toHaveText('1 partita su 3');

    await page.getByTestId('filter-format').selectOption('');
    await page.getByTestId('filter-from').fill('2026-03-01');
    await expect(rows).toHaveCount(2);
    await page.getByTestId('filter-to').fill('2026-03-31');
    await expect(rows).toHaveCount(1);

    await page.getByTestId('filters-reset').click();
    await expect(rows).toHaveCount(3);

    await page.getByTestId('filter-wintype').selectOption('creature');
    await expect(rows).toHaveCount(1);
    await page.getByTestId('filter-tier').selectOption('F3');
    await expect(page.getByTestId('matches-no-results')).toContainText('Nessuna partita');
  });

  test('filtra per mazzo, giocatore ed esito personale', async ({ page }) => {
    await page.goto('/#/partite');
    await expect(page.getByTestId('match')).toHaveCount(1);
    await addGames(page);
    await page.goto('/#/mazzi');
    await page.goto('/#/partite');
    const filters = page.getByTestId('matches-filters');
    if ((await filters.getAttribute('open')) === null) {
      await filters.locator('.filters__summary').click();
    }
    const rows = page.getByTestId('match');

    // Il quarto giocatore (Mazzo Ottimizzato) manca alla partita di marzo.
    await page.getByTestId('filter-deck').selectOption({ label: 'Mazzo Ottimizzato' });
    await expect(rows).toHaveCount(2);

    // L'utente demo (quarto posto) ha vinto solo il 1 febbraio, ha perso ad aprile e non c'era a marzo.
    await page.getByTestId('filter-deck').selectOption('');
    await page.getByTestId('filter-result').selectOption('lost');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('2026-04-10');
    await page.getByTestId('filter-result').selectOption('won');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('2026-02-01');
  });

  test('UC-67: la pagina di dettaglio mostra vincitore, combo ed eliminazioni @ui', async ({
    page,
  }) => {
    await page.goto('/#/partite');
    await expect(page.getByTestId('match')).toHaveCount(1);
    await addGames(page);
    await page.goto('/#/mazzi');
    await page.goto('/#/partite');

    const filters = page.getByTestId('matches-filters');
    if ((await filters.getAttribute('open')) === null) {
      await filters.locator('.filters__summary').click();
    }
    await page.getByTestId('filter-format').selectOption('ffa3');
    await page.getByTestId('match').first().getByRole('link').click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('2026-03-05');
    await expect(page.getByTestId('match-summary')).toContainText('turno 6 (stimato)');
    await expect(page.getByTestId('match-summary')).toContainText('Combo');
    await expect(page.getByTestId('match-summary')).toContainText('Carta Uno + Carta Due');
    const players = page.getByTestId('match-players');
    await expect(players.locator('li')).toHaveCount(3);
    await expect(players).toContainText('eliminato al turno 5 da Mazzo Esibizione');
    await expect(players.locator('li[data-won="true"]')).toHaveCount(1);

    await page.getByRole('link', { name: /Tutte le partite/ }).click();
    await expect(page.getByRole('heading', { name: 'Partite', level: 1 })).toBeVisible();
  });

  test('una partita inesistente dà un messaggio chiaro', async ({ page }) => {
    await page.goto('/#/partite/non-esiste');
    await expect(page.getByRole('alert')).toContainText('Partita non trovata');
  });

  test('senza partite ufficiali la pagina lo spiega @ui', async ({ page }) => {
    await page.goto('/#/partite');
    await expect(page.getByTestId('match')).toHaveCount(1);
    await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      pinia.state.value.data.snapshot.games = [];
    });
    await expect(page.getByTestId('matches-empty')).toContainText('Nessuna partita ufficiale');
  });
});

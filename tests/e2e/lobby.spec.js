import { test, expect } from './fixtures.js';
import { PLAYERS, addF2Decks, seat, setupTableF2 } from './lobby-helpers.js';

// C-09 / UC-09: lobby. Crea un tavolo da 4 con i mazzi demo, sceglie fascia e registratore e inizia.
// Dati demo: l'utente è `demo-admin`; i mazzi F2 si completano con `addF2Decks`.

const deckOptions = (page, name) =>
  page.getByLabel(`Mazzo di ${name}`).locator('option:not([disabled])');

test.describe('lobby @core', () => {
  test('crea un tavolo da 4 e mostra il promemoria del dado @ui', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    await expect(page.getByRole('heading', { name: 'Nuovo tavolo', level: 1 })).toBeVisible();

    // Chi crea il tavolo è già seduto; il pulsante resta spento finché mancano fascia e giocatori.
    const start = page.getByTestId('lobby-start');
    await expect(start).toBeDisabled();
    await expect(page.getByTestId('lobby-problems')).toContainText('Mancano dei giocatori.');
    await expect(page.getByTestId('lobby-problems')).toContainText('Scegli la fascia del tavolo.');

    await page.getByTestId('lobby-tier').waitFor();
    await addF2Decks(page);
    await page.getByTestId('lobby-tier').selectOption('F2');
    for (const login of PLAYERS) await seat(page, login).click();
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
    await expect(page.getByTestId('reminder-tier')).toHaveText('Fascia del tavolo: F2');
    await expect(reminder.locator('ol li')).toHaveCount(4);
    await expect(reminder.locator('ol li').first()).toContainText('Posto 1 · Giocatore 2');
    // Ogni posto porta il nome del mazzo, anche se lo store nel frattempo si è ricaricato.
    await expect(reminder.locator('ol li')).toHaveText([
      /Posto 1 · Giocatore 2 · .+/,
      /Posto 2 · Giocatore 3 · .+/,
      /Posto 3 · Admin demo · .+/,
      /Posto 4 · Giocatore 1 · .+/,
    ]);
    await expect(reminder.locator('ol')).not.toContainText('mazzo non trovato');
  });

  test('ai giocatori si offrono solo i mazzi della fascia del tavolo', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    await page.getByTestId('lobby-start').waitFor();
    await addF2Decks(page);
    await seat(page, 'demo-giocatore1').click();

    // Senza fascia non si può scegliere nessun mazzo.
    await expect(deckOptions(page, 'Admin demo')).toHaveCount(0);
    await expect(page.getByLabel('Mazzo di Admin demo')).toBeDisabled();

    // F2: Admin demo e Giocatore 1 hanno un mazzo F2 aggiunto, non quelli di altre fasce.
    await page.getByTestId('lobby-tier').selectOption('F2');
    await expect(deckOptions(page, 'Admin demo')).toHaveText(['Admin F2 (F2)']);
    await expect(deckOptions(page, 'Giocatore 1')).toHaveText(['Uno F2 (F2)']);

    // F4: solo il mazzo F4 dell'admin; Giocatore 1 non ne ha e il tavolo non può partire.
    await page.getByTestId('lobby-tier').selectOption('F4');
    await expect(deckOptions(page, 'Admin demo')).toHaveText(['Mazzo Ottimizzato (F4)']);
    await expect(deckOptions(page, 'Giocatore 1')).toHaveCount(0);
    await expect(page.getByLabel('Mazzo di Giocatore 1')).toContainText(
      'Nessun mazzo di fascia F4',
    );
    await expect(page.getByTestId('lobby-start')).toBeDisabled();
    await expect(page.getByTestId('lobby-problems')).toContainText(
      'Scegli un mazzo per ogni giocatore.',
    );

    // Tornando a F2 i mazzi tornano a essere scelti da soli.
    await page.getByTestId('lobby-tier').selectOption('F2');
    await expect(page.getByLabel('Mazzo di Giocatore 1')).toHaveValue(/^01DMTEST/);
  });

  test('riaprendo la pagina durante la partita il modulo c’è ancora e rimanda a «In corso»', async ({
    page,
  }) => {
    await setupTableF2(page);
    await page.getByTestId('lobby-start').click();
    await expect(page.getByTestId('lobby-reminder')).toBeVisible();

    await page.goto('/#/mazzi');
    await expect(page.getByRole('heading', { name: 'Mazzi', level: 1 })).toBeVisible();
    await page.goto('/#/nuovo-tavolo');
    await expect(page.getByTestId('lobby-reminder')).toHaveCount(0);
    await expect(page.getByTestId('lobby-start')).toBeVisible();
    await expect(page.getByTestId('lobby-open-games')).toContainText('1 partita in corso');
    await page.getByTestId('lobby-open-games').getByRole('link').click();
    await expect(page.getByTestId('live-list')).toBeVisible();
  });

  test('si può avviare un altro tavolo mentre una partita è in corso', async ({ page }) => {
    await setupTableF2(page);
    await page.getByTestId('lobby-start').click();
    await expect(page.getByTestId('lobby-reminder')).toBeVisible();

    await page.getByTestId('lobby-another').click();
    await expect(page.getByTestId('lobby-start')).toBeVisible();
    await addF2Decks(page);
    await page.getByTestId('lobby-tier').selectOption('F2');
    for (const login of PLAYERS) await seat(page, login).click();
    await page.getByTestId('lobby-start').click();
    await expect(page.getByTestId('lobby-reminder')).toBeVisible();

    await page.getByTestId('lobby-to-live').click();
    await expect(page.getByTestId('live-list').locator('li.game')).toHaveCount(2);
  });

  test('un altro registratore vede chi girerà il dado', async ({ page }) => {
    await setupTableF2(page);
    await page.getByTestId('lobby-recorder').selectOption('demo-giocatore1');
    await page.getByTestId('lobby-start').click();
    await expect(page.getByTestId('dice-reminder')).toContainText(
      'Giocatore 1 è il registratore: metterà il dado su 1 accanto a',
    );
  });

  test('le altre modalità ci sono ma sono inibite («in arrivo»)', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    // Modalità di tavolo e ruoli nascosti: 11 voci, solo le prime due (a 4 e a 3) si possono scegliere.
    const format = page.getByTestId('lobby-format');
    await expect(format.locator('option')).toHaveCount(11);
    await expect(format.locator('option:not([disabled])')).toHaveText([
      'Tutti contro tutti (4 giocatori)',
      'Tutti contro tutti a 3 (3 giocatori)',
    ]);
    await expect(format.locator('option', { hasText: 'Treachery' })).toHaveAttribute(
      'disabled',
      '',
    );
    await expect(format.locator('option', { hasText: 'Treachery' })).toContainText('in arrivo');

    // Costruzione del mazzo: 16 voci, solo Commander (EDH) attiva.
    const building = page.getByTestId('lobby-deck-building');
    await expect(building.locator('option')).toHaveCount(16);
    await expect(building.locator('option:not([disabled])')).toHaveText(['Commander (EDH)']);

    // Carte e opzioni di tavolo: 7 caselle, tutte spente e non selezionabili.
    const boxes = page.getByTestId('lobby-options').getByRole('checkbox');
    await expect(boxes).toHaveCount(7);
    for (const box of await boxes.all()) await expect(box).toBeDisabled();
    await expect(page.getByTestId('lobby-soon-hint')).toContainText('Commander classico a 3 e 4');
  });

  test('il formato a 3 non accetta un quarto giocatore', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    await page.getByTestId('lobby-start').waitFor();
    await addF2Decks(page);
    await page.getByTestId('lobby-tier').selectOption('F2');
    await page.getByTestId('lobby-format').selectOption('ffa3');
    for (const login of ['demo-giocatore1', 'demo-giocatore2']) await seat(page, login).click();
    await expect(
      page.getByTestId('lobby-player-demo-giocatore3').getByRole('checkbox'),
    ).toBeDisabled();
    await expect(page.getByTestId('lobby-start')).toBeEnabled();
  });
});

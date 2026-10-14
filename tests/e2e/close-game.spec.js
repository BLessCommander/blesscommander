import { test, expect } from './fixtures.js';
import { addF2Decks, seat, setupTableF2 } from './lobby-helpers.js';

// C-10 / UC-10…UC-14: chiusura della partita. L'utente demo è `demo-admin`.

/** Partita provvisoria o dello snapshot, letta dallo store (nel demo la scrittura è subito nello snapshot). */
const gameInStore = (page, id) =>
  page.evaluate((gameId) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    return pinia.state.value.data.snapshot.games.find((g) => g.id === gameId) ?? null;
  }, id);

/** Siede i tre giocatori demo con mazzi F2 e avvia la partita (registratore: l'admin, o quello indicato). */
async function startGame(page, { recorder } = {}) {
  await setupTableF2(page);
  if (recorder) await page.getByTestId('lobby-recorder').selectOption(recorder);
  await page.getByTestId('lobby-start').click();
  await expect(page.getByTestId('lobby-reminder')).toBeVisible();
}

/** Id della partita, dall'indirizzo `#/partite/<id>/chiudi`. */
const gameIdOf = (page) => /\/partite\/([^/]+)\/chiudi/.exec(page.url())[1];

const closeLink = (page) => page.getByTestId('close-game-link');

/** Sul telefono le combo si scelgono in un foglio a tutto schermo: lo apre; su desktop non fa nulla. */
async function openComboList(page) {
  const open = page.getByTestId('close-combo-open');
  if (await open.isVisible()) await open.click();
  return page.getByTestId('close-combo-list');
}

/** Chiude il foglio con «Fatto» (solo telefono). */
async function closeComboSheet(page) {
  const done = page.getByTestId('close-combo-done');
  if (await done.isVisible()) await done.click();
}

/** Sostituisce la lettura del mazzo con una versione da molte combo (15: Win the game / Infinite / altro). */
async function manyCombos(page) {
  await page.evaluate(() => {
    const store = document
      .querySelector('#app')
      .__vue_app__.config.globalProperties.$pinia._s.get('data');
    const kinds = ['Win the game', 'Infinite mana', 'Draw a card'];
    const combos = Array.from({ length: 15 }, (_, i) => ({
      id: 'c' + i,
      cards: ['Carta ' + (i + 1) + 'A', 'Carta ' + (i + 1) + 'B'],
      produces: [kinds[i % 3]],
    }));
    store.getDeck = async () => ({
      deck: { currentVersion: 1 },
      versions: [{ version: 1, cards: [], combos }],
    });
  });
}

test.describe('chiusura partita @core', () => {
  test('UC-10: il registratore chiude con il dado in tre scelte @ui', async ({ page }) => {
    await startGame(page);
    await closeLink(page).click();
    await expect(page.getByRole('heading', { name: 'Chiudi partita', level: 1 })).toBeVisible();

    const save = page.getByTestId('close-save');
    await expect(save).toBeDisabled();
    await expect(page.getByTestId('close-problems')).toContainText('Scegli chi ha vinto.');
    // Le eliminazioni e le note stanno nei dettagli, chiusi di default.
    await expect(page.getByTestId('close-details')).not.toHaveAttribute('open', '');

    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    await page.getByTestId('close-turn-input').fill('7');
    await page.getByTestId('close-wintype').getByRole('radio', { name: 'Combo' }).check();
    await expect(page.getByTestId('close-problems')).toHaveCount(0);
    await expect(page.getByTestId('close-turn-source')).toHaveText('Turno dal dado');
    await save.click();

    await expect(page.getByTestId('close-summary')).toHaveText('Ha vinto Giocatore 2 al turno 7.');
    const id = gameIdOf(page);
    const saved = await gameInStore(page, id);
    expect(saved).toMatchObject({
      status: 'ufficiale',
      winTurn: 7,
      turnSource: 'dado',
      winType: 'combo',
      winners: [{ login: 'demo-giocatore2' }],
    });
    expect(saved.endedAt).toBeTruthy();

    // La partita è chiusa: la lobby torna al modulo e la pagina di chiusura non permette di rifarlo.
    await page.goto('/#/nuovo-tavolo');
    await expect(page.getByTestId('lobby-start')).toBeVisible();
    await page.goto(`/#/partite/${id}/chiudi`);
    await expect(page.getByTestId('close-already')).toBeVisible();
  });

  test('il selettore del turno ha i pulsanti − e + e non esce da 1…99', async ({ page }) => {
    await startGame(page);
    await closeLink(page).click();
    const input = page.getByTestId('close-turn-input');
    await page.getByRole('button', { name: 'Un turno in più' }).click();
    await expect(input).toHaveValue('1');
    await expect(page.getByRole('button', { name: 'Un turno in meno' })).toBeDisabled();
    await page.getByRole('button', { name: 'Un turno in più' }).click();
    await expect(input).toHaveValue('2');
    await input.fill('100');
    await expect(page.getByTestId('close-problems')).toContainText('Indica il turno');
  });

  test('UC-11: un altro partecipante non può chiudere', async ({ page }) => {
    await startGame(page, { recorder: 'demo-giocatore1' });
    // Chi non è registratore non vede il pulsante.
    await expect(closeLink(page)).toHaveCount(0);

    const id = await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      return pinia.state.value.data.optimisticGames[0].id;
    });
    await page.goto(`/#/partite/${id}/chiudi`);
    await expect(page.getByTestId('close-not-recorder')).toContainText(
      'Solo il registratore (Giocatore 1) può chiudere la partita.',
    );
    await expect(page.getByTestId('close-save')).toHaveCount(0);
  });

  test('UC-12: «Non ho contato» precompila il turno e salva l’origine «stima»', async ({
    page,
  }) => {
    await startGame(page);
    await closeLink(page).click();
    await page.getByTestId('close-estimate').click();
    await expect(page.getByTestId('close-turn-input')).toHaveValue('1');
    await expect(page.getByTestId('close-estimate-note')).toContainText('Turno stimato 1');
    await expect(page.getByTestId('close-turn-source')).toHaveText('Turno stimato');

    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 3' }).check();
    await page
      .getByTestId('close-wintype')
      .getByRole('radio', { name: 'Danni con le creature' })
      .check();
    await page.getByTestId('close-save').click();
    await expect(page.getByTestId('close-done')).toBeVisible();

    const id = gameIdOf(page);
    expect(await gameInStore(page, id)).toMatchObject({
      turnSource: 'stima',
      winTurn: 1,
      estimatedTurn: 1,
    });
  });

  test('correggere a mano il turno stimato lo riporta a «dado»', async ({ page }) => {
    await startGame(page);
    await closeLink(page).click();
    await page.getByTestId('close-estimate').click();
    await page.getByRole('button', { name: 'Un turno in più' }).click();
    await expect(page.getByTestId('close-turn-input')).toHaveValue('2');
    await expect(page.getByTestId('close-turn-source')).toHaveText('Turno dal dado');
  });

  test('i dettagli: eliminazioni, non rappresentativa e note arrivano sulla partita', async ({
    page,
  }) => {
    await startGame(page);
    await closeLink(page).click();
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    await page.getByTestId('close-turn-input').fill('6');
    await page
      .getByTestId('close-wintype')
      .getByRole('radio', { name: 'Drenaggio di punti vita' })
      .check();

    await page.getByTestId('close-details').locator('summary').click();
    await page.locator('select[name="elim-by-demo-giocatore3"]').selectOption('demo-giocatore2');
    await page.locator('input[name="elim-turn-demo-giocatore3"]').fill('4');
    await page.getByLabel('Partita non rappresentativa', { exact: false }).check();
    await page.locator('textarea[name="notes"]').fill('Prova di chiusura');
    await page.getByTestId('close-save').click();
    await expect(page.getByTestId('close-done')).toBeVisible();

    const id = gameIdOf(page);
    const saved = await gameInStore(page, id);
    expect(saved).toMatchObject({ notRepresentative: true, notes: 'Prova di chiusura' });
    expect(saved.players.find((p) => p.login === 'demo-giocatore3')).toMatchObject({
      eliminatedTurn: 4,
      eliminatedBy: 'demo-giocatore2',
    });
  });

  test('C-10b: con «combo» si scelgono solo le combo salvate del mazzo (anche più di una)', async ({
    page,
  }) => {
    await startGame(page);
    await closeLink(page).click();
    const cards = page.getByTestId('close-wincards');
    await expect(cards).toContainText('Scegli prima il vincitore');

    // Il mazzo di Giocatore 3 (aggiunto dal test, non esiste nell'archivio) non si può leggere:
    // si può chiudere lo stesso. Quello di Giocatore 2 ha due combo salvate.
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 3' }).check();
    await page.getByTestId('close-wintype').getByRole('radio', { name: 'Combo' }).check();
    await expect(cards).toContainText('Non riesco a leggere il mazzo');

    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    const list = await openComboList(page);
    const combos = list.getByRole('checkbox');
    await expect(combos).toHaveCount(2);
    await expect(list).toContainText('Thassa’s Oracle + Demonic Consultation');
    await expect(list).toContainText('Risultato: Win the game');
    await combos.nth(0).check();
    await combos.nth(1).check();
    await expect(combos.nth(0)).toBeChecked();
    await closeComboSheet(page);
    await expect(page.getByTestId('close-picked-combos').locator('li')).toHaveCount(2);
    await page.getByTestId('close-turn-input').fill('4');
    await page.getByTestId('close-save').click();
    await expect(page.getByTestId('close-done')).toBeVisible();

    const saved = await gameInStore(page, gameIdOf(page));
    expect(saved.winCombos).toHaveLength(2);
    expect(saved.winCards.sort()).toEqual([
      'Demonic Consultation',
      'Tainted Pact',
      'Thassa’s Oracle',
    ]);
  });

  test('C-10d: molte combo: ricerca, gruppi e chip con le scelte', async ({ page }) => {
    await startGame(page);
    await closeLink(page).click();
    await manyCombos(page);
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    await page.getByTestId('close-wintype').getByRole('radio', { name: 'Combo' }).check();
    const list = await openComboList(page);
    await expect(list.getByRole('checkbox')).toHaveCount(15);

    // Ricerca, intestazioni e righe hanno la stessa larghezza (nessun bordo destro irregolare).
    const widthOf = async (loc) => Math.round((await loc.first().boundingBox()).width);
    const searchWidth = await widthOf(page.getByTestId('close-combo-search'));
    expect(await widthOf(list.getByRole('button', { name: /Vittoria diretta/ }))).toBe(searchWidth);
    expect(await widthOf(list.locator('.choice'))).toBe(searchWidth);

    // Da 8 combo in su ci sono i gruppi per risultato, che si chiudono.
    await expect(page.getByTestId('close-combo-group-win')).toContainText('(5)');
    await expect(page.getByTestId('close-combo-group-infinite')).toContainText('(5)');
    await expect(page.getByTestId('close-combo-group-other')).toContainText('(5)');
    const winGroup = page.getByTestId('close-combo-group-win');
    await winGroup.getByRole('button', { name: /Vittoria diretta/ }).click();
    await expect(winGroup.getByRole('checkbox')).toHaveCount(0);
    await winGroup.getByRole('button', { name: /Vittoria diretta/ }).click();
    await expect(winGroup.getByRole('checkbox')).toHaveCount(5);

    // La ricerca vale per nome di carta e per risultato; con pochi risultati niente gruppi.
    const search = page.getByTestId('close-combo-search');
    await search.fill('infinite mana');
    await expect(list.getByRole('checkbox')).toHaveCount(5);
    await search.fill('7b');
    await expect(list.getByRole('checkbox')).toHaveCount(1);
    await expect(page.getByTestId('close-combo-group-win')).toHaveCount(0);
    await list.getByRole('checkbox').check();
    await search.fill('zzz');
    await expect(page.getByTestId('close-combo-nomatch')).toBeVisible();
    await closeComboSheet(page);

    // Le scelte restano come chip, anche fuori dal foglio, e si tolgono con la ×.
    const picked = page.getByTestId('close-picked-combos');
    await expect(picked.locator('li')).toHaveCount(1);
    await expect(picked).toContainText('Carta 7A + Carta 7B');
    await page.getByRole('button', { name: 'Togli la combo Carta 7A + Carta 7B' }).click();
    await expect(page.getByTestId('close-picked-combos')).toHaveCount(0);
  });

  test('C-10d: sul telefono la scelta delle combo è un foglio con «Fatto»', async ({
    page,
  }, testInfo) => {
    test.skip(
      !['mobile-small', 'iphone', 'android'].includes(testInfo.project.name),
      'solo telefono',
    );
    await startGame(page);
    await closeLink(page).click();
    await manyCombos(page);
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    await page.getByTestId('close-wintype').getByRole('radio', { name: 'Combo' }).check();
    await expect(page.getByTestId('close-combo-list')).toHaveCount(0);
    await page.getByTestId('close-combo-open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('checkbox').first().check();
    await page.getByTestId('close-combo-done').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('close-combo-open')).toContainText('1 scelta');
  });

  test('C-10b: con gli altri tipi si cerca tra le sole carte del mazzo, più carte insieme', async ({
    page,
  }) => {
    await startGame(page);
    await closeLink(page).click();
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    await page
      .getByTestId('close-wintype')
      .getByRole('radio', { name: 'Danni con le creature' })
      .check();
    await page.getByTestId('close-turn-input').fill('9');

    const search = page.getByTestId('close-card-search');
    // Una carta che non è nel mazzo non viene proposta.
    await search.fill('black lotus');
    await expect(page.getByTestId('close-card-nomatch')).toBeVisible();
    await expect(page.getByTestId('close-card-suggestions')).toHaveCount(0);

    await search.fill('finale');
    const suggestions = page.getByTestId('close-card-suggestions').getByRole('button');
    await expect(suggestions).toHaveText(['Finale of Devastation']);
    await suggestions.first().click();
    await search.fill('sol');
    await page
      .getByTestId('close-card-suggestions')
      .getByRole('button', { name: 'Sol Ring' })
      .click();
    const picked = page.getByTestId('close-picked');
    await expect(picked.locator('li')).toHaveCount(2);

    // Una carta già scelta non si ripropone; la × la toglie.
    await search.fill('sol ring');
    await expect(page.getByTestId('close-card-suggestions')).toHaveCount(0);
    await page.getByRole('button', { name: 'Togli Sol Ring' }).click();
    await expect(picked.locator('li')).toHaveCount(1);

    await page.getByTestId('close-save').click();
    await expect(page.getByTestId('close-done')).toBeVisible();
    const saved = await gameInStore(page, gameIdOf(page));
    expect(saved.winCards).toEqual(['Finale of Devastation']);
    expect(saved).not.toHaveProperty('winCombos');
  });

  test('C-10b: cambiando vincitore o passando a «combo» la scelta si azzera', async ({ page }) => {
    await startGame(page);
    await closeLink(page).click();
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    await page
      .getByTestId('close-wintype')
      .getByRole('radio', { name: 'Danni con le creature' })
      .check();
    await page.getByTestId('close-card-search').fill('finale');
    await page.getByTestId('close-card-suggestions').getByRole('button').first().click();
    await expect(page.getByTestId('close-picked').locator('li')).toHaveCount(1);

    await page.getByTestId('close-wintype').getByRole('radio', { name: 'Combo' }).check();
    await page.getByTestId('close-wintype').getByRole('radio', { name: 'Veleno' }).check();
    await expect(page.getByTestId('close-picked')).toHaveCount(0);
  });

  test('UC-13: a 3 giocatori la partita si chiude con il formato giusto', async ({ page }) => {
    await page.goto('/#/nuovo-tavolo');
    await setupTableF2Three(page);
    await page.getByTestId('lobby-start').click();
    await closeLink(page).click();
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 1' }).check();
    await page.getByTestId('close-turn-input').fill('8');
    await page
      .getByTestId('close-wintype')
      .getByRole('radio', { name: 'Danni da comandante' })
      .check();
    await page.getByTestId('close-save').click();
    await expect(page.getByTestId('close-done')).toBeVisible();

    const id = gameIdOf(page);
    const saved = await gameInStore(page, id);
    expect(saved.formatId).toBe('ffa3');
    expect(saved.players).toHaveLength(3);
    expect(saved.status).toBe('ufficiale');
  });

  // UC-14: il 1v1 è ancora «in arrivo» nella lobby (il motore lo calcola ma non è acceso nel catalogo),
  // quindi non si può avviare un 1v1 dall'interfaccia. Si attiva con la voce che lo accende.
  test.skip('UC-14: a 1v1 la partita si registra con pesi ridotti', () => {});
});

/** Come `setupTableF2`, ma con il formato a 3: l'admin più due giocatori. */
async function setupTableF2Three(page) {
  await page.getByTestId('lobby-start').waitFor();
  await addF2Decks(page);
  await page.getByTestId('lobby-format').selectOption('ffa3');
  await page.getByTestId('lobby-tier').selectOption('F2');
  for (const login of ['demo-giocatore1', 'demo-giocatore3']) await seat(page, login).click();
}

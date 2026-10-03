import { mockScryfall } from '../fixtures/scryfall-fake.js';
import { mockSpellbook } from '../fixtures/spellbook-fake.js';
import { test, expect } from './fixtures.js';

// C-05 (UC-04): import del mazzo da testo incollato. Scryfall è intercettata (nessuna rete):
// ogni nome è trovato, tranne quelli che contengono "inesistente".

const hundred = () => {
  const body = Array.from({ length: 98 }, (_, i) => `1 Carta di prova ${i}`).join('\n');
  return `Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n${body}\n1 Rhystic Study`;
};

const toWizard = async (page) => {
  await page.getByRole('button', { name: 'Avanti: autovalutazione' }).click();
  await expect(page.getByTestId('deck-wizard')).toBeVisible();
};

const saveWithWizard = async (page) => {
  await toWizard(page);
  await page.getByTestId('wizard-save').click();
};

const paste = async (page, text, { spellbookDown = false } = {}) => {
  await mockScryfall(page);
  await mockSpellbook(page, { fail: spellbookDown });
  await page.goto('/#/importa');
  await page.getByLabel('Lista del mazzo').fill(text);
  await page.getByRole('button', { name: 'Controlla la lista' }).click();
  await expect(page.getByTestId('import-preview')).toBeVisible();
};

test.describe('import da testo @core', () => {
  test('100 carte con comandante: il mazzo viene creato e compare nell’elenco @ui', async ({
    page,
  }) => {
    await paste(page, hundred());
    await expect(page.getByTestId('commanders')).toContainText("Atraxa, Praetors' Voice");
    await expect(page.getByText('1 game changer trovato')).toBeVisible();
    await expect(page.getByTestId('not-found')).toHaveCount(0);
    await saveWithWizard(page);
    await expect(page).toHaveURL(/#\/mazzi$/);
    await expect(
      page.locator('.deck__name').filter({ hasText: "Atraxa, Praetors' Voice" }),
    ).toBeVisible();
  });

  test('le carte non trovate sono elencate e bloccano il salvataggio @ui', async ({ page }) => {
    await paste(page, 'Commander\n1 Tymna the Weaver\n1 Sol Ring\n1 Carta inesistente');
    await expect(page.getByTestId('not-found')).toContainText('Carta inesistente');
    await expect(page.getByRole('button', { name: 'Avanti: autovalutazione' })).toBeDisabled();
    await page.getByRole('button', { name: 'Modifica la lista' }).click();
    await expect(page.getByLabel('Lista del mazzo')).toHaveValue(/Carta inesistente/);
  });

  test('le carte a due facce col nome completo "A // B" si trovano e si salvano', async ({
    page,
  }) => {
    await paste(
      page,
      'Commander\n1 Esika, God of the Tree // The Prismatic Bridge\n\nDeck\n1 Fire // Ice\n1 Lim-Dul the Necromancer',
    );
    await expect(page.getByTestId('not-found')).toHaveCount(0);
    await expect(page.getByTestId('commanders')).toContainText(
      'Esika, God of the Tree // The Prismatic Bridge',
    );
    await saveWithWizard(page);
    await expect(page).toHaveURL(/#\/mazzi$/);
    await expect(
      page.getByText('Esika, God of the Tree // The Prismatic Bridge').first(),
    ).toBeVisible();
  });

  test('senza comandante si sceglie dall’elenco, anche più di uno', async ({ page }) => {
    await paste(page, '1 Tymna the Weaver\n1 Thrasios, Triton Hero\n1 Sol Ring');
    await expect(page.getByTestId('import-reasons')).toContainText('Scegli almeno un comandante');
    await expect(page.getByRole('button', { name: 'Avanti: autovalutazione' })).toBeDisabled();

    const row = (name) => page.getByTestId('card-row').filter({ hasText: name });
    await row('Tymna').getByRole('button', { name: 'Comandante', pressed: false }).click();
    await row('Thrasios').getByRole('button', { name: 'Comandante', pressed: false }).click();
    await expect(page.getByTestId('commanders').locator('.chip')).toHaveText([
      'Tymna the Weaver',
      'Thrasios, Triton Hero',
    ]);
    await expect(page.getByRole('button', { name: 'Avanti: autovalutazione' })).toBeEnabled();

    await row('Tymna').getByRole('button', { name: 'Comandante', pressed: true }).click();
    await expect(page.getByTestId('commanders').locator('.chip')).toHaveText([
      'Thrasios, Triton Hero',
    ]);
  });

  test('il doppio click su una carta la imposta come comandante', async ({ page }) => {
    await paste(page, '1 Sol Ring\n1 Krenko, Mob Boss');
    await page
      .getByTestId('card-row')
      .filter({ hasText: 'Krenko' })
      .locator('.card-row__name')
      .dblclick();
    await expect(page.getByTestId('commanders')).toContainText('Krenko, Mob Boss');
  });

  test('se Scryfall non risponde si resta nel modulo con la lista intatta', async ({ page }) => {
    await page.route('https://api.scryfall.com/**', (route) => route.abort());
    await page.goto('/#/importa');
    await page.getByLabel('Lista del mazzo').fill('1 Sol Ring');
    await page.getByRole('button', { name: 'Controlla la lista' }).click();
    await expect(page.getByTestId('import-error')).toContainText(
      'Non riesco a contattare Scryfall',
    );
    await expect(page.getByLabel('Lista del mazzo')).toHaveValue('1 Sol Ring');
  });

  test('una lista vuota dà un messaggio chiaro', async ({ page }) => {
    await page.goto('/#/importa');
    await page.getByLabel('Lista del mazzo').fill('// solo un commento');
    await page.getByRole('button', { name: 'Controlla la lista' }).click();
    await expect(page.getByTestId('import-error')).toContainText('La lista è vuota');
  });

  // C-07 (UC-07): wizard di autovalutazione.
  const FOUR_GAME_CHANGERS =
    'Commander\n1 Tymna the Weaver\n\nDeck\n1 Rhystic Study\n1 Cyclonic Rift\n1 Demonic Tutor\n1 Vampiric Tutor\n1 Sol Ring';

  test('UC-07: 4 game changer → pavimento F3, F2 non dichiarabile @ui', async ({ page }) => {
    await paste(page, FOUR_GAME_CHANGERS);
    await toWizard(page);
    await expect(page.getByTestId('wizard-game-changers').locator('.chip')).toHaveCount(4);
    await expect(page.getByTestId('wizard-floor')).toHaveText('F3');
    const tier = page.getByTestId('wizard-tier');
    await expect(tier.locator('option[value="F1"]')).toHaveAttribute('disabled', '');
    await expect(tier.locator('option[value="F2"]')).toHaveAttribute('disabled', '');
    await expect(tier.locator('option[value="F3"]')).not.toHaveAttribute('disabled');
    await expect(tier).toHaveValue('F3');
    await tier.selectOption('F4');
    await page.getByTestId('wizard-save').click();
    await expect(page).toHaveURL(/#\/mazzi$/);
    await expect(page.locator('.deck').filter({ hasText: 'Tymna the Weaver' })).toBeVisible();
  });

  test('una combo infinita rapida porta il pavimento a F4', async ({ page }) => {
    await paste(
      page,
      "Commander\n1 Tymna the Weaver\n\nDeck\n1 Thassa's Oracle\n1 Demonic Consultation\n1 Sol Ring",
    );
    await toWizard(page);
    await expect(page.getByTestId('wizard-combos')).toContainText(
      "Thassa's Oracle + Demonic Consultation",
    );
    await expect(page.getByTestId('wizard-combos')).toContainText('rapida');
    await expect(page.getByTestId('wizard-floor')).toHaveText('F4');
  });

  test('terre distrutte e turni extra sono proposti e cambiano il pavimento', async ({ page }) => {
    await paste(
      page,
      'Commander\n1 Tymna the Weaver\n\nDeck\n1 Armageddon\n1 Time Warp\n1 Sol Ring',
    );
    await toWizard(page);
    await expect(page.getByTestId('wizard-mld')).toContainText('Armageddon');
    await expect(page.getByTestId('wizard-extra-turns')).toContainText('Time Warp');
    // Un solo turno extra non è «a catena»; le terre distrutte sì pesano.
    await expect(page.getByTestId('wizard-floor')).toHaveText('F4');
    await page.getByLabel('Il mazzo distrugge le terre di massa').uncheck();
    await expect(page.getByTestId('wizard-floor')).toHaveText('F1');
    await page.getByLabel('Il mazzo può concatenare turni extra').check();
    await expect(page.getByTestId('wizard-floor')).toHaveText('F4');
  });

  test('se Commander Spellbook non risponde le combo si dichiarano a mano', async ({ page }) => {
    await paste(page, FOUR_GAME_CHANGERS, { spellbookDown: true });
    await toWizard(page);
    await expect(page.getByTestId('combos-unavailable')).toBeVisible();
    await expect(page.getByTestId('wizard-floor')).toHaveText('F3');
    await page.getByLabel('Combo infinita (scelta a mano)').selectOption('rapid');
    await expect(page.getByTestId('wizard-floor')).toHaveText('F4');
    await page.getByTestId('wizard-save').click();
    await expect(page).toHaveURL(/#\/mazzi$/);
  });

  test('la pagina Mazzi ha il pulsante per importare', async ({ page }) => {
    await page.goto('/#/mazzi');
    await page.getByRole('link', { name: 'Importa mazzo' }).click();
    await expect(page).toHaveURL(/#\/importa$/);
  });
});

import { expect, test } from '@playwright/test';

// Prova sul sito vero (vedi playwright.live.config.js): dopo aver aggiunto le carte di una combo su
// Archidekt, «Aggiorna da Archidekt» deve riaprire «Ricontrolla il mazzo» con quella combo.
// Variabili: LIVE_TOKEN (obbligatoria), LIVE_DECK_NAME (default «Niko»), LIVE_EXPECT_COMBO
// (default «Restoration Angel + Felidar Guardian»), LIVE_SITE_URL.
// Si ferma su «Annulla l'aggiornamento»: il mazzo salvato non cambia e si può ripetere.

const TOKEN = process.env.LIVE_TOKEN;
const DECK = process.env.LIVE_DECK_NAME ?? 'Niko';
const COMBO = process.env.LIVE_EXPECT_COMBO ?? 'Restoration Angel + Felidar Guardian';

test.skip(!TOKEN, 'Imposta LIVE_TOKEN nel terminale per provare sul sito vero.');

test('il ricontrollo trova la combo dopo l’aggiornamento da Archidekt (sito vero)', async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);

  await page.goto('./#/accesso');
  await page.getByLabel('Token personale').fill(TOKEN);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByTestId('access-error')).toHaveCount(0);

  await page.goto('./#/mazzi');
  const deck = page
    .locator('.deck')
    .filter({ has: page.locator('.deck__name', { hasText: DECK }) })
    .filter({ has: page.getByTestId('resync') })
    .first();
  await expect(deck, `nessun mazzo «${DECK}» con il tasto di aggiornamento`).toBeVisible({
    timeout: 60_000,
  });
  await deck.getByTestId('resync').click();

  // Due richieste all'Action (Archidekt e Spellbook): circa due minuti.
  const status = page.getByTestId('resync-status');
  const dialog = page.getByRole('dialog', { name: 'Ricontrolla il mazzo' });
  await expect(
    dialog.or(status.filter({ hasText: /già aggiornato|Mazzo aggiornato|non è completo/ })),
  ).toBeVisible({ timeout: 5 * 60_000 });

  await expect(
    dialog,
    'Il wizard di ricontrollo non si è aperto: se il mazzo è «già aggiornato» le carte sono uguali a quelle salvate; se è «Mazzo aggiornato» senza wizard non è cambiato nulla di rilevante (carta fuori dal mazzo, ad esempio in Maybeboard).',
  ).toBeVisible();
  await expect(dialog.getByTestId('combos-unavailable')).toHaveCount(0);
  await expect(dialog.getByTestId('wizard-combos')).toContainText(COMBO);

  await dialog.getByRole('button', { name: 'Annulla l’aggiornamento' }).click();
  await expect(status).toContainText('Aggiornamento annullato');
});

import { mkdir } from 'node:fs/promises';
import { mockScryfall } from '../fixtures/scryfall-fake.js';
import { mockSpellbook } from '../fixtures/spellbook-fake.js';
import { test } from './fixtures.js';
import { setupTableF2 } from './lobby-helpers.js';

// Screenshot per la revisione del subagent `ui-reviewer` (PIANO-Test §5).
// Si lancia con `npm run test:visual-review` (profili iphone e desktop-chrome, tema chiaro e scuro).
// Aggiungere qui le schermate toccate da ogni nuova voce.
const SCREENS = [
  { name: 'dashboard', path: '/' },
  { name: 'regolamento', path: '/#/regolamento' },
  { name: 'profilo', path: '/#/profilo' },
  { name: 'ambiente', path: '/#/ambiente' },
  { name: 'accesso', path: '/#/accesso' },
  { name: 'mazzi', path: '/#/mazzi' },
  { name: 'segnaposto', path: '/#/partite' },
  { name: 'menu-aperto', path: '/#/mazzi?overlay=menu' },
  { name: 'finestra', path: '/#/profilo?overlay=about' },
  { name: 'notifiche', path: '/#/notifiche' },
  { name: 'gruppo', path: '/#/gruppo' },
  { name: 'gruppo-nuovo-membro', path: '/#/gruppo?overlay=member-form' },
  { name: 'importa', path: '/#/importa' },
];
const THEMES = ['light', 'dark'];

// Repository di prova (C-04b): banner rosso e selettore "Agisci come", con API GitHub intercettata.
const TEST_MEMBERS = {
  amico: { displayName: 'Amico', role: 'admin' },
  'test-giocatore1': { displayName: 'Giocatore uno', role: 'giocatore' },
};
const TEST_GROUP = {
  name: 'Gruppo',
  settings: {},
  formats: [],
  testMode: true,
  testOperators: ['amico'],
};
const asFile = (json) => ({
  type: 'file',
  encoding: 'base64',
  sha: 'abc',
  content: Buffer.from(JSON.stringify(json)).toString('base64'),
});

for (const theme of THEMES) {
  test(`screenshot modalita-prova ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem('blesscommander.token', 'ghp_finto'));
    await page.route('https://api.github.com/**', async (route) => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers: cors });
      const path = new URL(route.request().url()).pathname;
      const bodies = {
        '/user': { login: 'amico' },
        '/config/members.json': asFile(TEST_MEMBERS),
        '/config/group.json': asFile(TEST_GROUP),
        '/derived/snapshot.json': asFile({
          decks: [],
          games: [],
          standings: [],
          updatedAt: '2026-01-01',
        }),
      };
      const key = Object.keys(bodies).find((k) => path.endsWith(k));
      return route.fulfill({
        status: key ? 200 : 404,
        headers: { ...cors, 'content-type': 'application/json', etag: '"abc"' },
        body: JSON.stringify(key ? bodies[key] : { message: 'Not Found' }),
      });
    });
    await page.goto('/#/');
    await page.getByTestId('test-banner').waitFor();
    await page.waitForLoadState('networkidle');
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/modalita-prova-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Elenco con notifiche miste (lette e non lette).
for (const theme of THEMES) {
  test(`screenshot notifiche-miste ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/#/notifiche');
    await page.getByTestId('answer-yes').click();
    await page.getByTestId('mark-read').first().click();
    await page.waitForLoadState('networkidle');
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/notifiche-miste-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Anteprima dell'import (C-05): due comandanti e una carta non trovata.
for (const theme of THEMES) {
  test(`screenshot importa-anteprima ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await mockScryfall(page);
    await mockSpellbook(page);
    await page.goto('/#/importa');
    await page
      .getByLabel('Lista del mazzo')
      .fill(
        'Commander\n1 Tymna the Weaver\n1 Thrasios, Triton Hero\n\nDeck\n1 Sol Ring\n1 Rhystic Study\n1 Carta inesistente',
      );
    await page.getByRole('button', { name: 'Controlla la lista' }).click();
    await page.getByTestId('import-preview').waitFor();
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/importa-anteprima-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Wizard di autovalutazione (C-07): game changer, combo, sospette e fascia.
for (const theme of THEMES) {
  test(`screenshot importa-wizard ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await mockScryfall(page);
    await mockSpellbook(page);
    await page.goto('/#/importa');
    await page
      .getByLabel('Lista del mazzo')
      .fill(
        "Commander\n1 Tymna the Weaver\n\nDeck\n1 Rhystic Study\n1 Cyclonic Rift\n1 Demonic Tutor\n1 Vampiric Tutor\n1 Armageddon\n1 Time Warp\n1 Thassa's Oracle\n1 Demonic Consultation",
      );
    await page.getByRole('button', { name: 'Controlla la lista' }).click();
    await page.getByTestId('import-preview').waitFor();
    await page.getByRole('button', { name: 'Avanti: autovalutazione' }).click();
    await page.getByTestId('deck-wizard').waitFor();
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/importa-wizard-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Import da link di Archidekt (C-06): modulo compilato e attesa dell'Action (demo: circa 3 secondi).
for (const theme of THEMES) {
  test(`screenshot importa-archidekt ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await mockScryfall(page);
    await mockSpellbook(page);
    await page.goto('/#/importa');
    await page.getByLabel('Link di Archidekt').check();
    await page
      .getByLabel('Link del mazzo su Archidekt')
      .fill('https://archidekt.com/decks/14637766/jodah');
    await page.getByRole('button', { name: 'Scarica il mazzo' }).click();
    await page.getByTestId('import-waiting').waitFor();
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/importa-archidekt-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Mazzo appena salvato, in attesa del ricalcolo (C-06e): etichetta «in aggiornamento» sulla scheda.
for (const theme of THEMES) {
  test(`screenshot mazzi-in-aggiornamento ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/#/mazzi');
    await page.locator('.deck').first().waitFor();
    await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      pinia.state.value.data.optimisticDecks = [
        {
          id: 'appena-salvato',
          name: 'Mazzo Appena Salvato',
          ownerLogin: 'demo-admin', // chi salva è sempre l'utente collegato: il suo gruppo è aperto
          declaredTier: 'F2',
          commanders: ['Comandante Nuovo'],
          currentVersion: 1,
        },
      ];
    });
    await page.getByTestId('deck-pending').waitFor();
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/mazzi-in-aggiornamento-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Mazzi di un utente Archidekt (C-06b): elenco con caselle, due spuntate (demo: elenco finto).
for (const theme of THEMES) {
  test(`screenshot importa-utente ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await mockScryfall(page);
    await mockSpellbook(page);
    await page.goto('/#/importa');
    await page.getByLabel('Mazzi di un utente Archidekt').check();
    await page.getByLabel('Nome utente su Archidekt').fill('r3dl0g');
    await page.getByRole('button', { name: 'Cerca i mazzi' }).click();
    const list = page.getByTestId('user-decks');
    await list.waitFor({ timeout: 15000 });
    await list.getByRole('checkbox', { name: 'Mazzo demo uno' }).check();
    await list.getByRole('checkbox', { name: 'Mazzo demo tre' }).check();
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/importa-utente-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Mazzi di un utente (C-07b): wizard del primo mazzo scelto, con avanzamento e «Salta questo mazzo».
for (const theme of THEMES) {
  test(`screenshot importa-utente-wizard ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await mockScryfall(page);
    await mockSpellbook(page);
    await page.goto('/#/importa');
    await page.getByLabel('Mazzi di un utente Archidekt').check();
    await page.getByLabel('Nome utente su Archidekt').fill('r3dl0g');
    await page.getByRole('button', { name: 'Cerca i mazzi' }).click();
    const list = page.getByTestId('user-decks');
    await list.waitFor({ timeout: 15000 });
    await list.getByRole('checkbox', { name: 'Mazzo demo uno' }).check();
    await list.getByRole('checkbox', { name: 'Mazzo demo tre' }).check();
    await page.getByRole('button', { name: 'Importa 2 mazzi' }).click();
    await page.getByTestId('deck-wizard').waitFor({ timeout: 40000 });
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/importa-utente-wizard-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Mazzi raggruppati per giocatore (C-08d): tutti i gruppi aperti, e un solo giocatore scelto dal menu.
for (const theme of THEMES) {
  test(`screenshot mazzi-gruppi ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/#/mazzi');
    await page.getByTestId('expand-all').click();
    await page.locator('.deck').first().waitFor();
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/mazzi-gruppi-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
    await page.getByTestId('deck-filter').selectOption({ label: 'Giocatore 2 (1)' });
    await page.screenshot({
      path: `review-screenshots/mazzi-giocatore-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Tag ai mazzi (C-08e): scheda con tag e campo, elenco con i tag e il filtro attivo.
for (const theme of THEMES) {
  test(`screenshot mazzi-tag ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await mockScryfall(page);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/#/mazzi');
    await page.getByRole('link', { name: 'Mazzo Ottimizzato' }).click();
    for (const tag of ['veloce', 'combo', 'giocato spesso al sabato']) {
      await page.getByTestId('tag-input').fill(tag);
      await page.getByTestId('tag-add').click();
      await page.getByText(tag, { exact: true }).first().waitFor();
    }
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/mazzo-tag-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: /Tutti i mazzi/ }).click();
    await page.getByTestId('tag-filter').selectOption({ label: 'combo (1)' });
    await page.locator('.deck').first().waitFor();
    await page.screenshot({
      path: `review-screenshots/mazzi-filtro-tag-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Lobby (C-09): tavolo da 4 compilato e promemoria del dado dopo «Inizia».
for (const theme of THEMES) {
  test(`screenshot lobby ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await setupTableF2(page);
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/lobby-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
    await page.getByTestId('lobby-start').click();
    await page.getByTestId('lobby-reminder').waitFor();
    await page.screenshot({
      path: `review-screenshots/lobby-promemoria-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Chiusura partita (C-10): modulo compilato con i dettagli aperti, poi il riepilogo dopo il salvataggio.
for (const theme of THEMES) {
  test(`screenshot chiusura-partita ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    await page.emulateMedia({ colorScheme: theme });
    await setupTableF2(page);
    await page.getByTestId('lobby-start').click();
    await page.getByTestId('close-game-link').click();
    await page.getByTestId('close-winner').getByRole('radio', { name: 'Giocatore 2' }).check();
    await page.getByTestId('close-turn-input').fill('7');
    await page.getByTestId('close-wintype').getByRole('radio', { name: 'Combo' }).check();
    await page.getByTestId('close-details').locator('summary').click();
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/chiusura-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
    await page.getByTestId('close-save').click();
    await page.getByTestId('close-done').waitFor();
    await page.screenshot({
      path: `review-screenshots/chiusura-fatto-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

// Aggiornamento di un mazzo da Archidekt (C-06c/S-02): lista mazzi con il tasto e l'esito (demo).
for (const theme of THEMES) {
  test(`screenshot mazzi-aggiorna ${theme} @review`, async ({ page }, testInfo) => {
    test.skip(
      !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
      'solo iphone e desktop',
    );
    test.setTimeout(60000);
    await page.emulateMedia({ colorScheme: theme });
    await mockScryfall(page);
    await mockSpellbook(page);
    await page.goto('/#/importa');
    await page.getByLabel('Link di Archidekt').check();
    await page
      .getByLabel('Link del mazzo su Archidekt')
      .fill('https://archidekt.com/decks/14637766/jodah');
    await page.getByRole('button', { name: 'Scarica il mazzo' }).click();
    await page.getByTestId('import-preview').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Avanti: autovalutazione' }).click();
    await page.getByTestId('wizard-save').click();
    await page.waitForURL(/#\/mazzi$/);
    await page.getByTestId('resync').click();
    // Nel mazzo di esempio entra un game changer: prima il wizard di ricontrollo, poi l'esito.
    await page.getByTestId('deck-wizard').waitFor({ timeout: 40000 });
    await mkdir('review-screenshots', { recursive: true });
    await page.screenshot({
      path: `review-screenshots/mazzi-ricontrollo-${testInfo.project.name}-${theme}.png`,
      // Solo la parte visibile: la finestra è a posizione fissa e scorre da sola.
    });
    await page.getByTestId('wizard-save').click();
    await page
      .getByTestId('resync-status')
      .getByText('Mazzo aggiornato')
      .waitFor({ timeout: 30000 });
    await page.screenshot({
      path: `review-screenshots/mazzi-aggiorna-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}

for (const screen of SCREENS) {
  for (const theme of THEMES) {
    test(`screenshot ${screen.name} ${theme} @review`, async ({ page }, testInfo) => {
      test.skip(
        !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
        'solo iphone e desktop',
      );
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      await mkdir('review-screenshots', { recursive: true });
      await page.screenshot({
        path: `review-screenshots/${screen.name}-${testInfo.project.name}-${theme}.png`,
        fullPage: true,
      });
    });
  }
}

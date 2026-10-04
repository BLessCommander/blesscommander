// Aiuti per i test della lobby (C-09). Nel demo ogni giocatore ha un solo mazzo e di fascia diversa
// (F1, F2, F3, F4): per un tavolo da 4 servono mazzi della stessa fascia, quindi se ne aggiungono tre di F2.

const EXTRA_F2 = [
  ['demo-admin', 'Admin F2'],
  ['demo-giocatore1', 'Uno F2'],
  ['demo-giocatore3', 'Tre F2'],
];

/** Aggiunge allo store, come mazzi «appena salvati», tre mazzi F2 (con il demo i giocatori F2 diventano 4). */
export async function addF2Decks(page) {
  await page.evaluate((extra) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    pinia.state.value.data.optimisticDecks = extra.map(([ownerLogin, name], i) => ({
      id: `01DMTEST${String(i + 1).padStart(18, '0')}`,
      ownerLogin,
      name,
      declaredTier: 'F2',
      commanders: ['Comandante'],
      colorIdentity: ['U'],
      currentVersion: 1,
    }));
  }, EXTRA_F2);
}

export const PLAYERS = ['demo-giocatore1', 'demo-giocatore2', 'demo-giocatore3'];

export const seat = (page, login) =>
  page.getByTestId(`lobby-player-${login}`).locator('label.seat__main');

/** Apre la lobby, aggiunge i mazzi F2 e sceglie la fascia F2. */
export async function openLobbyF2(page) {
  await page.goto('/#/nuovo-tavolo');
  await page.getByTestId('lobby-start').waitFor();
  await addF2Decks(page);
  await page.getByTestId('lobby-tier').selectOption('F2');
}

/** Come `openLobbyF2` e poi siede i tre giocatori demo. */
export async function setupTableF2(page) {
  await openLobbyF2(page);
  for (const login of PLAYERS) await seat(page, login).click();
}

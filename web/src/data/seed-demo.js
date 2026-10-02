// Dati di prova per la modalità demo e per i test. Membri finti (login `demo-…`), mai account
// GitHub reali (SPEC §6.7). Identificativi fissi: stesso risultato a ogni avvio.

/** @param {string} tag @param {number} n */
const fixedId = (tag, n) => `01DM${tag}${String(n).padStart(22 - tag.length, '0')}`;

export const DEMO_LOGINS = Object.freeze({
  admin: 'demo-admin',
  player1: 'demo-giocatore1',
  player2: 'demo-giocatore2',
  player3: 'demo-giocatore3',
});

const demoNotifications = () => [
  {
    id: 'demo-n1',
    type: 'tier-change',
    createdAt: '2026-02-02T09:00:00Z',
    params: { deck: 'Mazzo Ottimizzato', from: 'F3', to: 'F4' },
  },
  {
    id: 'demo-n2',
    type: 'admin-replacement',
    createdAt: '2026-02-03T09:00:00Z',
    params: { requester: 'Giocatore 1' },
    actions: true,
  },
  {
    id: 'demo-n3',
    type: 'info',
    createdAt: '2026-02-01T09:00:00Z',
    params: { text: 'Benvenuto nel centro notifiche.' },
  },
];

/** @returns {import('./mock-provider.js').MockState} */
export function createDemoState() {
  const members = {
    [DEMO_LOGINS.admin]: { displayName: 'Admin demo', role: 'admin', joinedAt: '2026-01-01' },
    [DEMO_LOGINS.player1]: {
      displayName: 'Giocatore 1',
      role: 'giocatore',
      joinedAt: '2026-01-01',
    },
    [DEMO_LOGINS.player2]: {
      displayName: 'Giocatore 2',
      role: 'giocatore',
      joinedAt: '2026-01-01',
    },
    [DEMO_LOGINS.player3]: {
      displayName: 'Giocatore 3',
      role: 'giocatore',
      joinedAt: '2026-01-01',
    },
  };
  const deckSpecs = [
    ['Mazzo Esibizione', 'F1', DEMO_LOGINS.player1, ['G']],
    ['Mazzo Base', 'F2', DEMO_LOGINS.player2, ['W', 'U']],
    ['Mazzo Potenziato', 'F3', DEMO_LOGINS.player3, ['B', 'R']],
    ['Mazzo Ottimizzato', 'F4', DEMO_LOGINS.admin, ['U', 'B', 'G']],
  ];
  const decks = deckSpecs.map(([name, declaredTier, ownerLogin, colorIdentity], i) => ({
    id: fixedId('DECK', i + 1),
    ownerLogin,
    name,
    commanders: [`Comandante ${i + 1}`],
    colorIdentity,
    source: { type: 'text', url: '', importedAt: '2026-01-02' },
    currentVersion: 1,
    declaredTier,
    selfAssessment: { mld: false, extraTurns: false, notes: '' },
  }));
  const versions = Object.fromEntries(
    decks.map((d) => [
      d.id,
      [{ version: 1, cards: [{ name: 'Sol Ring', qty: 1 }], gameChangers: [], flags: {} }],
    ]),
  );
  const game = {
    id: fixedId('GAME', 1),
    formatId: 'ffa4',
    variants: [],
    recorderLogin: DEMO_LOGINS.admin,
    createdBy: DEMO_LOGINS.admin,
    status: 'ufficiale',
    createdAt: '2026-02-01T20:00:00Z',
    endedAt: '2026-02-01T22:00:00Z',
    players: decks.map((d, i) => ({
      login: d.ownerLogin,
      deckId: d.id,
      tierAtGame: d.declaredTier,
      seat: i + 1,
    })),
    winners: [{ login: decks[3].ownerLogin, deckId: decks[3].id }],
    winTurn: 7,
    turnSource: 'dado',
    winType: 'combattimento',
    revision: 0,
  };
  return {
    config: {
      name: 'Gruppo demo',
      settings: {},
      formats: [{ id: 'ffa4', name: 'Tutti contro tutti (4)', players: 4 }],
      variants: [],
    },
    members,
    decks: Object.fromEntries(decks.map((d) => [d.id, d])),
    versions,
    games: { [game.id]: game },
    votes: {},
    requests: {},
    notifications: Object.fromEntries(
      Object.values(DEMO_LOGINS).map((login) => [login, demoNotifications()]),
    ),
    userState: {},
  };
}

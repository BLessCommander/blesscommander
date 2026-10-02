import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Dati di prova (docs/PIANO-Test.md §4): scenario fisso e riproducibile.
 * Nessuna casualità vera e nessuna data corrente: stesso risultato a ogni esecuzione.
 * Gli utenti sono membri finti (login `test-…`), mai account GitHub reali.
 */

export const OWNER_LOGIN = 'test-owner';
export const MEMBERS = [
  { login: 'test-owner', displayName: 'Owner di prova', role: 'admin' },
  { login: 'test-admin', displayName: 'Admin di prova', role: 'admin' },
  { login: 'test-giocatore1', displayName: 'Giocatore 1', role: 'giocatore' },
  { login: 'test-giocatore2', displayName: 'Giocatore 2', role: 'giocatore' },
  { login: 'test-giocatore3', displayName: 'Giocatore 3', role: 'giocatore' },
];
export const LOGINS = MEMBERS.map((m) => m.login);

// Formati di SPEC §3.10 (id usati nelle partite di prova).
const FORMATS = {
  ffa4: { players: 4, turnFactor: 1 },
  ffa3: { players: 3, turnFactor: 1.15 },
  ffa5: { players: 5, turnFactor: 0.95 },
  duel1v1: { players: 2, turnFactor: 1.3 },
};

// 15 mazzi: [nome, fascia dichiarata, game changer, nota]
const DECK_SPECS = [
  ['Atraxa Counters', 3, 2, ''],
  ['Korvold Sacrifici', 3, 3, ''],
  ['Gruppo Goblin', 2, 0, ''],
  ['Elfi di Lathril', 2, 0, ''],
  ['Pioggia di Draghi', 3, 1, 'vicino alla soglia di promozione'],
  ['Tassa e Controllo', 4, 4, 'pavimento F3: 4 game changer'],
  ['Combo Thassa', 4, 6, 'pavimento F4: 6 game changer'],
  ['Zombie Rinnegati', 2, 0, ''],
  ['Precon Rossa', 1, 0, ''],
  ['Precon Bianca', 1, 0, ''],
  ['Maghi del Tempo', 3, 2, ''],
  ['Vampiri di Sangue', 2, 1, ''],
  ['Angeli Rinati', 3, 1, ''],
  ['Sciame di Insetti', 2, 0, ''],
  ['Il Re Dominante', 3, 3, 'dominante della fascia'],
];

const pad = (n, len = 2) => String(n).padStart(len, '0');

/** ULID finto ma stabile: 10 caratteri di tempo + 16 di sequenza, in alfabeto Crockford. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function fakeUlid(kind, index) {
  const encode = (value, length) => {
    let out = '';
    let v = value;
    for (let i = 0; i < length; i += 1) {
      out = ALPHABET[v % 32] + out;
      v = Math.floor(v / 32);
    }
    return out;
  };
  return `${encode(1_700_000_000_000 + index * 3_600_000, 10)}${kind}${encode(index, 15)}`;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Costruisce in memoria i file del repository dati di prova.
 * @returns {Record<string, unknown>} percorso relativo → contenuto JSON
 */
export function buildSeed() {
  const random = mulberry32(20261002);
  /** @type {Record<string, unknown>} */
  const files = {};

  files['config/group.json'] = {
    name: 'Gruppo di prova',
    testMode: true,
    testOperators: [OWNER_LOGIN],
    settings: {},
    formats: Object.keys(FORMATS).map((id) => ({ id, ...FORMATS[id] })),
    variants: [],
  };

  files['config/members.json'] = Object.fromEntries(
    MEMBERS.map((m) => [
      m.login,
      {
        displayName: m.displayName,
        avatarUrl: `https://avatars.invalid/${m.login}.png`,
        role: m.role,
        joinedAt: '2026-01-01T00:00:00Z',
      },
    ]),
  );

  const decks = DECK_SPECS.map(([name, tier, gameChangers, note], i) => {
    const id = fakeUlid('D', i);
    const owner = LOGINS[i % LOGINS.length];
    const floor = gameChangers >= 6 ? 4 : gameChangers >= 4 ? 3 : 1;
    files[`decks/${id}.json`] = {
      ownerLogin: owner,
      name,
      commanders: [`Comandante di ${name}`],
      colorIdentity: ['W', 'U', 'B', 'R', 'G'].slice(0, 1 + (i % 5)),
      source: { type: 'text', url: '', importedAt: '2026-01-10T12:00:00Z' },
      currentVersion: 1,
      declaredTier: `F${tier}`,
      selfAssessment: { mld: false, extraTurns: false, notes: note },
    };
    files[`decks/${id}/v1.json`] = {
      cards: Array.from({ length: 5 }, (_, c) => ({
        name: `Carta ${c + 1} di ${name}`,
        qty: 1,
        scryfallId: `00000000-0000-4000-8000-${pad(i, 4)}${pad(c, 8)}`,
        isGameChanger: c < gameChangers,
      })),
      gameChangers: Array.from({ length: gameChangers }, (_, c) => `Carta ${c + 1} di ${name}`),
      combos: [],
      flags: { mld: false, extraTurns: false },
      floor: `F${floor}`,
      diff: { added: [], removed: [] },
    };
    return { id, owner, name, tier, floor, note };
  });

  // 60 partite: 36 a 4, 10 a 3, 6 a 5, 8 1v1.
  const plan = [
    ...Array(36).fill('ffa4'),
    ...Array(10).fill('ffa3'),
    ...Array(6).fill('ffa5'),
    ...Array(8).fill('duel1v1'),
  ];
  const games = plan.map((formatId, g) => {
    const size = FORMATS[formatId].players;
    // mazzi scelti a rotazione, ma mai due volte lo stesso mazzo né due mazzi dello stesso proprietario
    const chosen = [];
    let cursor = (g * 4) % decks.length;
    while (chosen.length < size) {
      const deck = decks[cursor % decks.length];
      if (!chosen.some((c) => c.owner === deck.owner)) chosen.push(deck);
      cursor += 1;
    }
    const winner = chosen[Math.floor(random() * size)];
    const baseTurn = 6 + Math.floor(random() * 7) + (winner.tier - 2);
    const estimated = g % 9 === 4;
    const day = 1 + (g % 28);
    const month = 1 + Math.floor(g / 12);
    const id = fakeUlid('G', g);
    const startedAt = `2026-${pad(month + 1)}-${pad(day)}T19:00:00Z`;
    return {
      id,
      path: `games/2026/${pad(month + 1)}/${id}.json`,
      body: {
        formatId,
        variants: [],
        recorderLogin: chosen[0].owner,
        createdBy: chosen[0].owner,
        status: 'ufficiale',
        createdAt: startedAt,
        startedAt,
        endedAt: `2026-${pad(month + 1)}-${pad(day)}T21:00:00Z`,
        players: chosen.map((d, seat) => ({
          login: d.owner,
          deckId: d.id,
          tierAtGame: `F${d.tier}`,
          seat: seat + 1,
        })),
        winners: [{ login: winner.owner, deckId: winner.id }],
        winTurn: baseTurn,
        turnSource: estimated ? 'stima' : 'dado',
        ...(estimated ? { estimatedTurn: baseTurn } : {}),
        winType: g % 5 === 0 ? 'combo' : 'creature',
        notRepresentative: g % 17 === 3,
        notes: '',
        revision: 0,
      },
      winnerDeckId: winner.id,
    };
  });
  for (const game of games) files[game.path] = game.body;

  // Eventi di fascia già presenti: una promozione e un declassamento.
  const promoted = decks.find((d) => d.name === 'Pioggia di Draghi');
  const demoted = decks.find((d) => d.name === 'Zombie Rinnegati');
  const events = [
    {
      id: fakeUlid('E', 0),
      deckId: promoted.id,
      gameId: games[40].id,
      from: 'F2',
      to: 'F3',
      reasons: ['Turno medio di vittoria basso rispetto alla fascia'],
      createdAt: '2026-05-20T22:00:00Z',
    },
    {
      id: fakeUlid('E', 1),
      deckId: demoted.id,
      gameId: games[55].id,
      from: 'F3',
      to: 'F2',
      reasons: ['Nessuna vittoria nelle ultime partite'],
      createdAt: '2026-06-02T22:00:00Z',
    },
  ];
  files['derived/events.json'] = events;

  // Segnaposto: lo snapshot vero lo scrive l'Action di ricalcolo (B-07).
  files['derived/snapshot.json'] = {
    updatedAt: '2026-06-03T00:00:00Z',
    pending: false,
    decks: decks.map((d) => {
      const wins = games.filter((g) => g.winnerDeckId === d.id).length;
      const played = games.filter((g) => g.body.players.some((p) => p.deckId === d.id)).length;
      return {
        id: d.id,
        name: d.name,
        ownerLogin: d.owner,
        tier: { current: `F${d.id === promoted.id ? 3 : d.tier}`, floor: `F${d.floor}` },
        stats: { games: played, wins },
      };
    }),
    games: games.map((g) => ({ id: g.id, ...g.body })),
    standings: [],
    events,
  };
  files['derived/errors.json'] = [];

  return files;
}

/** Ricrea la cartella `dir` con i dati di prova. */
export async function writeSeed(dir) {
  const target = resolve(dir);
  await rm(target, { recursive: true, force: true });
  const files = buildSeed();
  for (const [rel, content] of Object.entries(files)) {
    const full = join(target, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, `${JSON.stringify(content, null, 2)}\n`);
  }
  return Object.keys(files).length;
}

// Esecuzione da riga di comando: `npm run seed:test [cartella]`
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'test-results/fake-github-data';
  const count = await writeSeed(dir);
  console.log(`Dati di prova scritti in ${resolve(dir)} (${count} file).`);
}

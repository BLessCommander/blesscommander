import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGINS, buildSeed, writeSeed } from '../../../tests/seed/seed.js';
import { startFakeGithub, tokenFor } from '../../../tests/fake-github/server.js';
import { createImportHook } from '../../../data-actions/src/repo-files.js';
import { GitHubProvider } from './github-provider.js';
import { runProviderContract } from './provider-contract.js';
import { writeStorage } from '../platform/storage.js';

let dir;
let fake;

const make = (login, options = {}) =>
  new GitHubProvider({
    owner: fake.owner,
    repo: fake.repo,
    baseUrl: fake.url,
    token: tokenFor(login),
    now: () => '2026-03-01T10:00:00Z',
    ...options,
  });

const readJson = async (rel) => JSON.parse(await readFile(join(dir, rel), 'utf8'));
const exists = (rel) =>
  stat(join(dir, rel)).then(
    () => true,
    () => false,
  );
/** Identificativo valido (26 caratteri Crockford) per le partite create nei test. */
const ulidLike = (n) => `01HZ${String(n).padStart(22, '0')}`;
const seedGamePath = Object.keys(buildSeed()).find((p) => p.startsWith('games/'));
const seedGameId = seedGamePath.split('/').pop().replace('.json', '');

/** fetch che, prima di ogni scrittura, simula un'altra persona che ha cambiato il file. */
const withInterference = (change, times = 1) => {
  let left = times;
  return async (url, init) => {
    if (init?.method === 'PUT' && left > 0) {
      left -= 1;
      await change(decodeURIComponent(new URL(url).pathname.split('/contents/')[1]));
    }
    return fetch(url, init);
  };
};

function buildSeedDeckId() {
  return Object.keys(buildSeed())
    .find((p) => /^decks\/[^/]+\.json$/.test(p))
    .slice(6, -5);
}

const game = (id) => ({
  id,
  formatId: 'ffa4',
  players: [{ login: 'test-giocatore1', deckId: buildSeedDeckId() }],
});

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'github-provider-'));
  await writeSeed(dir);
  fake = await startFakeGithub({ dataDir: dir, logins: LOGINS });
});
afterAll(async () => {
  await fake.close();
  await rm(dir, { recursive: true, force: true });
});
beforeEach(() => {
  writeStorage(`blesscommander.queue.${fake?.owner}/${fake?.repo}`, '');
});

runProviderContract('GitHubProvider (finta API)', (login) => make(login), {
  admin: 'test-owner',
  player1: 'test-giocatore1',
  player2: 'test-giocatore2',
  player3: 'test-giocatore3',
});

describe('UT-GH GitHubProvider', () => {
  it('legge in modo condizionale: la seconda lettura è "non modificato"', async () => {
    const provider = make('test-giocatore1');
    const before = fake.stats.notModified;
    const first = await provider.getSnapshot();
    const second = await provider.getSnapshot();
    expect(second).toEqual(first);
    expect(fake.stats.notModified).toBe(before + 1);
  });

  it('con un conflitto rilegge, riapplica la modifica e riprova', async () => {
    const provider = make('test-giocatore1', {
      fetch: withInterference(async (path) => {
        const game = await readJson(path);
        await writeFile(join(dir, path), JSON.stringify({ ...game, winTurn: 99 }));
      }),
    });
    const conflicts = fake.stats.conflicts;
    await provider.updateGame(seedGameId, { notes: 'rivincita' });
    expect(fake.stats.conflicts).toBe(conflicts + 1);
    const saved = await readJson(seedGamePath);
    expect(saved).toMatchObject({ notes: 'rivincita', winTurn: 99, revision: 1 });
  });

  it('dopo 3 conflitti di fila si arrende con errore "conflict"', async () => {
    let n = 0;
    const provider = make('test-giocatore1', {
      fetch: withInterference(async (path) => {
        const game = await readJson(path);
        n += 1;
        await writeFile(join(dir, path), JSON.stringify({ ...game, winTurn: 100 + n }));
      }, 10),
    });
    await expect(provider.updateGame(seedGameId, { notes: 'x' })).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(n).toBe(3);
  });

  it('con un token non valido segnala "auth" senza mostrare il token', async () => {
    const provider = new GitHubProvider({
      owner: fake.owner,
      repo: fake.repo,
      baseUrl: fake.url,
      token: 'token-scaduto-segreto',
    });
    const error = await provider.getCurrentUser().catch((e) => e);
    expect(error).toMatchObject({ code: 'auth' });
    expect(error.message).toMatch(/scaduto/);
    expect(error.message).not.toContain('segreto');
    expect(JSON.stringify(provider)).not.toContain('segreto');
  });

  it('non accetta indirizzi diversi da GitHub o dalla finta API locale', () => {
    for (const baseUrl of [
      'https://evil.example',
      'http://api.github.com',
      'https://192.168.1.5',
    ]) {
      expect(() => new GitHubProvider({ owner: 'o', repo: 'r', token: 't', baseUrl })).toThrow(
        /non ammesso/,
      );
    }
    expect(() => new GitHubProvider({ owner: 'o', repo: 'r', token: 't' })).not.toThrow();
  });

  it("un utente che non è nell'elenco membri è rifiutato", async () => {
    const members = await readJson('config/members.json');
    const others = { ...members };
    delete others['test-giocatore3'];
    await writeFile(join(dir, 'config/members.json'), JSON.stringify(others));
    await expect(make('test-giocatore3').getCurrentUser()).rejects.toMatchObject({ code: 'auth' });
    await writeFile(join(dir, 'config/members.json'), JSON.stringify(members));
  });

  it('mostra "in aggiornamento" con il tipo di dato salvato, finché lo snapshot non cambia', async () => {
    const provider = make('test-giocatore1');
    await provider.getSnapshot();
    await provider.createGame(game(ulidLike(7)));
    expect(await provider.getSnapshot()).toMatchObject({ pending: true, pendingKind: 'game' });
    const snapshot = await readJson('derived/snapshot.json');
    await writeFile(
      join(dir, 'derived/snapshot.json'),
      JSON.stringify({ ...snapshot, updatedAt: '2026-06-04T00:00:00Z' }),
    );
    expect(await provider.getSnapshot()).toMatchObject({ pending: false, pendingKind: null });
  });

  it('una richiesta di import non fa ricalcolare niente: nessun "in aggiornamento"', async () => {
    const provider = make('test-giocatore1');
    await provider.getSnapshot();
    await provider.requestImport('text', 'lista');
    expect((await provider.getSnapshot()).pending).toBe(false);
  });

  it('controlla periodicamente lo snapshot e avvisa solo se è cambiato', async () => {
    const provider = make('test-giocatore1', { pollMs: 20 });
    await provider.getSnapshot();
    const seen = vi.fn();
    const stop = provider.onSnapshotChange(seen);
    await new Promise((ok) => setTimeout(ok, 80));
    expect(seen).not.toHaveBeenCalled();
    const snapshot = await readJson('derived/snapshot.json');
    await writeFile(
      join(dir, 'derived/snapshot.json'),
      JSON.stringify({ ...snapshot, updatedAt: '2026-06-05T00:00:00Z' }),
    );
    await expect.poll(() => seen.mock.calls.length).toBeGreaterThan(0);
    stop();
  });

  it('con un ricalcolo in attesa controlla più spesso (fastPollMs)', async () => {
    const provider = make('test-giocatore1', { pollMs: 5_000, fastPollMs: 20 });
    await provider.getSnapshot();
    const seen = vi.fn();
    const stop = provider.onSnapshotChange(seen);
    await provider.createGame(game(ulidLike(8))); // ora il ricalcolo è in attesa
    const snapshot = await readJson('derived/snapshot.json');
    await writeFile(
      join(dir, 'derived/snapshot.json'),
      JSON.stringify({ ...snapshot, updatedAt: '2026-06-06T00:00:00Z' }),
    );
    // Con il giro lento (5 s) il test fallirebbe per tempo scaduto.
    await expect
      .poll(() => seen.mock.calls.some(([s]) => s.pending === false), { timeout: 1500 })
      .toBe(true);
    stop();
  });

  describe('coda offline', () => {
    it('senza rete mette la scrittura in coda e la invia al ritorno della connessione', async () => {
      let online = false;
      const provider = make('test-giocatore1', { isOnline: () => online });
      await provider.getCurrentUser().catch(() => {});
      const id = ulidLike(1);
      const queued = await provider.createGame(game(id));
      expect(queued.queued).toBe(true);
      expect(provider.pendingWrites()).toBe(1);
      expect(await exists('games/2026/03/' + id + '.json')).toBe(false);

      online = true;
      await provider.flushQueue();
      expect(provider.pendingWrites()).toBe(0);
      expect(await readJson(`games/2026/03/${id}.json`)).toMatchObject({
        formatId: 'ffa4',
        status: 'lobby',
        createdBy: 'test-giocatore1',
      });
    });

    it('se la rete cade a metà la scrittura va in coda, e al secondo tentativo resta una sola', async () => {
      let broken = true;
      const provider = make('test-giocatore1', {
        fetch: async (url, init) => {
          if (broken && init?.method === 'PUT') throw new TypeError('rete caduta');
          return fetch(url, init);
        },
      });
      const id = ulidLike(2);
      expect((await provider.createGame(game(id))).queued).toBe(true);
      expect(provider.pendingWrites()).toBe(1);
      // ancora senza rete: la coda non perde nulla e non si duplica
      await provider.flushQueue();
      expect(provider.pendingWrites()).toBe(1);
      broken = false;
      await provider.flushQueue();
      expect(provider.pendingWrites()).toBe(0);
      expect(await exists(`games/2026/03/${id}.json`)).toBe(true);
    });

    it('una scrittura in coda non valida viene scartata e segnalata, le altre proseguono', async () => {
      let online = false;
      const dropped = vi.fn();
      const provider = make('test-giocatore1', { isOnline: () => online, onQueueEvent: dropped });
      await provider.getCurrentUser().catch(() => {});
      await provider.saveDeck({
        name: 'Offline',
        commanders: ['X'],
        colorIdentity: [],
        declaredTier: 'F9',
      });
      await provider.requestImport('text', 'ok');
      expect(provider.pendingWrites()).toBe(2);
      online = true;
      await provider.flushQueue();
      expect(provider.pendingWrites()).toBe(0);
      expect(dropped).toHaveBeenCalledTimes(1);
      expect(dropped.mock.calls[0][0].write.method).toBe('saveDeck');
    });

    it('la configurazione non si mette in coda: senza rete fallisce', async () => {
      const provider = make('test-owner', {
        fetch: async (url, init) => {
          if (init?.method === 'PUT') throw new TypeError('rete caduta');
          return fetch(url, init);
        },
      });
      const config = await provider.getConfig();
      await expect(provider.saveConfig(config)).rejects.toMatchObject({ code: 'network' });
      expect(provider.pendingWrites()).toBe(0);
    });
  });
});

describe('UT-GH "Agisci come" (solo repository di prova)', () => {
  it("l'operatore di prova vede il selettore con i membri finti", async () => {
    const options = await make('test-owner').actingAsOptions();
    expect(options.enabled).toBe(true);
    expect(options.testMode).toBe(true);
    expect(options.members.map((m) => m.login).sort()).toEqual([...LOGINS].sort());
  });

  it('un membro che non è operatore non lo vede e non può usarlo', async () => {
    const provider = make('test-giocatore1');
    const options = await provider.actingAsOptions();
    expect(options.enabled).toBe(false);
    expect(options.testMode).toBe(true); // il banner si vede comunque
    await expect(provider.setActingAs('test-giocatore2')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it("senza testMode il selettore è spento anche per l'operatore", async () => {
    const group = await readJson('config/group.json');
    await writeFile(join(dir, 'config/group.json'), JSON.stringify({ ...group, testMode: false }));
    try {
      const provider = make('test-owner');
      const options = await provider.actingAsOptions();
      expect(options).toMatchObject({ enabled: false, testMode: false });
      await expect(provider.setActingAs('test-giocatore2')).rejects.toMatchObject({
        code: 'forbidden',
      });
    } finally {
      await writeFile(join(dir, 'config/group.json'), JSON.stringify(group));
    }
  });

  it("le scritture portano l'utente di prova e il campo actingAs; senza scelta niente campo", async () => {
    const provider = make('test-owner');
    const plain = await provider.requestImport('text', 'senza');
    expect(plain.requestedBy).toBe('test-owner');
    expect(plain.actingAs).toBeUndefined();

    await provider.setActingAs('test-giocatore2');
    const acted = await provider.requestImport('text', 'con');
    expect(acted.requestedBy).toBe('test-giocatore2');
    expect((await readJson(`requests/${acted.id}.json`)).actingAs).toBe('test-giocatore2');

    await provider.setActingAs(null);
    expect((await provider.requestImport('text', 'dopo')).requestedBy).toBe('test-owner');
  });

  it('rifiuta un utente che non è tra i membri', async () => {
    await expect(make('test-owner').setActingAs('test-sconosciuto')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

describe('C-06 import da Archidekt con l’Action simulata', () => {
  it('la richiesta torna "done" con il mazzo, senza chiamare Archidekt vera', async () => {
    const importDir = await mkdtemp(join(tmpdir(), 'github-import-'));
    await writeSeed(importDir);
    const archidekt = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        name: 'Mazzo finto',
        cards: [
          { quantity: 1, categories: ['Commander'], card: { oracleCard: { name: 'Tymna' } } },
          { quantity: 1, categories: null, card: { oracleCard: { name: 'Sol Ring' } } },
        ],
      }),
    });
    const server = await startFakeGithub({
      dataDir: importDir,
      logins: LOGINS,
      onWrite: createImportHook({ fetchImpl: archidekt }),
    });
    try {
      const provider = new GitHubProvider({
        owner: server.owner,
        repo: server.repo,
        baseUrl: server.url,
        token: tokenFor('test-giocatore1'),
        now: () => '2026-03-01T10:00:00Z',
      });
      const request = await provider.requestImport('archidekt', 'https://archidekt.com/decks/5');
      const state = await provider.getImportRequest(request.id);
      expect(state).toMatchObject({ status: 'done', deckName: 'Mazzo finto' });
      expect(state.result).toBe('Commander\n1 Tymna\n\nDeck\n1 Sol Ring');
    } finally {
      await server.close();
      await rm(importDir, { recursive: true, force: true });
    }
  });
});

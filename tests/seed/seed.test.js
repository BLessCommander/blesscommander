import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LOGINS, buildSeed, writeSeed } from './seed.js';

const dirs = [];
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('seed di prova', () => {
  const files = buildSeed();
  const paths = Object.keys(files);

  it('è riproducibile: due costruzioni danno lo stesso risultato', () => {
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(files));
  });

  it('usa solo membri finti con prefisso test-', () => {
    expect(LOGINS.length).toBe(5);
    expect(LOGINS.every((l) => l.startsWith('test-'))).toBe(true);
    expect(Object.keys(files['config/members.json'])).toEqual(LOGINS);
    expect(files['config/group.json'].testMode).toBe(true);
  });

  it('contiene 15 mazzi e 60 partite', () => {
    expect(paths.filter((p) => /^decks\/[^/]+\.json$/.test(p))).toHaveLength(15);
    expect(paths.filter((p) => p.startsWith('games/'))).toHaveLength(60);
  });

  it('copre formati, turno stimato e partite non rappresentative', () => {
    const games = paths.filter((p) => p.startsWith('games/')).map((p) => files[p]);
    const sizes = new Set(games.map((g) => g.players.length));
    expect([...sizes].sort()).toEqual([2, 3, 4, 5]);
    expect(games.some((g) => g.turnSource === 'stima')).toBe(true);
    expect(games.some((g) => g.notRepresentative)).toBe(true);
  });

  it('ha mazzi con 4 e 6 game changer e fasce da F1 a F4', () => {
    const versions = paths.filter((p) => /\/v1\.json$/.test(p)).map((p) => files[p]);
    expect(versions.some((v) => v.gameChangers.length === 4 && v.floor === 'F3')).toBe(true);
    expect(versions.some((v) => v.gameChangers.length === 6 && v.floor === 'F4')).toBe(true);
    const tiers = new Set(
      paths.filter((p) => /^decks\/[^/]+\.json$/.test(p)).map((p) => files[p].declaredTier),
    );
    expect([...tiers].sort()).toEqual(['F1', 'F2', 'F3', 'F4']);
  });

  it('ha un evento di promozione e uno di declassamento', () => {
    const events = files['derived/events.json'];
    expect(events.some((e) => e.to > e.from)).toBe(true);
    expect(events.some((e) => e.to < e.from)).toBe(true);
  });

  it('in una partita nessun mazzo né proprietario compare due volte', () => {
    for (const p of paths.filter((x) => x.startsWith('games/'))) {
      const players = files[p].players;
      expect(new Set(players.map((x) => x.login)).size).toBe(players.length);
      expect(new Set(players.map((x) => x.deckId)).size).toBe(players.length);
    }
  });

  it('writeSeed scrive i file su disco e ricrea la cartella da zero', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'seed-'));
    dirs.push(dir);
    const count = await writeSeed(dir);
    expect(count).toBe(paths.length);
    const members = JSON.parse(await readFile(join(dir, 'config/members.json'), 'utf8'));
    expect(Object.keys(members)).toEqual(LOGINS);
  });
});

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeGithub } from '../../../tests/fake-github/server.js';
import { LOGINS, writeSeed } from '../../../tests/seed/seed.js';
import { checkFakeGithub, checkRepository } from './connection-check.js';

let dir;
let fake;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'conn-check-'));
  await writeSeed(dir);
  fake = await startFakeGithub({ dataDir: dir, logins: LOGINS });
});
afterAll(async () => {
  await fake.close();
  await rm(dir, { recursive: true, force: true });
});

describe('checkFakeGithub', () => {
  it('riconosce un membro finto', async () => {
    expect(await checkFakeGithub(fake.url, 'test-owner')).toEqual({
      ok: true,
      login: 'test-owner',
    });
  });

  it('segnala un login sconosciuto', async () => {
    expect((await checkFakeGithub(fake.url, 'sconosciuto')).ok).toBe(false);
  });

  it('segnala un server spento', async () => {
    expect((await checkFakeGithub('http://127.0.0.1:1', 'test-owner')).ok).toBe(false);
  });
});

describe('checkRepository (repository reale simulato dalla finta API)', () => {
  // Il token va a `api.github.com`: qui la richiesta è dirottata sulla finta API locale.
  const viaFake = (url, init) => fetch(url.replace('https://api.github.com', fake.url), init);
  const check = (login) =>
    checkRepository({
      token: `token-${login}`,
      owner: fake.owner,
      repo: fake.repo,
      fetch: viaFake,
    });

  it('rifiuta un repository in modalità prova', async () => {
    expect(await check('test-owner')).toEqual({ ok: false, reason: 'test-mode' });
  });

  it('accetta un membro di un repository senza modalità prova', async () => {
    const path = join(dir, 'config/group.json');
    const original = await readFile(path, 'utf8');
    const config = JSON.parse(original);
    delete config.testMode;
    await writeFile(path, JSON.stringify(config));
    try {
      const result = await check('test-giocatore1');
      expect(result).toMatchObject({ ok: true, login: 'test-giocatore1' });
      expect(result.user.role).toBe('giocatore');
    } finally {
      await writeFile(path, original);
    }
  });

  it('segnala token non valido, non membro e rete assente', async () => {
    expect(await check('sconosciuto')).toEqual({ ok: false, reason: 'auth' });
    const members = join(dir, 'config/members.json');
    const original = await readFile(members, 'utf8');
    await writeFile(members, '{}');
    try {
      expect(await check('test-owner')).toEqual({ ok: false, reason: 'not-member' });
    } finally {
      await writeFile(members, original);
    }
    await rm(members);
    try {
      expect(await check('test-owner')).toEqual({ ok: false, reason: 'no-access' });
    } finally {
      await writeFile(members, original);
    }
    const offline = await checkRepository({
      token: 't',
      owner: 'o',
      repo: 'r',
      fetch: async () => {
        throw new TypeError('rete');
      },
    });
    expect(offline).toEqual({ ok: false, reason: 'network' });
  });
});

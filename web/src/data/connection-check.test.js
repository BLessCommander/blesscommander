import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeGithub } from '../../../tests/fake-github/server.js';
import { LOGINS, writeSeed } from '../../../tests/seed/seed.js';
import { checkFakeGithub } from './connection-check.js';

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

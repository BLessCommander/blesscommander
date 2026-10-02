import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from './fixtures.js';
import { LOGINS, writeSeed } from '../seed/seed.js';
import { startFakeGithub, tokenFor } from '../fake-github/server.js';

// Prova che la finta API GitHub funziona dentro Playwright; un solo profilo (tag @api).
test.describe('finta API GitHub @api', () => {
  let dir;
  let fake;

  test.beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pw-fake-gh-'));
    await writeSeed(dir);
    fake = await startFakeGithub({ dataDir: dir, logins: LOGINS });
  });
  test.afterAll(async () => {
    await fake.close();
    await rm(dir, { recursive: true, force: true });
  });

  test('legge lo snapshot con un token di un membro finto', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'logica di rete: un solo profilo');
    const res = await request.get(
      `${fake.url}/repos/${fake.owner}/${fake.repo}/contents/derived/snapshot.json`,
      { headers: { Authorization: `Bearer ${tokenFor('test-owner')}` } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(JSON.parse(Buffer.from(body.content, 'base64').toString()).events).toHaveLength(2);
  });
});

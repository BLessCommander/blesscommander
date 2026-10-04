import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSeed } from '../../tests/seed/seed.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { validate } from '../../web/src/data/validate.js';
import { ULID_PATTERN } from '../../web/src/data/ulid.js';
import { buildDataRepo, liveRepoMembers, testRepoConfig } from './build-data-repo.js';
import { testDeckId } from './test-decks.js';

describe('UT-ACT-LIVE: repository dati reale', () => {
  it('con live: true il proprietario è l’unico membro, admin, e non c’è testMode', async () => {
    expect(liveRepoMembers('G-E-M')['G-E-M'].role).toBe('admin');
    const dir = await mkdtemp(join(tmpdir(), 'bc-live-'));
    try {
      await buildDataRepo(dir, { live: true });
      const members = JSON.parse(await readFile(join(dir, 'config/members.json'), 'utf8'));
      const group = JSON.parse(await readFile(join(dir, 'config/group.json'), 'utf8'));
      expect(Object.keys(members)).toEqual(['G-E-M']);
      expect(group.testMode).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('UT-ACT: repository dati iniziale', () => {
  it('contiene template, schemi e motore, e l’Action compilata gira da sola', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bc-datarepo-'));
    try {
      await buildDataRepo(dir);
      const schemas = await readdir(join(dir, 'schemas'));
      expect(schemas).toContain('game.schema.json');
      expect(JSON.parse(await readFile(join(dir, 'config/group.json'), 'utf8')).name).toBeTruthy();
      expect(await readFile(join(dir, '.github/workflows/recalc.yml'), 'utf8')).toContain(
        'fetch-depth: 0',
      );

      // Il file compilato funziona senza node_modules: lo si copia altrove con i dati di prova.
      const work = await mkdtemp(join(tmpdir(), 'bc-datarun-'));
      try {
        await cp(join(dir, 'engine'), join(work, 'engine'), { recursive: true });
        for (const [path, content] of Object.entries(buildSeed())) {
          if (path.startsWith('derived/')) continue;
          await mkdir(dirname(join(work, path)), { recursive: true });
          await writeFile(join(work, path), JSON.stringify(content));
        }
        const out = execFileSync('node', ['engine/recalc.mjs', '.', '--no-git'], {
          cwd: work,
          encoding: 'utf8',
        });
        expect(out).toContain('Ricalcolo completato');
        const snapshot = JSON.parse(await readFile(join(work, 'derived/snapshot.json'), 'utf8'));
        expect(snapshot.decks).toHaveLength(15);
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('UT-ACT-TEST: repository di prova iniziale', () => {
  it('ha testMode, il proprietario come operatore e admin, e 8 giocatori finti più un admin', () => {
    const { group, members } = testRepoConfig('G-E-M');
    expect(group).toMatchObject({ testMode: true, testOperators: ['G-E-M'] });
    expect(members['G-E-M'].role).toBe('admin');
    const fake = Object.keys(members).filter((l) => l.startsWith('test-'));
    expect(fake.sort()).toEqual([
      'test-admin',
      ...Array.from({ length: 8 }, (_, i) => `test-giocatore${i + 1}`),
    ]);
  });

  it('il pacchetto di prova ha un mazzo Sanar valido per ogni giocatore finto', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bc-decks-'));
    try {
      await buildDataRepo(dir, { test: true });
      for (let n = 1; n <= 8; n += 1) {
        const id = testDeckId(n);
        expect(id).toMatch(new RegExp(ULID_PATTERN));
        const deck = JSON.parse(await readFile(join(dir, `decks/${id}.json`), 'utf8'));
        const version = JSON.parse(await readFile(join(dir, `decks/${id}/v1.json`), 'utf8'));
        expect(deck.ownerLogin).toBe(`test-giocatore${n}`);
        expect(deck.commanders).toEqual(['Sanar, Innovative First-Year']);
        expect(validate('deck', { id, ...deck }).valid).toBe(true);
        expect(validate('deck-version', version).valid).toBe(true);
        expect(version.cards.reduce((sum, c) => sum + c.qty, 0)).toBe(99);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('con test: true scrive i file di prova; senza, il template reale resta senza testMode', async () => {
    const real = await mkdtemp(join(tmpdir(), 'bc-real-'));
    const test = await mkdtemp(join(tmpdir(), 'bc-test-'));
    try {
      await buildDataRepo(real);
      await buildDataRepo(test, { test: true });
      const realGroup = JSON.parse(await readFile(join(real, 'config/group.json'), 'utf8'));
      const testGroup = JSON.parse(await readFile(join(test, 'config/group.json'), 'utf8'));
      expect(realGroup.testMode).toBeUndefined();
      expect(testGroup.testMode).toBe(true);
      const members = JSON.parse(await readFile(join(test, 'config/members.json'), 'utf8'));
      expect(Object.keys(members)).toContain('test-giocatore1');
    } finally {
      await rm(real, { recursive: true, force: true });
      await rm(test, { recursive: true, force: true });
    }
  }, 30_000);
});

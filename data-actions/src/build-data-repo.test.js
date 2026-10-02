import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSeed } from '../../tests/seed/seed.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildDataRepo } from './build-data-repo.js';

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

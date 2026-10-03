import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WORKFLOW = new URL('../template/.github/workflows/recalc.yml', import.meta.url);

/** Estrae lo script del passo «Commit di derived/». */
async function commitStep() {
  const lines = (await readFile(WORKFLOW, 'utf8')).split('\n');
  const start = lines.findIndex((l) => l.includes('name: Commit di derived/'));
  const run = lines.findIndex((l, i) => i > start && l.trim() === 'run: |');
  const body = [];
  for (let i = run + 1; i < lines.length && /^ {10}|^\s*$/.test(lines[i]); i++) {
    body.push(lines[i].slice(10));
  }
  return body.join('\n');
}

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

describe('recalc.yml: push del ricalcolo', () => {
  it('ha un ciclo con pull --rebase e fallisce se non riesce a pubblicare', async () => {
    const step = await commitStep();
    expect(step).toContain('git pull --rebase');
    expect(step).toContain('git push');
    expect(step).toContain('exit 1');
  });

  it('pubblica derived/ anche se nel frattempo è arrivato un altro commit', async () => {
    const step = await commitStep();
    const root = await mkdtemp(join(tmpdir(), 'recalc-wf-'));
    try {
      const remote = join(root, 'remote.git');
      const runner = join(root, 'runner');
      const other = join(root, 'other');
      git(root, 'init', '--bare', '-b', 'main', remote);
      git(root, 'clone', remote, runner);
      for (const dir of [runner]) {
        git(dir, 'config', 'user.name', 't');
        git(dir, 'config', 'user.email', 't@t');
      }
      await writeFile(join(runner, 'a.txt'), 'a');
      git(runner, 'add', '-A');
      git(runner, 'commit', '-m', 'start');
      git(runner, 'push', 'origin', 'main');
      git(root, 'clone', remote, other);
      git(other, 'config', 'user.name', 't');
      git(other, 'config', 'user.email', 't@t');

      // Il ricalcolo scrive derived/, ma un altro commit arriva prima del push.
      await mkdir(join(runner, 'derived'));
      await writeFile(join(runner, 'derived/snapshot.json'), '{}');
      await writeFile(join(other, 'decks.json'), '[]');
      git(other, 'add', '-A');
      git(other, 'commit', '-m', 'mazzo nuovo');
      git(other, 'push', 'origin', 'main');

      execFileSync('bash', ['-c', step], { cwd: runner, stdio: 'pipe' });

      const log = git(remote, 'log', '--format=%s', 'main');
      expect(log).toContain('Ricalcolo dati derivati');
      expect(log).toContain('mazzo nuovo');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

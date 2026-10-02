import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSeed, OWNER_LOGIN } from '../../tests/seed/seed.js';
import { validate } from '../../web/src/data/validate.js';
import { runRecalc } from './recalc.js';
import { authorsFromGit, readInputFiles, recalcDirectory, writeDerived } from './repo-files.js';

/** File di input del seed come testo, senza `derived/`. */
function seedFiles() {
  const files = {};
  for (const [path, content] of Object.entries(buildSeed())) {
    if (!path.startsWith('derived/')) files[path] = JSON.stringify(content);
  }
  return files;
}

/** Prima partita registrata da qualcuno che non è né l'operatore di prova né test-giocatore3. */
const foreignGame = (files) =>
  gamePaths(files).find(
    (p) => ![OWNER_LOGIN, 'test-giocatore3'].includes(JSON.parse(files[p]).recorderLogin),
  );
const gamePaths = (files) => Object.keys(files).filter((p) => p.startsWith('games/'));
const edit = (files, path, change) => ({
  ...files,
  [path]: JSON.stringify({ ...JSON.parse(files[path]), ...change }),
});
/** Tutti i file scritti da `owner` (che nel seed è admin e operatore di prova). */
const authoredBy = (files, login) => Object.fromEntries(Object.keys(files).map((p) => [p, login]));

describe('UT-ACT: Action recalc', () => {
  it('produce tutti i file di derived/ validi', () => {
    const { derived, errors } = runRecalc({ files: seedFiles(), unknownAuthor: 'allow' });
    expect(errors).toEqual([]);
    expect(Object.keys(derived)).toEqual(
      expect.arrayContaining([
        'derived/snapshot.json',
        'derived/events.json',
        'derived/stats.json',
        'derived/errors.json',
      ]),
    );
    const deckFiles = Object.entries(derived).filter(([p]) => p.startsWith('derived/decks/'));
    expect(deckFiles).toHaveLength(15);
    for (const [, deck] of deckFiles) expect(validate('derived/deck', deck).errors).toEqual([]);
    expect(validate('derived/events', derived['derived/events.json']).errors).toEqual([]);
    expect(validate('derived/snapshot', derived['derived/snapshot.json']).errors).toEqual([]);
    expect(derived['derived/snapshot.json'].games).toHaveLength(60);
  });

  it('è deterministico: due esecuzioni danno lo stesso risultato', () => {
    const a = runRecalc({ files: seedFiles(), unknownAuthor: 'allow' });
    const b = runRecalc({ files: seedFiles(), unknownAuthor: 'allow' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('ignora e annota un file non valido, senza fermare il resto', () => {
    const files = seedFiles();
    const [broken, malformed] = gamePaths(files);
    files[broken] = JSON.stringify({ formatId: 'ffa4' });
    files[malformed] = '{ non è json';
    const { derived, errors } = runRecalc({ files, unknownAuthor: 'allow' });
    expect(errors.map((e) => e.path).sort()).toEqual([broken, malformed].sort());
    expect(derived['derived/snapshot.json'].games).toHaveLength(58);
    expect(derived['derived/errors.json']).toEqual(errors);
  });

  it('ignora la chiusura fatta da chi non è il registratore', () => {
    const files = seedFiles();
    const [path] = gamePaths(files);
    const recorder = JSON.parse(files[path]).recorderLogin;
    const authors = authoredBy(files, recorder);
    authors[path] = 'test-giocatore3';
    // test-giocatore3 non è il registratore di questa partita (nel seed lo è il primo giocatore)
    expect(recorder).not.toBe('test-giocatore3');
    const { derived, errors } = runRecalc({
      files,
      authors: { ...authors, 'config/group.json': OWNER_LOGIN, 'config/members.json': OWNER_LOGIN },
    });
    expect(errors.find((e) => e.path === path)?.reason).toMatch(/registratore/);
    expect(
      derived['derived/snapshot.json'].games.some(
        (g) => g.id === path.split('/').pop().slice(0, -5),
      ),
    ).toBe(false);
  });

  it('accetta la chiusura del registratore', () => {
    const files = seedFiles();
    const authors = {
      'config/group.json': OWNER_LOGIN,
      'config/members.json': OWNER_LOGIN,
    };
    for (const path of gamePaths(files)) authors[path] = JSON.parse(files[path]).recorderLogin;
    const { errors } = runRecalc({ files, authors, unknownAuthor: 'allow' });
    expect(errors).toEqual([]);
  });

  it('ignora la modifica a config/ fatta da chi non è admin', () => {
    const files = edit(seedFiles(), 'config/group.json', { name: 'Rubato' });
    const members = JSON.parse(files['config/members.json']);
    const authors = {
      'config/group.json': 'test-giocatore1',
      'config/members.json': OWNER_LOGIN,
    };
    const baseline = {
      group: { ...JSON.parse(seedFiles()['config/group.json']), name: 'Originale' },
      members,
    };
    const { errors } = runRecalc({ files, authors, baseline, unknownAuthor: 'allow' });
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('config/group.json');
    expect(errors[0].reason).toMatch(/admin/);
  });

  it('ignora un giocatore che si promuove admin in config/members.json (UC-19)', () => {
    const original = seedFiles();
    const baseline = { members: JSON.parse(original['config/members.json']) };
    const forged = { ...baseline.members };
    forged['test-giocatore1'] = { ...forged['test-giocatore1'], role: 'admin' };
    const files = { ...original, 'config/members.json': JSON.stringify(forged) };
    const authors = { 'config/members.json': 'test-giocatore1' };
    const { errors } = runRecalc({ files, authors, baseline, unknownAuthor: 'allow' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ path: 'config/members.json' });
    expect(errors[0].reason).toMatch(/solo gli admin/);
  });

  it('ignora un elenco membri senza nessun admin, anche se scritto da un admin', () => {
    const original = seedFiles();
    const baseline = { members: JSON.parse(original['config/members.json']) };
    const noAdmin = Object.fromEntries(
      Object.entries(baseline.members).map(([login, m]) => [login, { ...m, role: 'giocatore' }]),
    );
    const files = { ...original, 'config/members.json': JSON.stringify(noAdmin) };
    const authors = { 'config/members.json': OWNER_LOGIN };
    const { errors } = runRecalc({ files, authors, baseline, unknownAuthor: 'allow' });
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/almeno un admin/);
  });

  it('in modalità prova accetta actingAs solo da un testOperator', () => {
    const files = seedFiles();
    const path = foreignGame(files);
    const game = JSON.parse(files[path]);
    const withActing = edit(files, path, { actingAs: game.recorderLogin });

    const operator = runRecalc({
      files: withActing,
      authors: { [path]: OWNER_LOGIN },
      unknownAuthor: 'allow',
    });
    expect(operator.errors).toEqual([]);

    const notOperator = runRecalc({
      files: withActing,
      authors: { [path]: 'test-giocatore3' },
      unknownAuthor: 'allow',
    });
    expect(notOperator.errors.map((e) => e.path)).toEqual([path]);
  });

  it('in modalità prova un operatore che agisce come non-registratore non può chiudere', () => {
    const files = seedFiles();
    const path = foreignGame(files);
    const game = JSON.parse(files[path]);
    const other = Object.keys(JSON.parse(files['config/members.json'])).find(
      (login) => login !== game.recorderLogin,
    );
    const { errors } = runRecalc({
      files: edit(files, path, { actingAs: other }),
      authors: { [path]: OWNER_LOGIN },
      unknownAuthor: 'allow',
    });
    expect(errors.map((e) => e.path)).toEqual([path]);
  });

  it('senza testMode ignora actingAs', () => {
    const files = edit(seedFiles(), 'config/group.json', { testMode: false });
    const path = foreignGame(files);
    const game = JSON.parse(files[path]);
    const withActing = edit(files, path, { actingAs: game.recorderLogin });
    const { errors } = runRecalc({
      files: withActing,
      authors: { [path]: OWNER_LOGIN },
      unknownAuthor: 'allow',
    });
    expect(errors.map((e) => e.path)).toEqual([path]);
  });

  it('con autore ignoto e unknownAuthor "deny" respinge la chiusura', () => {
    const files = seedFiles();
    const { errors } = runRecalc({ files, authors: {} });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UT-ACT: su cartella', () => {
  async function withDir(callback) {
    const dir = await mkdtemp(join(tmpdir(), 'bc-recalc-'));
    try {
      await callback(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  const writeSeedFiles = async (dir) => {
    const { mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    for (const [path, content] of Object.entries(buildSeed())) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), JSON.stringify(content));
    }
  };

  it('un derived/ manomesso torna uguale a un calcolo da zero', async () => {
    await withDir(async (dir) => {
      await writeSeedFiles(dir);
      await recalcDirectory(dir, { unknownAuthor: 'allow' });
      const clean = await readFile(join(dir, 'derived/snapshot.json'), 'utf8');

      await writeFile(join(dir, 'derived/snapshot.json'), '{"decks":[],"manomesso":true}');
      await writeFile(join(dir, 'derived/decks/finto.json'), '{}');
      await recalcDirectory(dir, { unknownAuthor: 'allow' });

      expect(await readFile(join(dir, 'derived/snapshot.json'), 'utf8')).toBe(clean);
      const files = await readInputFiles(dir);
      expect(Object.keys(files).some((p) => p.startsWith('derived/'))).toBe(false);
      await expect(readFile(join(dir, 'derived/decks/finto.json'))).rejects.toThrow();
    });
  });

  it('writeDerived toglie i file che non servono più', async () => {
    await withDir(async (dir) => {
      await writeDerived(dir, { 'derived/a.json': 1, 'derived/b.json': 2 });
      await writeDerived(dir, { 'derived/a.json': 1 });
      await expect(readFile(join(dir, 'derived/b.json'))).rejects.toThrow();
    });
  });

  it('legge gli autori dalla storia Git (anche con e-mail noreply di GitHub)', async () => {
    await withDir(async (dir) => {
      const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
      git('init', '-q');
      git('config', 'user.name', 'Qualcuno');
      git('config', 'commit.gpgsign', 'false');
      await writeFile(join(dir, 'x.txt'), 'x');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(dir, 'games'), { recursive: true });
      await writeFile(join(dir, 'games/a.json'), '1');
      await writeFile(join(dir, 'games/b.json'), '1');
      git('add', '.');
      git('-c', 'user.email=1+mario@users.noreply.github.com', 'commit', '-q', '-m', 'uno');
      await writeFile(join(dir, 'games/b.json'), '2');
      git('add', '.');
      git('-c', 'user.email=altro@example.com', 'commit', '-q', '-m', 'due');
      expect(authorsFromGit(dir)).toEqual({ 'games/a.json': 'mario', 'games/b.json': 'Qualcuno' });
    });
  });
});

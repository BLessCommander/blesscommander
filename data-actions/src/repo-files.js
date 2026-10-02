// Lettura e scrittura del repository dati su una cartella (checkout dell'Action o cartella di prova).
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { runRecalc } from './recalc.js';

const INPUT_DIRS = ['config', 'decks', 'games', 'votes', 'requests'];

async function walk(root, rel, out) {
  let entries;
  try {
    entries = await readdir(join(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(root, child, out);
    else if (entry.name.endsWith('.json')) out[child] = await readFile(join(root, child), 'utf8');
  }
}

/** @returns {Promise<Record<string, string>>} percorso relativo → testo, solo i file di input */
export async function readInputFiles(dir) {
  const root = resolve(dir);
  const files = {};
  for (const name of INPUT_DIRS) await walk(root, name, files);
  return files;
}

/** Scrive `derived/` e toglie i file di `derived/` che il ricalcolo non produce più. */
export async function writeDerived(dir, derived) {
  const root = resolve(dir);
  const existing = {};
  await walk(root, 'derived', existing);
  for (const path of Object.keys(existing)) {
    if (!(path in derived)) await rm(join(root, path));
  }
  for (const [path, content] of Object.entries(derived)) {
    const full = join(root, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, `${JSON.stringify(content, null, 2)}\n`);
  }
}

/**
 * Autore dell'ultimo commit per ogni file, dalla storia Git (serve il checkout completo).
 * GitHub scrive il login nell'e-mail `ID+login@users.noreply.github.com`; altrimenti si usa il nome.
 * @returns {Record<string, string>}
 */
export function authorsFromGit(dir) {
  const out = execFileSync(
    'git',
    ['log', '--format=%x00%ae|%an', '--name-only', '--no-renames', '--', ...INPUT_DIRS],
    { cwd: resolve(dir), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  const authors = {};
  for (const block of out.split('\0').slice(1)) {
    const [head, ...paths] = block.split('\n');
    const [email, name] = head.split('|');
    const noreply = /^(?:\d+\+)?(.+)@users\.noreply\.github\.com$/.exec(email);
    const login = noreply ? noreply[1] : name;
    for (const path of paths.map((p) => p.trim()).filter(Boolean)) {
      if (!(path in authors)) authors[path] = login; // il primo è il commit più recente
    }
  }
  return authors;
}

/**
 * Ricalcola la cartella `dir` e scrive `derived/`.
 * @param {string} dir
 * @param {Omit<import('./recalc.js').RecalcInput, 'files'>} [options]
 */
export async function recalcDirectory(dir, options = {}) {
  const files = await readInputFiles(dir);
  const result = runRecalc({ files, ...options });
  await writeDerived(dir, result.derived);
  return result;
}

/**
 * Gancio per la finta API GitHub (`onWrite`): dopo ogni scrittura simula l'Action di ricalcolo.
 * Tiene gli autori dei commit in memoria; i file del seed, senza autore, non si controllano.
 */
export function createRecalcHook() {
  /** @type {Record<string, string>} */
  const authors = {};
  return async (commit, dir) => {
    if (!INPUT_DIRS.some((name) => commit.path.startsWith(`${name}/`))) return;
    authors[commit.path] = commit.author;
    await recalcDirectory(dir, { authors, unknownAuthor: 'allow' });
  };
}

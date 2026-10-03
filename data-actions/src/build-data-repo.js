// Prepara il contenuto iniziale del repository dati: template, schemi JSON e motore compilato.
// Uso: node data-actions/src/build-data-repo.js [cartella-di-uscita]   (default: data-actions/dist/data-repo)
// Con `--test` prepara invece il repository di PROVA (`testMode`, utenti finti): stesso motore, altri dati iniziali.
// Non pubblica nulla: la pubblicazione sul repository dati è la voce C-15.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { SCHEMAS } from '../../web/src/data/schemas.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

const TEST_USERS = [
  ['test-admin', 'Admin di prova', 'admin'],
  ['test-giocatore1', 'Giocatore 1', 'giocatore'],
  ['test-giocatore2', 'Giocatore 2', 'giocatore'],
  ['test-giocatore3', 'Giocatore 3', 'giocatore'],
];

/**
 * Dati iniziali del repository di prova: `testMode`, il proprietario (login in `docs/progetto.json`)
 * come unico `testOperator` e admin, più 4 utenti finti (SPEC §6.7). Nessun account GitHub reale in più.
 * @param {string} ownerLogin
 */
export function testRepoConfig(ownerLogin) {
  const joinedAt = '2026-01-01T00:00:00Z';
  const member = (displayName, role) => ({ displayName, role, joinedAt });
  return {
    group: {
      name: 'Gruppo di prova',
      testMode: true,
      testOperators: [ownerLogin],
      settings: {},
      formats: [],
      variants: [],
    },
    members: Object.fromEntries([
      [ownerLogin, member('Proprietario', 'admin')],
      ...TEST_USERS.map(([login, name, role]) => [login, member(name, role)]),
    ]),
  };
}

/**
 * @param {string} [outDir]
 * @param {{ test?: boolean }} [options] `test`: repository di prova invece di quello reale
 * @returns {Promise<string[]>} percorsi scritti, relativi alla cartella di uscita
 */
export async function buildDataRepo(
  outDir = join(root, 'data-actions/dist/data-repo'),
  { test = false } = {},
) {
  const out = resolve(outDir);
  await rm(out, { recursive: true, force: true });
  await cp(join(root, 'data-actions/template'), out, { recursive: true });

  if (test) {
    const progetto = JSON.parse(await readFile(join(root, 'docs/progetto.json'), 'utf8'));
    const { group, members } = testRepoConfig(progetto.ownerLogin);
    await writeFile(
      join(out, 'config/group.json'),
      `${JSON.stringify(group, null, 2)}
`,
    );
    await writeFile(
      join(out, 'config/members.json'),
      `${JSON.stringify(members, null, 2)}
`,
    );
  }

  await mkdir(join(out, 'schemas'), { recursive: true });
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    const file = `${name.replace('/', '-')}.schema.json`;
    await writeFile(join(out, 'schemas', file), `${JSON.stringify(schema, null, 2)}\n`);
  }

  // Un solo file ciascuno: l'Action non deve fare `npm install`.
  const common = {
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    logLevel: 'silent',
  };
  await build({
    ...common,
    entryPoints: [join(root, 'packages/tier-engine/src/index.js')],
    outfile: join(out, 'engine/tier-engine.mjs'),
  });
  await build({
    ...common,
    entryPoints: [join(root, 'data-actions/src/cli.js')],
    outfile: join(out, 'engine/recalc.mjs'),
  });
  await build({
    ...common,
    entryPoints: [join(root, 'data-actions/src/import-cli.js')],
    outfile: join(out, 'engine/import.mjs'),
  });

  return [
    'config/group.json',
    'config/members.json',
    '.github/workflows/recalc.yml',
    '.github/workflows/import.yml',
    'schemas/',
    'engine/tier-engine.mjs',
    'engine/recalc.mjs',
    'engine/import.mjs',
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const test = args.includes('--test');
  const target = args.find((a) => !a.startsWith('--'));
  await buildDataRepo(target, { test });
  console.log(
    `Repository dati${test ? ' di PROVA' : ''} iniziale pronto in ${resolve(target ?? 'data-actions/dist/data-repo')}`,
  );
}

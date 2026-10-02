// Prepara il contenuto iniziale del repository dati: template, schemi JSON e motore compilato.
// Uso: node data-actions/src/build-data-repo.js [cartella-di-uscita]   (default: data-actions/dist/data-repo)
// Non pubblica nulla: la pubblicazione sul repository dati è la voce C-15.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { SCHEMAS } from '../../web/src/data/schemas.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

/**
 * @param {string} [outDir]
 * @returns {Promise<string[]>} percorsi scritti, relativi alla cartella di uscita
 */
export async function buildDataRepo(outDir = join(root, 'data-actions/dist/data-repo')) {
  const out = resolve(outDir);
  await rm(out, { recursive: true, force: true });
  await cp(join(root, 'data-actions/template'), out, { recursive: true });

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

  return [
    'config/group.json',
    'config/members.json',
    '.github/workflows/recalc.yml',
    'schemas/',
    'engine/tier-engine.mjs',
    'engine/recalc.mjs',
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  await buildDataRepo(target);
  console.log(
    `Repository dati iniziale pronto in ${resolve(target ?? 'data-actions/dist/data-repo')}`,
  );
}

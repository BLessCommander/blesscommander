// Uso: node cli.js <cartella-repository-dati> [--no-git]
// Nell'Action gli autori vengono dalla storia Git; con --no-git (prove locali) non si controllano.
import { resolve } from 'node:path';
import { authorsFromGit, recalcDirectory } from './repo-files.js';

const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const noGit = args.includes('--no-git');

const options = noGit
  ? { unknownAuthor: 'allow' }
  : { authors: authorsFromGit(dir), unknownAuthor: 'deny' };
const { derived, errors } = await recalcDirectory(dir, options);
console.log(
  `Ricalcolo completato: ${Object.keys(derived).length} file in derived/, ${errors.length} avvisi.`,
);
for (const e of errors) console.log(`- ${e.path}: ${e.reason}`);

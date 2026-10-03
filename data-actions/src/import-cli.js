// Uso: node import-cli.js <cartella-repository-dati> [--no-git]
import { resolve } from 'node:path';
import { authorsFromGit, importDirectory } from './repo-files.js';

const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const noGit = args.includes('--no-git');

const options = noGit
  ? { unknownAuthor: 'allow' }
  : { authors: authorsFromGit(dir), unknownAuthor: 'deny' };
const updates = await importDirectory(dir, options);
console.log(`Import completato: ${Object.keys(updates).length} richieste aggiornate.`);
for (const [path, r] of Object.entries(updates)) console.log(`- ${path}: ${r.status}`);

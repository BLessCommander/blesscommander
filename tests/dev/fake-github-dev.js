import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createRecalcHook, recalcDirectory } from '../../data-actions/src/repo-files.js';
import { startFakeGithub } from '../fake-github/server.js';
import { LOGINS, writeSeed } from '../seed/seed.js';

/**
 * `npm run dev:fake-github`: scrive i dati di prova in una cartella locale, avvia la finta API
 * GitHub e poi l'app collegata ad essa. Nessun servizio reale viene toccato (SPEC §6.11).
 */
const dataDir = resolve('test-results/fake-github-dev');
const port = Number(process.env.FAKE_GITHUB_PORT ?? 4500);

const count = await writeSeed(dataDir);
await recalcDirectory(dataDir, { unknownAuthor: 'allow' }); // snapshot vero al posto del segnaposto
// Dopo ogni scrittura la finta API ricalcola `derived/` come farà l'Action vera.
const fake = await startFakeGithub({
  dataDir,
  logins: LOGINS,
  port,
  onWrite: createRecalcHook(),
});
console.log(`Finta API GitHub su ${fake.url} (${count} file di prova in ${dataDir}).`);

const vite = spawn('npm', ['run', 'dev', '-w', 'web'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_DATA_MODE: 'fake-github',
    VITE_FAKE_GITHUB_URL: fake.url,
    VITE_FAKE_GITHUB_LOGIN: 'test-owner',
  },
});

const stop = async () => {
  vite.kill();
  await fake.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
vite.on('exit', stop);

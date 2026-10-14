import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { resolve } from 'node:path';
import { connectEmulator, migrateDirectory } from '../../data-actions/src/migrate-to-firestore.js';
import { EMULATOR_GROUP } from '../../web/src/data/firebase-emulator.js';
import { writeSeed } from '../seed/seed.js';

/**
 * `npm run dev:firebase`: avvia l'emulatore di Firestore, ci copia i dati di prova con lo stesso
 * script di migrazione che userà il database vero, poi avvia l'app collegata all'emulatore.
 * Nessun servizio reale viene toccato (SPEC §6.11). Serve Java.
 */
const port = Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8081);
const host = `127.0.0.1:${port}`;
const dataDir = resolve('test-results/firebase-dev');

const waitForPort = (tries = 120) =>
  new Promise((done, fail) => {
    const attempt = (left) => {
      const socket = connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        done();
      });
      socket.once('error', () => {
        socket.destroy();
        if (left <= 0) fail(new Error(`L'emulatore non è partito sulla porta ${port}`));
        else setTimeout(() => attempt(left - 1), 500);
      });
    };
    attempt(tries);
  });

const emulator = spawn(
  'npx',
  [
    'firebase',
    'emulators:start',
    '--only',
    'firestore',
    '--project',
    'demo-blesscommander',
    '--config',
    'tests/dev/firebase.dev.json',
  ],
  { stdio: 'inherit', shell: true },
);

let vite;
const stop = () => {
  vite?.kill();
  emulator.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
emulator.on('exit', stop);

await waitForPort();
const count = await writeSeed(dataDir);
const result = await migrateDirectory(connectEmulator(host), dataDir, EMULATOR_GROUP);
console.log(
  `Emulatore Firestore su ${host}: ${count} file di prova copiati come ${result.documents} documenti.`,
);

vite = spawn('npm', ['run', 'dev', '-w', 'web'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_DATA_MODE: 'firebase-emulator',
    VITE_FIRESTORE_EMULATOR_HOST: host,
    VITE_FAKE_GITHUB_LOGIN: 'test-owner',
  },
});
vite.on('exit', stop);

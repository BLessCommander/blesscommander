import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connectEmulator, migrateDirectory } from '../../data-actions/src/migrate-to-firestore.js';
import { EMULATOR_GROUP } from '../../web/src/data/firebase-emulator.js';
import { writeSeed } from '../seed/seed.js';

/**
 * `npm run dev:firebase`: avvia l'emulatore di Firestore, ci copia i dati di prova con lo stesso
 * script di migrazione che userà il database vero, poi avvia l'app collegata all'emulatore.
 * Nessun servizio reale viene toccato (SPEC §6.11). Serve Java.
 */
// `npm run dev:accounts`: stessi emulatori, ma con le regole vere, l'accesso Google finto e nessun dato
// di prova: si crea un gruppo e si entra con il codice di invito (E-04a).
const accounts = process.argv[2] === 'accounts';
const authPort = 9099;
const port = Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8081);
const host = `127.0.0.1:${port}`;
const dataDir = resolve('test-results/firebase-dev');

// Con gli account servono le regole vere: Firebase le vuole indicate da un file di configurazione
// generato qui, con il percorso completo (non accetta `../` fuori dalla cartella del file).
const accountsConfig = resolve(dataDir, 'firebase.accounts.json');
if (accounts) {
  mkdirSync(dataDir, { recursive: true });
  // Nell'emulatore non c'è la Cloud Function che scrive `derived/`: lo fa il browser (come in
  // `firebase-dev-recalc.js`), quindi in questa copia un membro può leggerlo e scriverlo, anche
  // come elenco intero (le regole vere lo vietano).
  // Le regole vere (`firestore.rules`) non cambiano e restano quelle da pubblicare.
  const devRules = resolve(dataDir, 'firestore.accounts.rules');
  const source = readFileSync(resolve('firestore.rules'), 'utf8');
  const patched = source.replace(
    /(match \/derived\/\{name\} \{)[\s\S]*?(\n\s*\})/,
    '$1\n        allow read, write: if isMember(g);$2',
  );
  if (patched === source) throw new Error('Regola di derived/ non trovata in firestore.rules');
  writeFileSync(devRules, patched);
  writeFileSync(
    accountsConfig,
    JSON.stringify({
      firestore: { rules: devRules },
      emulators: {
        firestore: { host: '127.0.0.1', port },
        auth: { host: '127.0.0.1', port: authPort },
        ui: { enabled: false },
        singleProjectMode: true,
      },
    }),
  );
}

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
    accounts ? 'firestore,auth' : 'firestore',
    '--project',
    'demo-blesscommander',
    '--config',
    accounts ? `"${accountsConfig}"` : 'tests/dev/firebase.dev.json',
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
if (accounts) {
  console.log(`Emulatori su ${host} (dati) e 127.0.0.1:${authPort} (accesso Google finto).`);
} else {
  const count = await writeSeed(dataDir);
  const result = await migrateDirectory(connectEmulator(host), dataDir, EMULATOR_GROUP);
  console.log(
    `Emulatore Firestore su ${host}: ${count} file di prova copiati come ${result.documents} documenti.`,
  );
}

vite = spawn('npm', ['run', 'dev', '-w', 'web'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_DATA_MODE: 'firebase-emulator',
    VITE_FIRESTORE_EMULATOR_HOST: host,
    VITE_FAKE_GITHUB_LOGIN: 'test-owner',
    ...(accounts ? { VITE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}` } : {}),
  },
});
vite.on('exit', stop);

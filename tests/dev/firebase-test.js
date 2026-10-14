import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

/**
 * `npm run test:firebase`: avvia l'emulatore di Firestore su una porta libera, lancia i test del
 * provider e chiude i processi che ha avviato. Su Windows `firebase emulators:exec` può lasciare
 * Java acceso: usando una porta diversa a ogni lancio, un Java rimasto acceso non blocca i test
 * successivi (e lo script non chiude mai processi che non sono suoi).
 */
const freePort = () =>
  new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });

const port = await freePort();
const dir = resolve('test-results/firebase-test');
mkdirSync(dir, { recursive: true });
const rules = resolve('firestore.rules');
writeFileSync(
  resolve(dir, 'firebase.json'),
  JSON.stringify({
    firestore: { rules },
    emulators: {
      firestore: { host: '127.0.0.1', port },
      ui: { enabled: false },
      singleProjectMode: true,
    },
  }),
);

const child = spawn(
  'npx',
  [
    'firebase',
    'emulators:exec',
    '--only',
    'firestore',
    '--project',
    'demo-blesscommander',
    '--config',
    `"${resolve(dir, 'firebase.json')}"`,
    // Con `shell: true` gli spazi spezzerebbero il comando: va tra virgolette.
    '"vitest run web/src/data/firebase-provider.test.js"',
  ],
  { stdio: 'inherit', shell: true },
);

const closeTree = () => {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill();
  }
};

process.on('SIGINT', () => {
  closeTree();
  process.exit(130);
});
child.on('exit', (code) => {
  closeTree();
  process.exit(code ?? 1);
});

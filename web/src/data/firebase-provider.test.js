import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LOGINS, buildSeed, writeSeed } from '../../../tests/seed/seed.js';
import { migrateDirectory } from '../../../data-actions/src/migrate-to-firestore.js';
import { runRecalc } from '../../../data-actions/src/recalc.js';
import { FirebaseProvider } from './firebase-provider.js';
import { readGroupFiles, writeDerivedFiles, writeGroupFiles } from './firestore-files.js';
import { runProviderContract } from './provider-contract.js';

// Servono gli emulatori: `npm run test:firebase`. Senza, queste prove si saltano.
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const GROUP = 'g-test';

let env;
let db;

/** Come l'Action `recalc`, ma sul gruppo in Firestore (in produzione lo fa la Cloud Function). */
async function recalcGroup() {
  const files = await readGroupFiles(db, GROUP);
  const { derived } = runRecalc({ files, unknownAuthor: 'allow' });
  await writeDerivedFiles(db, GROUP, derived);
}

const make = (login, options = {}) =>
  new FirebaseProvider({
    db,
    groupId: GROUP,
    memberId: login,
    now: () => '2026-03-01T10:00:00Z',
    onWrite: recalcGroup,
    ...options,
  });

describe.skipIf(!emulator)('FirebaseProvider (emulatore Firestore)', () => {
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-blesscommander',
      firestore: {
        host,
        port: Number(port),
        // Regole aperte solo qui: le regole vere (E-02b) si provano a parte.
        rules: `rules_version = '2'; service cloud.firestore { match /databases/{d}/documents { match /{x=**} { allow read, write: if true; } } }`,
      },
    });
    await env.clearFirestore();
    db = env.unauthenticatedContext().firestore();
    // Il seed è quello dei repository dati: stessi file, qui diventano documenti.
    await writeGroupFiles(db, GROUP, structuredSeed());
    await recalcGroup();
  });
  afterAll(async () => {
    await env?.cleanup();
  });

  runProviderContract('FirebaseProvider (emulatore)', (login) => make(login), {
    admin: 'test-owner',
    player1: 'test-giocatore1',
    player2: 'test-giocatore2',
    player3: 'test-giocatore3',
  });

  describe('UT-FB percorsi e dati', () => {
    it('rilegge i file scritti, senza perdere nulla (UC-61)', async () => {
      // Un gruppo a parte: quello del contratto è già stato modificato dalle altre prove.
      const seed = buildSeed();
      await writeGroupFiles(db, 'g-roundtrip', seed);
      const back = await readGroupFiles(db, 'g-roundtrip');
      const paths = Object.keys(seed).filter((p) => /^(config|decks|games)\//.test(p));
      expect(paths.length).toBeGreaterThan(50);
      for (const path of paths) expect(JSON.parse(back[path]), path).toEqual(seed[path]);
    });

    it('lo script di migrazione copia una cartella dati e il provider mostra gli stessi dati (UC-61)', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'migrate-'));
      try {
        await writeSeed(dir);
        const result = await migrateDirectory(db, dir, 'g-migrate');
        expect(result.documents).toBeGreaterThan(80);
        expect(result.errors).toBe(0);
        const provider = make('test-giocatore1', { groupId: 'g-migrate' });
        const snapshot = await provider.getSnapshot();
        expect(snapshot.decks).toHaveLength(15);
        expect(snapshot.games.length).toBeGreaterThan(0);
        expect((await provider.getNotifications()).length).toBeGreaterThanOrEqual(2);
        expect(Object.keys(await provider.getMembers())).toContain('test-owner');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('riconosce chi non è nel gruppo', async () => {
      const stranger = make('chi-e-questo');
      await expect(stranger.getCurrentUser()).rejects.toMatchObject({
        code: 'auth',
        details: { reason: 'not-member' },
      });
    });

    it('trova il membro dal collegamento con l’account (memberByUid)', async () => {
      const { setGroupDoc } = await import('./firestore-files.js');
      await setGroupDoc(db, GROUP, ['memberByUid', 'uid-123'], { memberId: LOGINS[1] });
      const provider = make(null, { memberId: null, uid: 'uid-123' });
      expect((await provider.getCurrentUser()).login).toBe(LOGINS[1]);
    });
  });
});

/** Il seed del repository dati, senza lo snapshot segnaposto (lo produce il ricalcolo). */
function structuredSeed() {
  const seed = buildSeed();
  delete seed['derived/snapshot.json'];
  return seed;
}

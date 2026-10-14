// Migrazione dal repository dati (cartella locale) a Firestore (SPEC §6.10).
// Per ora solo verso l'emulatore: il progetto Firebase vero si collega alla voce E-02c, con conferma.
import { pathToFileURL } from 'node:url';
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import {
  readGroupFiles,
  writeDerivedFiles,
  writeGroupFiles,
} from '../../web/src/data/firestore-files.js';
import { readMigrationFiles } from './repo-files.js';
import { runRecalc } from './recalc.js';

/**
 * Copia i dati di `dir` nel gruppo `groupId` e ricalcola `derived/` da zero.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} dir cartella del repository dati
 * @param {string} groupId
 * @returns {Promise<{ documents: number, errors: number }>}
 */
export async function migrateDirectory(db, dir, groupId) {
  const files = await readMigrationFiles(dir);
  const documents = await writeGroupFiles(db, groupId, files);
  const { derived, errors } = runRecalc({
    files: await readGroupFiles(db, groupId),
    unknownAuthor: 'allow',
  });
  await writeDerivedFiles(db, groupId, derived);
  return { documents, errors: errors.length };
}

/** Collega un Firestore all'emulatore locale; rifiuta qualsiasi altro indirizzo. */
export function connectEmulator(hostPort = process.env.FIRESTORE_EMULATOR_HOST) {
  const match = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(hostPort ?? '');
  if (!match) {
    throw new Error(
      'Questa migrazione scrive solo nell’emulatore: avvia gli emulatori e imposta FIRESTORE_EMULATOR_HOST (es. 127.0.0.1:8080).',
    );
  }
  const app = initializeApp({ projectId: 'demo-blesscommander' }, `migrate-${Date.now()}`);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, match[1], Number(match[2]));
  return db;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [dir, groupId] = process.argv.slice(2);
  if (!dir || !groupId) {
    console.error('Uso: node migrate-to-firestore.js <cartella-dati> <idGruppo>');
    process.exit(1);
  }
  const result = await migrateDirectory(connectEmulator(), dir, groupId);
  console.log(
    `Copiati ${result.documents} documenti nel gruppo ${groupId} (${result.errors} file scartati).`,
  );
  process.exit(0);
}

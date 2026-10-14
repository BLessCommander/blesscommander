// Collegamento agli emulatori di Firebase per lo sviluppo locale (`npm run dev:firebase`).
// Il progetto è `demo-…`: non esiste su Firebase e non può raggiungere servizi reali.
import { getApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { AuthService } from './firebase-auth.js';
import { FirebaseProvider } from './firebase-provider.js';
import { GroupsService } from './groups-service.js';

export const EMULATOR_GROUP = 'g-dev';

let shared = null;

/**
 * App, database e accesso condivisi: vanno creati una volta sola (l'emulatore non si ricollega).
 * @param {{ host: string, port: number, authUrl?: string }} options
 */
export function emulatorServices({ host, port, authUrl }) {
  if (shared) return shared;
  const app = (() => {
    try {
      return getApp();
    } catch {
      return initializeApp({
        projectId: 'demo-blesscommander',
        apiKey: 'demo-key',
        // Richiesto per il popup di Google; con l'emulatore la finestra si apre sull'emulatore locale.
        authDomain: 'demo-blesscommander.firebaseapp.com',
      });
    }
  })();
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, port);
  shared = {
    db,
    groups: new GroupsService({ db }),
    auth: authUrl ? new AuthService(getAuth(app), { emulatorUrl: authUrl }) : null,
  };
  return shared;
}

/**
 * @param {{ host: string, port: number, memberId?: string, authUrl?: string, groupId?: string,
 *   resolveUid?: () => Promise<string | null> }} options
 */
export function createEmulatorProvider({
  host,
  port,
  memberId,
  authUrl,
  groupId = EMULATOR_GROUP,
  resolveUid,
}) {
  const { db } = emulatorServices({ host, port, authUrl });
  const recalc = async () => {
    const { recalcGroup } = await import('./firebase-dev-recalc.js');
    await recalcGroup(db, groupId);
  };
  const provider = new FirebaseProvider({
    db,
    groupId,
    memberId,
    resolveUid,
    // Nell'emulatore non c'è la Cloud Function: il ricalcolo si fa qui, caricandolo solo se serve.
    onWrite: recalc,
  });
  // Un gruppo appena creato non ha ancora dati calcolati (la Cloud Function li farebbe da sola).
  const readSnapshot = provider.getSnapshot.bind(provider);
  let bootstrapped = false;
  provider.getSnapshot = async () => {
    const snapshot = await readSnapshot();
    if (snapshot.pendingKind !== 'initial' || bootstrapped || !authUrl) return snapshot;
    bootstrapped = true;
    await recalc();
    return readSnapshot();
  };
  return provider;
}

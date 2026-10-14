// Collegamento all'emulatore di Firestore per lo sviluppo locale (`npm run dev:firebase`).
// Il progetto è `demo-…`: non esiste su Firebase e non può raggiungere servizi reali.
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { FirebaseProvider } from './firebase-provider.js';

export const EMULATOR_GROUP = 'g-dev';

/**
 * @param {{ host: string, port: number, memberId: string }} options
 */
export function createEmulatorProvider({ host, port, memberId }) {
  const db = getFirestore(initializeApp({ projectId: 'demo-blesscommander' }));
  connectFirestoreEmulator(db, host, port);
  return new FirebaseProvider({
    db,
    groupId: EMULATOR_GROUP,
    memberId,
    // Nell'emulatore non c'è la Cloud Function: il ricalcolo si fa qui, caricandolo solo se serve.
    onWrite: async () => {
      const { recalcGroup } = await import('./firebase-dev-recalc.js');
      await recalcGroup(db, EMULATOR_GROUP);
    },
  });
}

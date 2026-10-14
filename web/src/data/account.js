// Account e gruppo attivo (E-04a). Unico punto, insieme a `index.js`, che collega l'app a Firebase.
import { ENVIRONMENT } from '../config/environment.js';
import { readStorage, removeStorage, writeStorage } from '../platform/storage.js';
import { createFakeAccountServices } from './account-fake.js';
import { emulatorServices } from './firebase-emulator.js';

let fake = null;
const ACTIVE_GROUP_KEY = 'blc:active-group';

/** Vero quando si entra con un account (Google) invece che con un membro fisso o con il token. */
export const accountsEnabled =
  ENVIRONMENT.mode === 'firebase-emulator' && Boolean(ENVIRONMENT.authEmulatorUrl);

/** @returns {string | null} */
export function readActiveGroup() {
  return readStorage(ACTIVE_GROUP_KEY);
}

/** @param {string} groupId */
export function saveActiveGroup(groupId) {
  writeStorage(ACTIVE_GROUP_KEY, groupId);
}

export function clearActiveGroup() {
  removeStorage(ACTIVE_GROUP_KEY);
}

/** @returns {{ auth: import('./firebase-auth.js').AuthService, groups: import('./groups-service.js').GroupsService }} */
export function accountServices() {
  // Solo nei test dell'interfaccia: Vite toglie questo ramo dalla build normale.
  if (import.meta.env.VITE_ACCOUNT_FAKE === 'true') return (fake ??= createFakeAccountServices());
  const { auth, groups } = emulatorServices({
    host: ENVIRONMENT.emulatorHost,
    port: ENVIRONMENT.emulatorPort,
    authUrl: ENVIRONMENT.authEmulatorUrl,
  });
  return { auth, groups };
}

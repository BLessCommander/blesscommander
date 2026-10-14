import {
  GoogleAuthProvider,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { DataError, DATA_ERROR } from './errors.js';

/**
 * @typedef {import('firebase/auth').Auth} Auth
 * @typedef {{ uid: string, displayName: string, avatarUrl?: string }} Account
 */

/** @param {import('firebase/auth').User | null} user @returns {Account | null} */
function toAccount(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName || user.email || 'Giocatore',
    ...(user.photoURL ? { avatarUrl: user.photoURL } : {}),
  };
}

/**
 * Accesso con Google (SPEC §6.10). Nessun componente importa Firebase: passano da qui.
 * Nell'emulatore la finestra di Google è una finta locale, senza account veri.
 */
export class AuthService {
  /**
   * @param {Auth} auth
   * @param {{ emulatorUrl?: string }} [options] indirizzo dell'emulatore di Auth (solo locale)
   */
  constructor(auth, { emulatorUrl } = {}) {
    this.auth = auth;
    if (emulatorUrl) connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
  }

  /** Aspetta che Firebase abbia riletto la sessione salvata, poi dà l'account (o null). */
  async current() {
    await this.auth.authStateReady();
    return toAccount(this.auth.currentUser);
  }

  /** @param {(account: Account | null) => void} callback @returns {() => void} */
  onChange(callback) {
    return onAuthStateChanged(this.auth, (user) => callback(toAccount(user)));
  }

  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(this.auth, new GoogleAuthProvider());
      return /** @type {Account} */ (toAccount(result.user));
    } catch (error) {
      const code = error?.code ?? '';
      if (code.includes('popup-closed') || code.includes('cancelled-popup')) {
        throw new DataError(DATA_ERROR.auth, 'Accesso annullato', { reason: 'cancelled' });
      }
      if (code.includes('popup-blocked')) {
        throw new DataError(DATA_ERROR.auth, 'Il browser ha bloccato la finestra', {
          reason: 'popup-blocked',
        });
      }
      throw new DataError(DATA_ERROR.network, 'Accesso con Google non riuscito', {
        firebaseCode: code || String(error?.message ?? ''),
      });
    }
  }

  async signOut() {
    await signOut(this.auth);
  }
}

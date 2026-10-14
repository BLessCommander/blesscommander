import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { DataError, DATA_ERROR } from './errors.js';
import { ulid } from './ulid.js';

/**
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {{ id: string, name: string, role: 'admin' | 'giocatore' }} GroupSummary
 */

// Senza 0/O e 1/I/L: il codice si detta a voce o si legge da uno schermo.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/** @param {() => Uint8Array} [randomBytes] */
export function generateInviteCode(
  randomBytes = () => globalThis.crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH)),
) {
  return Array.from(randomBytes(), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

/** Il codice si scrive come capita: maiuscole, minuscole, spazi. */
export function normalizeInviteCode(raw) {
  return String(raw ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

function failure(error, message) {
  const code = error?.code ?? '';
  if (code.includes('permission-denied')) return new DataError(DATA_ERROR.forbidden, message);
  if (code.includes('unauthenticated')) {
    return new DataError(DATA_ERROR.auth, 'Accesso scaduto: entra di nuovo');
  }
  return new DataError(DATA_ERROR.network, 'Nessuna connessione al database', {
    firebaseCode: code || String(error?.message ?? ''),
  });
}

/**
 * Gruppi dell'account (SPEC §6.10): creare un gruppo, entrare con il codice di invito, elencare i propri.
 * Non fa parte di `DataProvider`: il provider lavora dentro un gruppo già scelto.
 */
export class GroupsService {
  /**
   * @param {object} options
   * @param {Firestore} options.db
   * @param {() => string} [options.now]
   * @param {() => string} [options.newId]
   * @param {() => string} [options.newCode]
   */
  constructor({
    db,
    now = () => new Date().toISOString(),
    newId = () => ulid().toLowerCase(),
    newCode = () => generateInviteCode(),
  }) {
    this.db = db;
    this.now = now;
    this.newId = newId;
    this.newCode = newCode;
  }

  /**
   * @param {string} uid
   * @returns {Promise<GroupSummary[]>}
   */
  async listMyGroups(uid) {
    try {
      const snap = await getDocs(collection(this.db, 'users', uid, 'groups'));
      return snap.docs
        .map((d) => ({ id: d.id, name: d.data().name, role: d.data().role }))
        .sort((a, b) => a.name.localeCompare(b.name, 'it'));
    } catch (error) {
      throw failure(error, 'Non puoi vedere i tuoi gruppi');
    }
  }

  /**
   * Chi crea il gruppo ne è l'admin. Tutto in un'unica scrittura: o c'è tutto o niente.
   * @param {string} uid
   * @param {{ groupName: string, displayName: string, avatarUrl?: string }} input
   * @returns {Promise<GroupSummary & { inviteCode: string }>}
   */
  async createGroup(uid, { groupName, displayName, avatarUrl }) {
    const name = groupName.trim();
    const player = displayName.trim();
    if (!name || !player) {
      throw new DataError(DATA_ERROR.invalid, 'Servono il nome del gruppo e il tuo nome');
    }
    const id = this.newId();
    const inviteCode = this.newCode();
    const createdAt = this.now();
    const batch = writeBatch(this.db);
    const group = doc(this.db, 'groups', id);
    batch.set(group, {
      adminId: uid,
      visibility: 'private',
      inviteCode,
      name,
      createdAt,
    });
    batch.set(doc(group, 'config', 'group'), { name, settings: {}, formats: [], variants: [] });
    batch.set(doc(group, 'members', uid), {
      displayName: player,
      ...(avatarUrl ? { avatarUrl } : {}),
      role: 'admin',
      joinedAt: createdAt,
      uid,
    });
    batch.set(doc(group, 'memberByUid', uid), { memberId: uid });
    batch.set(doc(this.db, 'inviteCodes', inviteCode), { groupId: id });
    batch.set(doc(this.db, 'users', uid, 'groups', id), {
      name,
      role: 'admin',
      joinedAt: createdAt,
    });
    try {
      await batch.commit();
    } catch (error) {
      throw failure(error, 'Non è stato possibile creare il gruppo');
    }
    return { id, name, role: 'admin', inviteCode };
  }

  /**
   * @param {string} uid
   * @param {string} rawCode
   * @param {{ displayName: string, avatarUrl?: string }} input
   * @returns {Promise<GroupSummary>}
   */
  async joinGroup(uid, rawCode, { displayName, avatarUrl }) {
    const inviteCode = normalizeInviteCode(rawCode);
    const player = displayName.trim();
    if (!inviteCode || !player) {
      throw new DataError(DATA_ERROR.invalid, 'Servono il codice di invito e il tuo nome');
    }
    let groupId;
    try {
      const found = await getDoc(doc(this.db, 'inviteCodes', inviteCode));
      groupId = found.exists() ? found.data().groupId : null;
    } catch (error) {
      throw failure(error, 'Non è stato possibile controllare il codice');
    }
    if (!groupId) throw new DataError(DATA_ERROR.notFound, 'Codice di invito non valido');

    const joinedAt = this.now();
    const group = doc(this.db, 'groups', groupId);
    const batch = writeBatch(this.db);
    batch.set(doc(group, 'members', uid), {
      displayName: player,
      ...(avatarUrl ? { avatarUrl } : {}),
      role: 'giocatore',
      joinedAt,
      uid,
      inviteCode,
    });
    batch.set(doc(group, 'memberByUid', uid), { memberId: uid });
    try {
      await batch.commit();
    } catch (error) {
      throw failure(error, 'Il codice non è più valido o sei già nel gruppo');
    }
    // Il nome del gruppo si legge ora che si è membri; il gruppo resta usabile anche se questo passo fallisce.
    let name = groupId;
    try {
      name = (await getDoc(group)).data()?.name ?? groupId;
      await writeBatch(this.db)
        .set(doc(this.db, 'users', uid, 'groups', groupId), { name, role: 'giocatore', joinedAt })
        .commit();
    } catch {
      // l'elenco dei gruppi si riallinea al prossimo accesso (vedi `listMyGroups`)
    }
    return { id: groupId, name, role: 'giocatore' };
  }
}

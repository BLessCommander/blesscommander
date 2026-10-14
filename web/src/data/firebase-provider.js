import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { DataProvider } from './data-provider.js';
import { DataError, DATA_ERROR } from './errors.js';
import { assertValid } from './validate.js';
import { ulid } from './ulid.js';
import { withMember, withoutMember } from './members-rules.js';
import {
  emptyNotificationState,
  mergeNotifications,
  withAnswer,
  withRead,
} from './notifications-rules.js';
import { decodeFromStore, encodeForStore, withoutId } from './firestore-paths.js';

/** @typedef {import('firebase/firestore').Firestore} Firestore */

const clone = (value) => structuredClone(value);

/** Cartelle il cui cambiamento fa ripartire il ricalcolo (stesse del repository dati). */
const RECALC_KINDS = { decks: 'deck', games: 'game', votes: 'vote', config: 'config' };

/**
 * Dati in Firestore (SPEC §6.10), un gruppo per volta: `groups/<groupId>/…`.
 * Il ricalcolo lo fa il backend (Cloud Function, E-02b); `onWrite` permette di simularlo nelle prove.
 */
export class FirebaseProvider extends DataProvider {
  /**
   * @param {object} options
   * @param {Firestore} options.db
   * @param {string} options.groupId
   * @param {string} [options.memberId] chi scrive (prove); altrimenti si ricava da `uid`
   * @param {string} [options.uid] utente di Firebase Auth
   * @param {() => string} [options.now]
   * @param {() => string} [options.newId]
   * @param {(event: { kind: string }) => Promise<void> | void} [options.onWrite]
   */
  constructor({
    db,
    groupId,
    memberId = null,
    uid = null,
    now = () => new Date().toISOString(),
    newId = () => ulid(),
    onWrite = () => {},
  }) {
    super();
    this.db = db;
    this.groupId = groupId;
    this.memberId = memberId;
    this.uid = uid;
    this.now = now;
    this.newId = newId;
    this.onWrite = onWrite;
    this.user = null;
    this.pendingKind = null;
    this.writtenAtSnapshot = undefined;
  }

  // ---------- Supporto ----------

  #doc(...segments) {
    return doc(this.db, 'groups', this.groupId, ...segments);
  }

  #collection(...segments) {
    return collection(this.db, 'groups', this.groupId, ...segments);
  }

  /** Traduce gli errori di Firestore nei codici dell'app. */
  async #call(run) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof DataError) throw error;
      const code = error?.code ?? '';
      if (code.includes('permission-denied')) {
        throw new DataError(DATA_ERROR.forbidden, 'Operazione non permessa');
      }
      if (code.includes('unauthenticated')) {
        throw new DataError(DATA_ERROR.auth, 'Accesso scaduto: entra di nuovo');
      }
      if (code.includes('not-found')) throw new DataError(DATA_ERROR.notFound, 'Non trovato');
      if (code.includes('aborted') || code.includes('already-exists')) {
        throw new DataError(DATA_ERROR.conflict, 'I dati sono stati modificati da qualcun altro');
      }
      throw new DataError(DATA_ERROR.network, 'Nessuna connessione al database');
    }
  }

  async #read(...segments) {
    const snap = await getDoc(this.#doc(...segments));
    return snap.exists() ? decodeFromStore(snap.data()) : null;
  }

  #afterWrite(folder) {
    const kind = RECALC_KINDS[folder];
    if (!kind) return;
    this.pendingKind = kind;
    this.writtenAtSnapshot = this.lastSnapshotJson;
    return this.onWrite({ kind });
  }

  async #memberIdOfUser() {
    if (this.memberId) return this.memberId;
    if (!this.uid) throw new DataError(DATA_ERROR.auth, 'Accesso non effettuato');
    const link = await this.#read('memberByUid', this.uid);
    if (!link) {
      throw new DataError(DATA_ERROR.auth, 'Utente non presente nel gruppo', {
        reason: 'not-member',
      });
    }
    return link.memberId;
  }

  // ---------- Operazioni di DataProvider ----------

  async getCurrentUser() {
    if (this.user) return clone(this.user);
    return this.#call(async () => {
      const login = await this.#memberIdOfUser();
      const member = await this.#read('members', login);
      if (!member) {
        throw new DataError(DATA_ERROR.auth, 'Utente non presente nel gruppo', {
          reason: 'not-member',
        });
      }
      this.user = { login, ...member };
      return clone(this.user);
    });
  }

  async getSnapshot() {
    return this.#call(async () => {
      const data = await this.#read('derived', 'snapshot');
      return this.#toSnapshot(data);
    });
  }

  #toSnapshot(data) {
    if (!data) {
      this.lastSnapshotJson = null;
      return {
        decks: [],
        games: [],
        standings: [],
        updatedAt: this.now(),
        pending: true,
        pendingKind: 'initial',
      };
    }
    assertValid('derived/snapshot', data);
    const json = JSON.stringify(data);
    this.lastSnapshotJson = json;
    const pending = this.writtenAtSnapshot !== undefined && json === this.writtenAtSnapshot;
    if (!pending) this.writtenAtSnapshot = undefined;
    return { ...data, pending, pendingKind: pending ? this.pendingKind : null };
  }

  async getDeck(id) {
    return this.#call(async () => {
      const deck = await this.#read('decks', id);
      if (!deck) throw new DataError(DATA_ERROR.notFound, `Mazzo non trovato: ${id}`);
      const versions = (await getDocs(this.#collection('decks', id, 'versions'))).docs
        .map((d) => ({ version: Number(d.id.slice(1)), ...decodeFromStore(d.data()) }))
        .sort((a, b) => a.version - b.version);
      return { deck: { ...deck, id }, versions };
    });
  }

  async saveDeck(deck) {
    const user = await this.getCurrentUser();
    const id = deck.id ?? this.newId();
    return this.#call(async () => {
      const existing = await this.#read('decks', id);
      if (existing && existing.ownerLogin !== user.login && user.role !== 'admin') {
        throw new DataError(DATA_ERROR.forbidden, 'Solo il proprietario può modificare il mazzo');
      }
      const saved = { currentVersion: 0, ownerLogin: user.login, ...deck, id };
      assertValid('deck', saved);
      await setDoc(this.#doc('decks', id), encodeForStore(withoutId(saved)));
      await this.#afterWrite('decks');
      return clone(saved);
    });
  }

  async saveDeckVersion(id, version) {
    const user = await this.getCurrentUser();
    return this.#call(async () => {
      const { deck } = await this.getDeck(id);
      if (deck.ownerLogin !== user.login && user.role !== 'admin') {
        throw new DataError(DATA_ERROR.forbidden, 'Solo il proprietario può aggiungere versioni');
      }
      const saved = { ...version, version: deck.currentVersion + 1 };
      assertValid('deck-version', saved);
      const batch = writeBatch(this.db);
      batch.set(this.#doc('decks', id, 'versions', `v${saved.version}`), encodeForStore(saved));
      batch.update(this.#doc('decks', id), { currentVersion: saved.version });
      await batch.commit();
      await this.#afterWrite('decks');
      return clone(saved);
    });
  }

  async createGame(game) {
    const user = await this.getCurrentUser();
    const saved = {
      status: 'lobby',
      revision: 0,
      createdBy: user.login,
      recorderLogin: user.login,
      ...game,
      id: game.id ?? this.newId(),
      createdAt: game.createdAt ?? this.now(),
    };
    return this.#call(async () => {
      assertValid('game', saved);
      await setDoc(this.#doc('games', saved.id), encodeForStore(withoutId(saved)));
      await this.#afterWrite('games');
      return clone(saved);
    });
  }

  async updateGame(id, patch) {
    const user = await this.getCurrentUser();
    return this.#call(async () => {
      const ref = this.#doc('games', id);
      let saved;
      await runTransaction(this.db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new DataError(DATA_ERROR.notFound, `Partita non trovata: ${id}`);
        const current = { ...decodeFromStore(snap.data()), id };
        // Solo il registratore chiude una partita (SPEC §3): lo controlla anche il provider.
        if (patch.status === 'ufficiale' && current.recorderLogin !== user.login) {
          throw new DataError(DATA_ERROR.forbidden, 'Solo il registratore può chiudere la partita');
        }
        saved = { ...current, ...patch, id, revision: current.revision + 1 };
        assertValid('game', saved);
        tx.set(ref, encodeForStore(withoutId(saved)));
      });
      await this.#afterWrite('games');
      return clone(saved);
    });
  }

  async vote(kind, targetId, value) {
    const user = await this.getCurrentUser();
    return this.#call(async () => {
      const game = await this.#read('games', targetId);
      if (!game) throw new DataError(DATA_ERROR.notFound, `Partita non trovata: ${targetId}`);
      const saved = { kind, value, createdAt: this.now() };
      assertValid('vote', saved);
      await setDoc(this.#doc('votes', `${targetId}__${user.login}`), saved);
      await this.#afterWrite('votes');
      return clone(saved);
    });
  }

  async requestImport(source, url) {
    const user = await this.getCurrentUser();
    const request = {
      id: this.newId(),
      source,
      url,
      requestedBy: user.login,
      status: 'pending',
      createdAt: this.now(),
    };
    return this.#call(async () => {
      assertValid('request', request);
      await setDoc(this.#doc('requests', request.id), encodeForStore(withoutId(request)));
      await this.onWrite({ kind: 'request' });
      return clone(request);
    });
  }

  async getImportRequest(id) {
    return this.#call(async () => {
      const request = await this.#read('requests', id);
      if (!request) throw new DataError(DATA_ERROR.notFound, `Richiesta non trovata: ${id}`);
      return { ...request, id };
    });
  }

  async getConfig() {
    return this.#call(async () => {
      const config = await this.#read('config', 'group');
      if (!config)
        throw new DataError(DATA_ERROR.notFound, 'Configurazione del gruppo non trovata');
      return config;
    });
  }

  async saveConfig(config) {
    await this.#assertAdmin('Solo un admin può modificare la configurazione');
    return this.#call(async () => {
      assertValid('config/group', config);
      await setDoc(this.#doc('config', 'group'), encodeForStore(config));
      await this.#afterWrite('config');
      return clone(config);
    });
  }

  async #members() {
    const snap = await getDocs(this.#collection('members'));
    return Object.fromEntries(snap.docs.map((d) => [d.id, decodeFromStore(d.data())]));
  }

  async getMembers() {
    return this.#call(async () => {
      const members = await this.#members();
      if (Object.keys(members).length === 0) {
        throw new DataError(DATA_ERROR.notFound, 'Elenco membri non trovato');
      }
      return members;
    });
  }

  async saveMember(login, member) {
    await this.#assertAdmin('Solo un admin può gestire i membri');
    return this.#call(async () => {
      const next = withMember(await this.#members(), login, member, this.now());
      assertValid('config/members', next);
      await setDoc(this.#doc('members', login), encodeForStore(next[login]));
      await this.#afterWrite('config');
      this.user = null;
      return next;
    });
  }

  async removeMember(login) {
    await this.#assertAdmin('Solo un admin può gestire i membri');
    return this.#call(async () => {
      const next = withoutMember(await this.#members(), login);
      await deleteDoc(this.#doc('members', login));
      await this.#afterWrite('config');
      this.user = null;
      return next;
    });
  }

  async #assertAdmin(message) {
    const user = await this.getCurrentUser();
    if (user.role !== 'admin') throw new DataError(DATA_ERROR.forbidden, message);
  }

  async getNotifications() {
    const user = await this.getCurrentUser();
    return this.#call(async () => {
      const [items, state] = await Promise.all([
        this.#read('derived', `notifications__${user.login}`),
        this.#read('userState', user.login),
      ]);
      return mergeNotifications(items?.items ?? [], state ?? emptyNotificationState());
    });
  }

  async markNotificationsRead(ids) {
    return this.#updateNotificationState((state) => withRead(state, ids));
  }

  async answerNotification(id, answer) {
    const user = await this.getCurrentUser();
    const items = await this.#call(() => this.#read('derived', `notifications__${user.login}`));
    if (!items?.items.some((n) => n.id === id && n.actions)) {
      throw new DataError(DATA_ERROR.invalid, 'Questa notifica non prevede risposte');
    }
    return this.#updateNotificationState((state) => withAnswer(state, id, answer));
  }

  async #updateNotificationState(change) {
    const user = await this.getCurrentUser();
    await this.#call(async () => {
      const next = change((await this.#read('userState', user.login)) ?? emptyNotificationState());
      assertValid('user/notifications', next);
      await setDoc(this.#doc('userState', user.login), encodeForStore(next));
    });
    return this.getNotifications();
  }

  /**
   * Avvisa quando lo snapshot calcolato cambia (tempo reale di Firestore).
   * La prima consegna, che è lo stato attuale, non si segnala.
   */
  onSnapshotChange(callback) {
    let first = true;
    return onSnapshot(
      this.#doc('derived', 'snapshot'),
      (snap) => {
        if (first) {
          first = false;
          // Serve a riconoscere, dopo una scrittura, quando il ricalcolo ha risposto.
          if (snap.exists()) this.lastSnapshotJson = JSON.stringify(decodeFromStore(snap.data()));
          return;
        }
        callback(this.#toSnapshot(snap.exists() ? decodeFromStore(snap.data()) : null));
      },
      () => {},
    );
  }
}

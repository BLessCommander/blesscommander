import { DataError, DATA_ERROR } from './errors.js';

/**
 * @typedef {'admin' | 'giocatore'} Role
 * @typedef {{ login: string, displayName: string, avatarUrl?: string, role: Role }} CurrentUser
 * @typedef {Record<string, any>} Doc documento JSON del modello dati (SPEC §6.6)
 * @typedef {{ decks: Doc[], games: Doc[], standings: Doc[], updatedAt: string, pending: boolean }} Snapshot
 * @typedef {'riapertura' | 'contestazione'} VoteKind
 */

/** Nomi delle operazioni dell'interfaccia (SPEC §6.3); il test di contratto li controlla tutti. */
export const PROVIDER_METHODS = Object.freeze([
  'getCurrentUser',
  'getSnapshot',
  'getDeck',
  'saveDeck',
  'saveDeckVersion',
  'createGame',
  'updateGame',
  'vote',
  'requestImport',
  'getConfig',
  'saveConfig',
  'onSnapshotChange',
]);

const notImplemented = (name) => () => {
  throw new DataError(DATA_ERROR.invalid, `${name} non implementato`);
};

/**
 * Interfaccia unica verso i dati. Pagine e store usano solo questa: mai codice di GitHub o Firebase.
 * Le implementazioni (MockProvider, GitHubProvider, FirebaseProvider) la estendono.
 * Il formato dei dati è identico in tutte (SPEC §6.3).
 */
export class DataProvider {
  /** @returns {Promise<CurrentUser>} */
  getCurrentUser() {
    return notImplemented('getCurrentUser')();
  }

  /** @returns {Promise<Snapshot>} */
  getSnapshot() {
    return notImplemented('getSnapshot')();
  }

  /**
   * @param {string} id
   * @returns {Promise<{ deck: Doc, versions: Doc[] }>}
   */
  getDeck(id) {
    return notImplemented('getDeck')(id);
  }

  /**
   * @param {Doc} deck con `id` se esiste già, altrimenti ne viene generato uno
   * @returns {Promise<Doc>} il mazzo salvato
   */
  saveDeck(deck) {
    return notImplemented('saveDeck')(deck);
  }

  /**
   * @param {string} id mazzo
   * @param {Doc} version lista di carte e dati della versione
   * @returns {Promise<Doc>} la versione salvata, con il suo numero
   */
  saveDeckVersion(id, version) {
    return notImplemented('saveDeckVersion')(id, version);
  }

  /**
   * @param {Doc} game
   * @returns {Promise<Doc>}
   */
  createGame(game) {
    return notImplemented('createGame')(game);
  }

  /**
   * @param {string} id
   * @param {Doc} patch
   * @returns {Promise<Doc>}
   */
  updateGame(id, patch) {
    return notImplemented('updateGame')(id, patch);
  }

  /**
   * @param {VoteKind} kind
   * @param {string} targetId
   * @param {boolean} value
   * @returns {Promise<Doc>}
   */
  vote(kind, targetId, value) {
    return notImplemented('vote')(kind, targetId, value);
  }

  /**
   * @param {'archidekt' | 'moxfield' | 'text'} source
   * @param {string} url
   * @returns {Promise<Doc>} la richiesta creata
   */
  requestImport(source, url) {
    return notImplemented('requestImport')(source, url);
  }

  /** @returns {Promise<Doc>} */
  getConfig() {
    return notImplemented('getConfig')();
  }

  /**
   * Solo admin.
   * @param {Doc} config
   * @returns {Promise<Doc>}
   */
  saveConfig(config) {
    return notImplemented('saveConfig')(config);
  }

  /**
   * @param {(snapshot: Snapshot) => void} callback
   * @returns {() => void} funzione per smettere di ascoltare
   */
  onSnapshotChange(callback) {
    return notImplemented('onSnapshotChange')(callback);
  }
}

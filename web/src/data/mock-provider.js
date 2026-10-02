import { DataProvider } from './data-provider.js';
import { DataError, DATA_ERROR } from './errors.js';
import { assertValid } from './validate.js';
import { ulid } from './ulid.js';
import { createDemoState, DEMO_LOGINS } from './seed-demo.js';

/**
 * @typedef {object} MockState
 * @property {Record<string, any>} config
 * @property {Record<string, any>} members login → membro
 * @property {Record<string, any>} decks
 * @property {Record<string, any[]>} versions deckId → versioni
 * @property {Record<string, any>} games
 * @property {Record<string, Record<string, any>>} votes targetId → login → voto
 * @property {Record<string, any>} requests
 */

const clone = (value) => structuredClone(value);

/**
 * Dati in memoria: per i test e per lo sviluppo senza rete. Segue le stesse regole di
 * validazione e autorizzazione degli altri provider, ma non ricalcola le fasce
 * (nello snapshot la fascia è quella dichiarata).
 */
export class MockProvider extends DataProvider {
  /**
   * @param {object} [options]
   * @param {MockState} [options.state] dati iniziali (di default: dati demo)
   * @param {string} [options.login] utente collegato
   * @param {() => string} [options.now] data corrente in formato ISO, sostituibile nei test
   * @param {() => string} [options.newId] generatore di identificativi, sostituibile nei test
   */
  constructor({
    state = createDemoState(),
    login = DEMO_LOGINS.admin,
    now = () => new Date().toISOString(),
    newId = () => ulid(),
  } = {}) {
    super();
    this.state = state;
    this.login = login;
    this.now = now;
    this.newId = newId;
    /** @type {Set<(snapshot: any) => void>} */
    this.listeners = new Set();
  }

  async getCurrentUser() {
    const member = this.state.members[this.login];
    if (!member) throw new DataError(DATA_ERROR.auth, 'Utente non presente nel gruppo');
    return { login: this.login, ...clone(member) };
  }

  async getSnapshot() {
    return this.#snapshot();
  }

  async getDeck(id) {
    const deck = this.state.decks[id];
    if (!deck) throw new DataError(DATA_ERROR.notFound, `Mazzo non trovato: ${id}`);
    return { deck: clone(deck), versions: clone(this.state.versions[id] ?? []) };
  }

  async saveDeck(deck) {
    const existing = deck.id ? this.state.decks[deck.id] : undefined;
    const user = await this.getCurrentUser();
    if (existing && existing.ownerLogin !== user.login && user.role !== 'admin') {
      throw new DataError(DATA_ERROR.forbidden, 'Solo il proprietario può modificare il mazzo');
    }
    const saved = {
      currentVersion: 0,
      ownerLogin: user.login,
      ...deck,
      id: deck.id ?? this.newId(),
    };
    assertValid('deck', saved);
    this.state.decks[saved.id] = clone(saved);
    this.state.versions[saved.id] ??= [];
    this.#notify();
    return clone(saved);
  }

  async saveDeckVersion(id, version) {
    const { deck } = await this.getDeck(id);
    const user = await this.getCurrentUser();
    if (deck.ownerLogin !== user.login && user.role !== 'admin') {
      throw new DataError(DATA_ERROR.forbidden, 'Solo il proprietario può aggiungere versioni');
    }
    const saved = { ...version, version: deck.currentVersion + 1 };
    assertValid('deck-version', saved);
    this.state.versions[id].push(clone(saved));
    this.state.decks[id].currentVersion = saved.version;
    this.#notify();
    return clone(saved);
  }

  async createGame(game) {
    const user = await this.getCurrentUser();
    const saved = {
      status: 'lobby',
      revision: 0,
      createdAt: this.now(),
      createdBy: user.login,
      recorderLogin: user.login,
      ...game,
      id: game.id ?? this.newId(),
    };
    assertValid('game', saved);
    this.state.games[saved.id] = clone(saved);
    this.#notify();
    return clone(saved);
  }

  async updateGame(id, patch) {
    const game = this.state.games[id];
    if (!game) throw new DataError(DATA_ERROR.notFound, `Partita non trovata: ${id}`);
    const user = await this.getCurrentUser();
    // Solo il registratore chiude una partita (SPEC §3): qui lo controlla anche il provider.
    if (patch.status === 'ufficiale' && game.recorderLogin !== user.login) {
      throw new DataError(DATA_ERROR.forbidden, 'Solo il registratore può chiudere la partita');
    }
    const saved = { ...game, ...patch, id, revision: game.revision + 1 };
    assertValid('game', saved);
    this.state.games[id] = clone(saved);
    this.#notify();
    return clone(saved);
  }

  async vote(kind, targetId, value) {
    const user = await this.getCurrentUser();
    if (!this.state.games[targetId]) {
      throw new DataError(DATA_ERROR.notFound, `Partita non trovata: ${targetId}`);
    }
    const saved = { kind, value, createdAt: this.now() };
    assertValid('vote', saved);
    this.state.votes[targetId] ??= {};
    this.state.votes[targetId][user.login] = saved;
    this.#notify();
    return clone(saved);
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
    assertValid('request', request);
    this.state.requests[request.id] = clone(request);
    return clone(request);
  }

  async getConfig() {
    return clone(this.state.config);
  }

  async saveConfig(config) {
    const user = await this.getCurrentUser();
    if (user.role !== 'admin') {
      throw new DataError(DATA_ERROR.forbidden, 'Solo un admin può modificare la configurazione');
    }
    assertValid('config/group', config);
    this.state.config = clone(config);
    this.#notify();
    return clone(config);
  }

  onSnapshotChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  #snapshot() {
    const { decks, games } = this.state;
    const wins = {};
    for (const game of Object.values(games)) {
      if (game.status !== 'ufficiale') continue;
      for (const w of game.winners ?? []) wins[w.deckId] = (wins[w.deckId] ?? 0) + 1;
    }
    return {
      decks: Object.values(decks).map((d) => ({
        ...clone(d),
        tier: { current: d.declaredTier },
        stats: {
          games: Object.values(games).filter(
            (g) => g.status === 'ufficiale' && g.players.some((p) => p.deckId === d.id),
          ).length,
          wins: wins[d.id] ?? 0,
        },
      })),
      games: clone(Object.values(games)),
      standings: [],
      updatedAt: this.now(),
      pending: false,
    };
  }

  #notify() {
    if (this.listeners.size === 0) return;
    const snapshot = this.#snapshot();
    for (const callback of this.listeners) callback(snapshot);
  }
}

import { downloadDeck, downloadUserDecks } from '../domain/archidekt-import.js';
import { createSpellbook } from '../platform/spellbook.js';
import { DataProvider } from './data-provider.js';
import { DataError, DATA_ERROR } from './errors.js';
import { assertValid } from './validate.js';
import { ulid } from './ulid.js';
import { createDemoState, DEMO_LOGINS } from './seed-demo.js';
import { withMember, withoutMember } from './members-rules.js';
import {
  emptyNotificationState,
  mergeNotifications,
  withAnswer,
  withRead,
} from './notifications-rules.js';

/**
 * @typedef {object} MockState
 * @property {Record<string, any>} config
 * @property {Record<string, any>} members login → membro
 * @property {Record<string, any>} decks
 * @property {Record<string, any[]>} versions deckId → versioni
 * @property {Record<string, any>} games
 * @property {Record<string, Record<string, any>>} votes targetId → login → voto
 * @property {Record<string, any>} requests
 * @property {Record<string, any[]>} [notifications] login → notifiche create dalle Actions
 * @property {Record<string, any>} [userState] login → stato letto/risposte
 */

const clone = (value) => structuredClone(value);

// `npm run dev` (modalità Vite "live"): gli import da Archidekt sono veri, passano dal ponte
// `/archidekt-api` del server di sviluppo. Nei test e nella build restano mazzi finti.
const LIVE_ARCHIDEKT = typeof __ARCHIDEKT_LIVE__ !== 'undefined' && __ARCHIDEKT_LIVE__;
const LIVE_BASE = `${import.meta.env?.BASE_URL ?? '/'}archidekt-api/decks`;

/** Elenco finto dei mazzi di un utente Archidekt, in demo. */
const DEMO_USER_DECKS = {
  status: 'done',
  decks: [
    { id: '1001', name: 'Mazzo demo uno', size: 100, url: 'https://archidekt.com/decks/1001' },
    { id: '1002', name: 'Mazzo demo due', size: 100, url: 'https://archidekt.com/decks/1002' },
    { id: '1003', name: 'Mazzo demo tre', size: 99, url: 'https://archidekt.com/decks/1003' },
  ],
};

/** Esito finto dell'Action `import` in demo (l'Action vera esiste solo nel repository dati). */
const DEMO_IMPORT = {
  status: 'done',
  deckName: 'Mazzo di esempio (demo)',
  result:
    "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n1 Command Tower",
};

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

  /** In demo l'Action non esiste: la prima lettura è `pending`, la seconda dà un mazzo di esempio. */
  async getImportRequest(id) {
    const request = this.state.requests[id];
    if (!request) throw new DataError(DATA_ERROR.notFound, `Richiesta non trovata: ${id}`);
    if (request.status === 'pending' && request.source === 'spellbook') {
      // Sviluppo locale: come l'Action `import`, ma da localhost Spellbook risponde anche al browser.
      try {
        const deck = JSON.parse(request.url);
        request.combos = await createSpellbook({ fetchImpl: (...a) => fetch(...a) }).findCombos(
          deck,
        );
        request.status = 'done';
      } catch {
        request.status = 'error';
        request.error = 'Commander Spellbook non risponde';
      }
    } else if (
      request.status === 'pending' &&
      LIVE_ARCHIDEKT &&
      request.source.startsWith('archidekt')
    ) {
      // Sviluppo con dati veri: come farebbe l'Action `import`, ma dal ponte locale di Vite.
      const options = { fetchImpl: (...a) => fetch(...a), base: LIVE_BASE };
      const result =
        request.source === 'archidekt-user'
          ? await downloadUserDecks({ nick: request.url, ...options })
          : await downloadDeck({ url: request.url, ...options });
      Object.assign(request, result.error ? { status: 'error' } : { status: 'done' }, result);
    } else if (request.status === 'pending' && !request.polled) {
      request.polled = true;
    } else if (request.status === 'pending') {
      const known = DEMO_USER_DECKS.decks.find((d) => d.url === request.url);
      Object.assign(
        request,
        request.source === 'archidekt-user'
          ? DEMO_USER_DECKS
          : {
              ...DEMO_IMPORT,
              ...(known ? { deckName: known.name } : {}),
              // Reimport dello stesso link: in demo il mazzo "è cambiato su Archidekt" (una carta in più).
              ...(this.#alreadyImported(request)
                ? { result: `${DEMO_IMPORT.result}\n1 Rhystic Study` }
                : {}),
            },
      );
    }
    return clone({ ...request, id });
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

  async getMembers() {
    return clone(this.state.members);
  }

  async saveMember(login, member) {
    await this.#assertAdmin();
    const next = withMember(this.state.members, login, member, this.now());
    assertValid('config/members', next);
    this.state.members = clone(next);
    this.#notify();
    return clone(next);
  }

  async removeMember(login) {
    await this.#assertAdmin();
    const next = withoutMember(this.state.members, login);
    this.state.members = clone(next);
    this.#notify();
    return clone(next);
  }

  async getNotifications() {
    const user = await this.getCurrentUser();
    return clone(
      mergeNotifications(this.state.notifications?.[user.login] ?? [], this.#userState(user.login)),
    );
  }

  async markNotificationsRead(ids) {
    const user = await this.getCurrentUser();
    return this.#saveUserState(user.login, withRead(this.#userState(user.login), ids));
  }

  async answerNotification(id, answer) {
    const user = await this.getCurrentUser();
    const known = (this.state.notifications?.[user.login] ?? []).find((n) => n.id === id);
    if (!known?.actions) {
      throw new DataError(DATA_ERROR.invalid, 'Questa notifica non prevede risposte');
    }
    return this.#saveUserState(user.login, withAnswer(this.#userState(user.login), id, answer));
  }

  #userState(login) {
    return this.state.userState?.[login] ?? emptyNotificationState();
  }

  async #saveUserState(login, next) {
    assertValid('user/notifications', next);
    this.state.userState ??= {};
    this.state.userState[login] = clone(next);
    return this.getNotifications();
  }

  async #assertAdmin() {
    const user = await this.getCurrentUser();
    if (user.role !== 'admin') {
      throw new DataError(DATA_ERROR.forbidden, 'Solo un admin può gestire i membri');
    }
  }

  onSnapshotChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** Il link di questa richiesta era già stato importato, con una richiesta precedente conclusa? */
  #alreadyImported(request) {
    return Object.values(this.state.requests).some(
      (r) =>
        r !== request &&
        r.source === 'archidekt' &&
        r.url === request.url &&
        r.status === 'done' &&
        r.createdAt <= request.createdAt,
    );
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

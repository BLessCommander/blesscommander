import { DataProvider } from './data-provider.js';
import { DataError, DATA_ERROR } from './errors.js';
import { assertValid } from './validate.js';
import { ulid } from './ulid.js';
import { isOnline as platformIsOnline, watchNetwork } from '../platform/network.js';
import { readStorage, writeStorage } from '../platform/storage.js';

/**
 * @typedef {import('./data-provider.js').Doc} Doc
 * @typedef {{ method: string, args: unknown[] }} QueuedWrite
 */

const GITHUB_API = 'https://api.github.com';
// Il token va solo a GitHub o alla finta API locale (CLAUDE.md, regola 8).
const ALLOWED_BASE = /^(https:\/\/api\.github\.com|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/;
const MAX_ATTEMPTS = 3;
const QUEUEABLE = new Set([
  'saveDeck',
  'saveDeckVersion',
  'createGame',
  'updateGame',
  'vote',
  'requestImport',
]);

const clone = (value) => structuredClone(value);

function encodeBase64(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(base64) {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Nei file l'identificativo è il nome del file: non si ripete dentro il documento. */
function withoutId(doc) {
  const rest = { ...doc };
  delete rest.id;
  return rest;
}

/** @param {string} createdAt data ISO */
function gamePath(id, createdAt) {
  return `games/${createdAt.slice(0, 4)}/${createdAt.slice(5, 7)}/${id}.json`;
}

/**
 * Dati nel repository GitHub del gruppo, tramite l'API REST dei contenuti (SPEC §6.5).
 * Letture condizionali (ETag), scritture con `sha` e nuovi tentativi in caso di conflitto,
 * coda sul dispositivo per le scritture fatte senza rete.
 */
export class GitHubProvider extends DataProvider {
  /**
   * @param {object} options
   * @param {string} options.owner organizzazione
   * @param {string} options.repo repository dati
   * @param {string} options.token token personale (o `token-<login>` della finta API)
   * @param {string} [options.baseUrl] `https://api.github.com` oppure un indirizzo locale
   * @param {typeof fetch} [options.fetch]
   * @param {() => string} [options.now]
   * @param {() => string} [options.newId]
   * @param {() => boolean} [options.isOnline]
   * @param {number} [options.pollMs] ogni quanto controllare se lo snapshot è cambiato
   * @param {boolean} [options.autoFlush] svuota la coda quando torna la rete
   * @param {(event: { type: 'dropped', write: QueuedWrite, error: unknown }) => void} [options.onQueueEvent]
   */
  constructor({
    owner,
    repo,
    token,
    baseUrl = GITHUB_API,
    fetch: fetchImpl = (...args) => globalThis.fetch(...args),
    now = () => new Date().toISOString(),
    newId = () => ulid(),
    isOnline = platformIsOnline,
    pollMs = 30_000,
    autoFlush = false,
    onQueueEvent = () => {},
  }) {
    super();
    const base = baseUrl.replace(/\/$/, '');
    if (!ALLOWED_BASE.test(base)) {
      throw new DataError(DATA_ERROR.invalid, 'Indirizzo non ammesso per il token');
    }
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = base;
    this.fetch = fetchImpl;
    this.now = now;
    this.newId = newId;
    this.isOnline = isOnline;
    this.pollMs = pollMs;
    this.onQueueEvent = onQueueEvent;
    // Campi privati: il token non finisce mai in un log né in un oggetto serializzato.
    this.#token = token;
    /** @type {Map<string, { etag: string, json: any, sha?: string }>} */
    this.cache = new Map();
    /** @type {Map<string, string> | null} */
    this.gamePaths = null;
    this.user = null;
    this.snapshotEtag = null;
    this.writtenAtEtag = undefined;
    /** @type {Set<(snapshot: any) => void>} */
    this.listeners = new Set();
    this.timer = null;
    this.flushing = null;
    this.replaying = false;
    /** @type {string | null} utente di prova scelto con "Agisci come" (solo testMode) */
    this.actingAs = null;
    this.queueKey = `blesscommander.queue.${owner}/${repo}`;
    if (autoFlush) watchNetwork((online) => online && this.flushQueue());
  }

  #token;

  // ---------- Rete ----------

  async #request(method, path, { body, etag } = {}) {
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.#token}`,
          Accept: 'application/vnd.github+json',
          ...(etag ? { 'If-None-Match': etag } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new DataError(DATA_ERROR.network, 'Nessuna connessione a GitHub');
    }
    if (response.ok || response.status === 304) return response;
    if (response.status === 401) {
      throw new DataError(DATA_ERROR.auth, 'Token scaduto o non valido: creane uno nuovo');
    }
    if (response.status === 403) {
      throw new DataError(DATA_ERROR.forbidden, 'GitHub non permette questa operazione');
    }
    if (response.status === 404) throw new DataError(DATA_ERROR.notFound, `Non trovato: ${path}`);
    if (response.status === 409 || (response.status === 422 && method === 'PUT')) {
      throw new DataError(DATA_ERROR.conflict, 'Il file è stato modificato da qualcun altro');
    }
    throw new DataError(DATA_ERROR.network, `GitHub ha risposto con errore ${response.status}`);
  }

  #contents(path) {
    return `/repos/${this.owner}/${this.repo}/contents/${path}`;
  }

  /** @returns {Promise<{ json: any, sha: string, etag: string } | null>} null se il file non esiste */
  async #readFile(path) {
    const cached = this.cache.get(path);
    let response;
    try {
      response = await this.#request('GET', this.#contents(path), { etag: cached?.etag });
    } catch (error) {
      if (error.code === DATA_ERROR.notFound) {
        this.cache.delete(path);
        return null;
      }
      throw error;
    }
    if (response.status === 304 && cached) return { ...cached, json: clone(cached.json) };
    const file = await response.json();
    const entry = {
      etag: response.headers.get('ETag') ?? '',
      sha: file.sha,
      json: JSON.parse(decodeBase64(file.content)),
    };
    this.cache.set(path, entry);
    return { ...entry, json: clone(entry.json) };
  }

  /** @returns {Promise<{ name: string, path: string, type: string }[]>} vuota se la cartella non esiste */
  async #listDir(path) {
    try {
      const response = await this.#request('GET', this.#contents(path));
      return await response.json();
    } catch (error) {
      if (error.code === DATA_ERROR.notFound) return [];
      throw error;
    }
  }

  /**
   * Legge il file, applica `mutate` e lo scrive; se nel frattempo è cambiato rilegge e riapplica
   * la modifica (massimo 3 tentativi, SPEC §6.5). `mutate` riceve null se il file non esiste.
   * @param {string} path
   * @param {(current: any | null) => any} mutate
   * @param {string} message
   */
  async #update(path, mutate, message) {
    for (let attempt = 1; ; attempt += 1) {
      const current = await this.#readFile(path);
      const next = mutate(current ? current.json : null);
      try {
        const response = await this.#request('PUT', this.#contents(path), {
          body: {
            message,
            content: encodeBase64(`${JSON.stringify(next, null, 2)}\n`),
            ...(current ? { sha: current.sha } : {}),
          },
        });
        const saved = await response.json();
        this.cache.delete(path);
        this.writtenAtEtag = this.snapshotEtag;
        this.#notify();
        return { json: next, sha: saved.content?.sha };
      } catch (error) {
        if (error.code !== DATA_ERROR.conflict || attempt >= MAX_ATTEMPTS) throw error;
        this.cache.delete(path);
      }
    }
  }

  // ---------- Coda offline ----------

  /** @returns {QueuedWrite[]} */
  #loadQueue() {
    try {
      return JSON.parse(readStorage(this.queueKey) || '[]');
    } catch {
      return [];
    }
  }

  #saveQueue(queue) {
    writeStorage(this.queueKey, JSON.stringify(queue));
  }

  /** Numero di scritture in attesa di rete. */
  pendingWrites() {
    return this.#loadQueue().length;
  }

  /** Rilancia in ordine le scritture in coda; si ferma alla prima che trova ancora senza rete. */
  flushQueue() {
    this.flushing ??= (async () => {
      try {
        for (;;) {
          const [next] = this.#loadQueue();
          if (!next || !this.isOnline()) return;
          this.replaying = true;
          try {
            await this[next.method](...next.args);
          } catch (error) {
            if (error.code === DATA_ERROR.network) return;
            this.onQueueEvent({ type: 'dropped', write: next, error });
          } finally {
            this.replaying = false;
          }
          // Si rilegge la coda: nel frattempo possono essere arrivate altre scritture.
          this.#saveQueue(this.#loadQueue().slice(1));
        }
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }

  /**
   * Esegue una scrittura; senza rete la mette in coda e restituisce `optimistic`.
   * @template T
   * @param {string} method
   * @param {unknown[]} args argomenti già completi di id e date, così la ripetizione è identica
   * @param {T} optimistic
   * @param {() => Promise<T>} run
   */
  async #write(method, args, optimistic, run) {
    // Durante il rilancio della coda gli errori di rete risalgono a `flushQueue`, che si ferma.
    if (this.replaying) return run();
    if (this.isOnline()) {
      try {
        return await run();
      } catch (error) {
        if (error.code !== DATA_ERROR.network) throw error;
      }
    }
    if (!QUEUEABLE.has(method)) {
      throw new DataError(DATA_ERROR.network, 'Nessuna connessione a GitHub');
    }
    this.#saveQueue([...this.#loadQueue(), { method, args }]);
    return { ...optimistic, queued: true };
  }

  // ---------- "Agisci come" (solo repository di prova, SPEC §6.7) ----------

  #stamp() {
    return this.actingAs ? { actingAs: this.actingAs } : {};
  }

  /** L'utente che firma le scritture: quello di prova se scelto, altrimenti chi ha fatto l'accesso. */
  async #actor() {
    const user = await this.getCurrentUser();
    if (!this.actingAs) return user;
    const members = await this.#readFile('config/members.json');
    const member = members?.json[this.actingAs];
    if (!member) throw new DataError(DATA_ERROR.forbidden, 'Utente di prova non trovato');
    return { login: this.actingAs, ...member };
  }

  /**
   * Il selettore è ammesso solo se il repository è in `testMode` e chi ha fatto l'accesso è un
   * `testOperator`: sul repository reale `enabled` è sempre falso.
   * @returns {Promise<{ enabled: boolean, members: { login: string, displayName: string }[], current: string | null }>}
   */
  async actingAsOptions() {
    const [config, user] = await Promise.all([this.getConfig(), this.getCurrentUser()]);
    const enabled = config.testMode === true && (config.testOperators ?? []).includes(user.login);
    if (!enabled) return { enabled: false, members: [], current: null };
    const members = await this.#readFile('config/members.json');
    return {
      enabled: true,
      members: Object.entries(members?.json ?? {}).map(([login, m]) => ({
        login,
        displayName: m.displayName,
      })),
      current: this.actingAs,
    };
  }

  /** @param {string | null} login `null` torna a firmare con il proprio utente */
  async setActingAs(login) {
    if (login !== null) {
      const options = await this.actingAsOptions();
      if (!options.enabled || !options.members.some((m) => m.login === login)) {
        throw new DataError(DATA_ERROR.forbidden, '"Agisci come" non è ammesso qui');
      }
    }
    this.actingAs = login;
  }

  // ---------- Operazioni di DataProvider ----------

  async getCurrentUser() {
    if (this.user) return clone(this.user);
    const response = await this.#request('GET', '/user');
    const { login } = await response.json();
    const members = await this.#readFile('config/members.json');
    const member = members?.json[login];
    if (!member) throw new DataError(DATA_ERROR.auth, 'Utente non presente nel gruppo');
    this.user = { login, ...member };
    return clone(this.user);
  }

  async getSnapshot() {
    const file = await this.#readFile('derived/snapshot.json');
    this.snapshotEtag = file?.etag ?? null;
    if (!file) {
      return { decks: [], games: [], standings: [], updatedAt: this.now(), pending: true };
    }
    assertValid('derived/snapshot', file.json);
    const pending = this.writtenAtEtag !== undefined && file.etag === this.writtenAtEtag;
    if (!pending) this.writtenAtEtag = undefined;
    return { ...file.json, pending };
  }

  async getDeck(id) {
    const file = await this.#readFile(`decks/${id}.json`);
    if (!file) throw new DataError(DATA_ERROR.notFound, `Mazzo non trovato: ${id}`);
    const entries = await this.#listDir(`decks/${id}`);
    const versionFiles = entries
      .filter((e) => e.type === 'file' && /^v\d+\.json$/.test(e.name))
      .sort((a, b) => Number(a.name.slice(1, -5)) - Number(b.name.slice(1, -5)));
    const versions = [];
    for (const entry of versionFiles) {
      const version = await this.#readFile(entry.path);
      versions.push({ version: Number(entry.name.slice(1, -5)), ...version.json });
    }
    return { deck: { ...file.json, id }, versions };
  }

  async saveDeck(deck) {
    const user = await this.#actor();
    const id = deck.id ?? this.newId();
    const withId = { ...deck, id, ...this.#stamp() };
    return this.#write('saveDeck', [withId], withId, async () => {
      let saved;
      await this.#update(
        `decks/${id}.json`,
        (existing) => {
          if (existing && existing.ownerLogin !== user.login && user.role !== 'admin') {
            throw new DataError(
              DATA_ERROR.forbidden,
              'Solo il proprietario può modificare il mazzo',
            );
          }
          saved = { currentVersion: 0, ownerLogin: user.login, ...withId };
          assertValid('deck', saved);
          return withoutId(saved);
        },
        `Mazzo: ${deck.name ?? id}`,
      );
      return clone(saved);
    });
  }

  async saveDeckVersion(id, version) {
    const user = await this.#actor();
    return this.#write('saveDeckVersion', [id, version], { ...version }, async () => {
      const { deck } = await this.getDeck(id);
      if (deck.ownerLogin !== user.login && user.role !== 'admin') {
        throw new DataError(DATA_ERROR.forbidden, 'Solo il proprietario può aggiungere versioni');
      }
      const saved = { ...version, version: deck.currentVersion + 1 };
      assertValid('deck-version', saved);
      // Prima la versione, poi il mazzo: se si interrompe a metà, la ripetizione riscrive la stessa.
      await this.#update(
        `decks/${id}/v${saved.version}.json`,
        () => saved,
        `Versione ${saved.version}`,
      );
      await this.#update(
        `decks/${id}.json`,
        (current) => ({ ...current, currentVersion: saved.version }),
        `Mazzo ${id}: versione ${saved.version}`,
      );
      return clone(saved);
    });
  }

  async createGame(game) {
    const user = await this.#actor();
    const saved = {
      status: 'lobby',
      revision: 0,
      createdBy: user.login,
      recorderLogin: user.login,
      ...game,
      ...this.#stamp(),
      id: game.id ?? this.newId(),
      createdAt: game.createdAt ?? this.now(),
    };
    return this.#write('createGame', [saved], saved, async () => {
      assertValid('game', saved);
      await this.#update(
        gamePath(saved.id, saved.createdAt),
        () => withoutId(saved),
        `Partita ${saved.id}`,
      );
      (await this.#gamePaths()).set(saved.id, gamePath(saved.id, saved.createdAt));
      return clone(saved);
    });
  }

  async updateGame(id, patch) {
    const user = await this.#actor();
    const stamped = { ...patch, ...this.#stamp() };
    return this.#write('updateGame', [id, stamped], { id, ...stamped }, async () => {
      const path = await this.#findGame(id);
      let saved;
      await this.#update(
        path,
        (current) => {
          const game = { ...current, id };
          // Solo il registratore chiude una partita (SPEC §3): lo controlla anche il provider.
          if (stamped.status === 'ufficiale' && game.recorderLogin !== user.login) {
            throw new DataError(
              DATA_ERROR.forbidden,
              'Solo il registratore può chiudere la partita',
            );
          }
          saved = { ...game, ...stamped, id, revision: game.revision + 1 };
          assertValid('game', saved);
          return withoutId(saved);
        },
        `Partita ${id}: aggiornamento`,
      );
      return clone(saved);
    });
  }

  async vote(kind, targetId, value) {
    const user = await this.#actor();
    const saved = { kind, value, createdAt: this.now(), ...this.#stamp() };
    return this.#write('vote', [kind, targetId, value], saved, async () => {
      await this.#findGame(targetId);
      assertValid('vote', saved);
      await this.#update(
        `votes/${targetId}/${user.login}.json`,
        () => saved,
        `Voto su ${targetId}`,
      );
      return clone(saved);
    });
  }

  async requestImport(source, url) {
    const user = await this.#actor();
    const request = {
      id: this.newId(),
      source,
      url,
      requestedBy: user.login,
      status: 'pending',
      createdAt: this.now(),
      ...this.#stamp(),
    };
    return this.#write('requestImport', [source, url], request, async () => {
      assertValid('request', request);
      await this.#update(
        `requests/${request.id}.json`,
        () => withoutId(request),
        `Import ${source}`,
      );
      return clone(request);
    });
  }

  async getConfig() {
    const file = await this.#readFile('config/group.json');
    if (!file) throw new DataError(DATA_ERROR.notFound, 'Configurazione del gruppo non trovata');
    return file.json;
  }

  async saveConfig(config) {
    const user = await this.getCurrentUser();
    if (user.role !== 'admin') {
      throw new DataError(DATA_ERROR.forbidden, 'Solo un admin può modificare la configurazione');
    }
    assertValid('config/group', config);
    await this.#update('config/group.json', () => config, 'Configurazione del gruppo');
    return clone(config);
  }

  onSnapshotChange(callback) {
    this.listeners.add(callback);
    this.timer ??= setInterval(() => this.#poll(), this.pollMs);
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  // ---------- Supporto ----------

  /** Mappa id → percorso delle partite, costruita una volta sola dall'elenco delle cartelle. */
  async #gamePaths() {
    if (this.gamePaths) return this.gamePaths;
    const paths = new Map();
    for (const year of await this.#listDir('games')) {
      if (year.type !== 'dir') continue;
      for (const month of await this.#listDir(year.path)) {
        if (month.type !== 'dir') continue;
        for (const file of await this.#listDir(month.path)) {
          if (file.type === 'file' && file.name.endsWith('.json')) {
            paths.set(file.name.slice(0, -5), file.path);
          }
        }
      }
    }
    this.gamePaths = paths;
    return paths;
  }

  async #findGame(id) {
    let path = (await this.#gamePaths()).get(id);
    if (!path) {
      this.gamePaths = null; // forse l'ha creata un altro dopo la prima lettura
      path = (await this.#gamePaths()).get(id);
    }
    if (!path) throw new DataError(DATA_ERROR.notFound, `Partita non trovata: ${id}`);
    return path;
  }

  async #poll() {
    const before = this.snapshotEtag;
    try {
      const snapshot = await this.getSnapshot();
      if (this.snapshotEtag !== before) this.#emit(snapshot);
    } catch {
      // senza rete si riprova al prossimo giro
    }
  }

  #notify() {
    if (this.listeners.size === 0) return;
    this.getSnapshot()
      .then((snapshot) => this.#emit(snapshot))
      .catch(() => {});
  }

  #emit(snapshot) {
    for (const callback of this.listeners) callback(snapshot);
  }
}

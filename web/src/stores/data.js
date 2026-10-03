import { defineStore } from 'pinia';
import { createDataProvider } from '../data/index.js';

// Fuori dallo store: un oggetto reattivo (proxy) non può usare i campi privati (#) del provider.
/** @type {import('../data/data-provider.js').DataProvider | null} */
let provider = null;
/** @type {(() => void) | null} */
let unsubscribe = null;

const message = (error) => (error instanceof Error ? error.message : String(error));

/** Unico punto di accesso ai dati per le pagine: passa sempre da `DataProvider` (SPEC §6.3). */
export const useDataStore = defineStore('data', {
  state: () => ({
    /** @type {import('../data/data-provider.js').CurrentUser | null} */
    user: null,
    /** @type {import('../data/data-provider.js').Snapshot | null} */
    snapshot: null,
    loading: false,
    /** @type {string | null} */
    error: null,
    /** @type {string | null} codice `DATA_ERROR` dell'ultimo errore di caricamento */
    errorCode: null,
    /** Scritture salvate sul dispositivo in attesa di rete. */
    pendingWrites: 0,
    /** @type {{ method: string, message: string }[]} scritture rifiutate al rilancio della coda */
    dropped: [],
    /** @type {{ enabled: boolean, testMode: boolean, members: { login: string, displayName: string }[], current: string | null }} */
    actingAsOptions: { enabled: false, testMode: false, members: [], current: null },
    /** @type {Record<string, any>} login → membro (pagina Gruppo) */
    members: {},
    /** @type {import('../data/data-provider.js').Notification[]} */
    notifications: [],
    /** @type {any[]} mazzi appena salvati che lo snapshot non contiene ancora (fino al ricalcolo) */
    optimisticDecks: [],
  }),
  getters: {
    /** Mazzi dello snapshot più quelli salvati e non ancora ricalcolati, con `optimistic: true`. */
    snapshotWithPending: (state) => {
      if (!state.snapshot) return null;
      const known = new Set(state.snapshot.decks.map((d) => d.id));
      const extra = state.optimisticDecks
        .filter((d) => !known.has(d.id))
        .map((d) => ({ ...d, optimistic: true }));
      return extra.length
        ? { ...state.snapshot, decks: [...state.snapshot.decks, ...extra] }
        : state.snapshot;
    },
    /** Il ricalcolo delle fasce non ha ancora letto le ultime modifiche. */
    refreshing: (state) => state.snapshot?.pending === true,
    /** Che cosa attende il ricalcolo (`deck`, `game`, `vote`, `config`, `initial`); per scegliere il testo. */
    refreshingKind: (state) => state.snapshot?.pendingKind ?? 'game',
    /** Chi ha una partita in lobby o in corso non riceve notifiche (regola 1). */
    notificationsPaused: (state) =>
      Boolean(
        state.user &&
        state.snapshot?.games.some(
          (g) =>
            (g.status === 'lobby' || g.status === 'in_corso') &&
            (g.recorderLogin === state.user.login ||
              g.players.some((p) => p.login === state.user.login)),
        ),
      ),
    unreadCount() {
      return this.notificationsPaused ? 0 : this.notifications.filter((n) => !n.read).length;
    },
  },
  actions: {
    async load() {
      this.loading = true;
      this.error = null;
      this.errorCode = null;
      try {
        provider ??= createDataProvider({
          onQueueEvent: (event) => {
            if (event.type !== 'dropped') return;
            this.dropped.push({ method: event.write.method, message: message(event.error) });
            this.syncStatus();
          },
        });
        this.user = await provider.getCurrentUser();
        this.snapshot = await provider.getSnapshot();
        unsubscribe ??= provider.onSnapshotChange((snapshot) => {
          this.snapshot = snapshot;
          this.pruneOptimisticDecks();
          this.syncStatus();
        });
        await this.loadActingAs();
        await this.loadNotifications();
        this.syncStatus();
      } catch (error) {
        this.error = message(error);
        this.errorCode = error?.code ?? null;
      } finally {
        this.loading = false;
      }
    },

    /** Aggiorna il numero di scritture in coda (solo i provider con coda offline ce l'hanno). */
    syncStatus() {
      this.pendingWrites = provider?.pendingWrites?.() ?? 0;
    },

    /** Rilancia la coda (di solito lo fa da sola quando torna la rete). */
    async flushQueue() {
      await provider?.flushQueue?.();
      this.syncStatus();
    },

    dismissDropped() {
      this.dropped = [];
    },

    /**
     * Esegue una scrittura del provider e aggiorna lo stato della coda.
     * @param {'saveDeck' | 'saveDeckVersion' | 'createGame' | 'updateGame' | 'vote' | 'requestImport'} method
     * @param {...unknown} args
     */
    async write(method, ...args) {
      if (!provider) throw new Error('Dati non ancora caricati');
      try {
        const result = await provider[method](...args);
        if (method === 'saveDeck') this.rememberDeck(result);
        else if (method === 'saveDeckVersion') this.rememberDeckVersion(args[0], result);
        return result;
      } finally {
        this.syncStatus();
      }
    },

    /** Un secondo salvataggio dello stesso mazzo sostituisce il primo. */
    rememberDeck(deck) {
      if (!deck?.id) return;
      const others = this.optimisticDecks.filter((d) => d.id !== deck.id);
      // Niente potatura qui: lo snapshot dello store è ancora quello di prima della scrittura.
      this.optimisticDecks = [...others, deck];
    },

    rememberDeckVersion(deckId, version) {
      const deck = this.optimisticDecks.find((d) => d.id === deckId);
      if (deck && typeof version?.version === 'number') deck.currentVersion = version.version;
    },

    /** Quando lo snapshot ha già il mazzo, o il ricalcolo è finito, il dato provvisorio non serve più. */
    pruneOptimisticDecks() {
      if (!this.snapshot) return;
      if (!this.snapshot.pending) {
        this.optimisticDecks = [];
        return;
      }
      const known = new Set(this.snapshot.decks.map((d) => d.id));
      this.optimisticDecks = this.optimisticDecks.filter((d) => !known.has(d.id));
    },

    /** Mazzo e versioni salvate (vedi `DataProvider.getDeck`). */
    async getDeck(id) {
      if (!provider) throw new Error('Dati non ancora caricati');
      return provider.getDeck(id);
    },

    /** Stato di una richiesta di import (vedi `DataProvider.getImportRequest`). */
    async getImportRequest(id) {
      if (!provider) throw new Error('Dati non ancora caricati');
      return provider.getImportRequest(id);
    },

    async loadMembers() {
      if (!provider) throw new Error('Dati non ancora caricati');
      this.members = await provider.getMembers();
    },

    /**
     * @param {string} login
     * @param {{ displayName: string, role: 'admin' | 'giocatore' }} member
     */
    async saveMember(login, member) {
      if (!provider) throw new Error('Dati non ancora caricati');
      this.members = await provider.saveMember(login, member);
      await this.refreshUser();
    },

    /** @param {string} login */
    async removeMember(login) {
      if (!provider) throw new Error('Dati non ancora caricati');
      this.members = await provider.removeMember(login);
      await this.refreshUser();
    },

    /** Un errore qui non deve bloccare l'app: le notifiche restano vuote. */
    async loadNotifications() {
      if (!provider) return;
      try {
        this.notifications = await provider.getNotifications();
      } catch {
        this.notifications = [];
      }
    },

    /** @param {string[]} ids */
    async markNotificationsRead(ids) {
      if (!provider) throw new Error('Dati non ancora caricati');
      this.notifications = await provider.markNotificationsRead(ids);
    },

    /** @param {string} id @param {'yes' | 'no'} answer */
    async answerNotification(id, answer) {
      if (!provider) throw new Error('Dati non ancora caricati');
      this.notifications = await provider.answerNotification(id, answer);
    },

    /** Dopo un cambio di ruolo il proprio ruolo può essere cambiato: si rilegge. */
    async refreshUser() {
      try {
        this.user = await provider.getCurrentUser();
      } catch {
        // Se non siamo più membri, il prossimo caricamento mostrerà l'errore di accesso.
        this.user = null;
      }
    },

    async loadActingAs() {
      const none = { enabled: false, testMode: false, members: [], current: null };
      try {
        this.actingAsOptions = (await provider?.actingAsOptions?.()) ?? none;
      } catch {
        this.actingAsOptions = none;
      }
    },

    /** @param {string | null} login utente di prova, o `null` per tornare a sé stessi */
    async setActingAs(login) {
      await provider?.setActingAs?.(login);
      await this.loadActingAs();
      await this.loadNotifications();
    },
  },
});

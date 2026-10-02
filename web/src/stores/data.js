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
  }),
  getters: {
    /** Il ricalcolo delle fasce non ha ancora letto le ultime modifiche. */
    refreshing: (state) => state.snapshot?.pending === true,
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
          this.syncStatus();
        });
        await this.loadActingAs();
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
        return await provider[method](...args);
      } finally {
        this.syncStatus();
      }
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
    },
  },
});

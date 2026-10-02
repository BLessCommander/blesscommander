import { defineStore } from 'pinia';
import { createDataProvider } from '../data/index.js';

// Fuori dallo store: un oggetto reattivo (proxy) non può usare i campi privati (#) del provider.
/** @type {import('../data/data-provider.js').DataProvider | null} */
let provider = null;
/** @type {(() => void) | null} */
let unsubscribe = null;

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
  }),
  actions: {
    async load() {
      this.loading = true;
      this.error = null;
      try {
        provider ??= createDataProvider();
        this.user = await provider.getCurrentUser();
        this.snapshot = await provider.getSnapshot();
        unsubscribe ??= provider.onSnapshotChange((snapshot) => {
          this.snapshot = snapshot;
        });
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.loading = false;
      }
    },
  },
});

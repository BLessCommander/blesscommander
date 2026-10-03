// Archivio locale per i dati delle carte (IndexedDB). Se il browser lo blocca (finestra privata,
// dati del sito disattivati) si ripiega su una Map in memoria, come `storage.js`.

const DB_NAME = 'bracketeer-cards';
const STORE = 'cards';

/** @typedef {{ get: (key: string) => Promise<any>, set: (key: string, value: any) => Promise<void> }} CardStore */

/** @returns {CardStore} archivio solo in memoria (anche per i test) */
export function createMemoryStore() {
  const map = new Map();
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
  };
}

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** @returns {CardStore} */
export function createIdbStore() {
  const fallback = createMemoryStore();
  /** @type {Promise<IDBDatabase | null> | null} */
  let db = null;
  const open = () => {
    db ??= (globalThis.indexedDB ? openDb() : Promise.resolve(null)).catch(() => null);
    return db;
  };
  /** @param {IDBRequest} request */
  const done = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  return {
    async get(key) {
      const database = await open();
      if (!database) return fallback.get(key);
      try {
        return await done(database.transaction(STORE).objectStore(STORE).get(key));
      } catch {
        return fallback.get(key);
      }
    },
    async set(key, value) {
      const database = await open();
      if (!database) return fallback.set(key, value);
      try {
        await done(database.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key));
      } catch {
        await fallback.set(key, value);
      }
    },
  };
}

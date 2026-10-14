import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import {
  decodeFromStore,
  docSegments,
  encodeForStore,
  filePath,
  withoutId,
} from './firestore-paths.js';

// Lettura e scrittura di un intero gruppo come "insieme di file" (percorso → contenuto),
// lo stesso formato che usano il ricalcolo e la migrazione. Qui è l'unico punto che
// traduce tra i due mondi (SPEC §6.10).

/** @typedef {import('firebase/firestore').Firestore} Firestore */

const BATCH_SIZE = 400;
/** Documenti che il ricalcolo non produce e quindi non cancella: le notifiche le genera altro codice. */
const KEEP_DERIVED = /^notifications__/;

const groupDoc = (db, groupId, segments) => doc(db, 'groups', groupId, ...segments);
const groupCollection = (db, groupId, ...segments) =>
  collection(db, 'groups', groupId, ...segments);

/**
 * Tutti i file di input di un gruppo, come li leggerebbe l'Action `recalc` dal repository.
 * @param {Firestore} db
 * @param {string} groupId
 * @returns {Promise<Record<string, string>>} percorso → testo JSON
 */
export async function readGroupFiles(db, groupId) {
  const files = {};
  const put = (path, json) => {
    files[path] = JSON.stringify(json);
  };

  const config = await getDocs(groupCollection(db, groupId, 'config'));
  for (const d of config.docs) {
    if (d.id === 'group') put('config/group.json', decodeFromStore(d.data()));
  }

  const members = {};
  for (const d of (await getDocs(groupCollection(db, groupId, 'members'))).docs) {
    members[d.id] = decodeFromStore(d.data());
  }
  if (Object.keys(members).length > 0) put('config/members.json', members);

  for (const d of (await getDocs(groupCollection(db, groupId, 'decks'))).docs) {
    put(`decks/${d.id}.json`, withoutId(decodeFromStore(d.data())));
    const versions = await getDocs(groupCollection(db, groupId, 'decks', d.id, 'versions'));
    for (const v of versions.docs) put(`decks/${d.id}/${v.id}.json`, decodeFromStore(v.data()));
  }

  for (const name of ['games', 'votes', 'requests']) {
    for (const d of (await getDocs(groupCollection(db, groupId, name))).docs) {
      const data = decodeFromStore(d.data());
      const path = filePath([name, d.id], data);
      if (path) put(path, name === 'votes' ? data : withoutId(data));
    }
  }
  return files;
}

/**
 * Scrive un insieme di file (percorso → oggetto JSON) come documenti del gruppo.
 * Serve alla migrazione dal repository dati e alle prove.
 * @param {Firestore} db
 * @param {string} groupId
 * @param {Record<string, any>} files
 * @returns {Promise<number>} documenti scritti
 */
export async function writeGroupFiles(db, groupId, files) {
  /** @type {Array<{ segments: string[], data: any }>} */
  const writes = [];
  for (const [path, json] of Object.entries(files)) {
    if (path === 'config/members.json') {
      for (const [memberId, member] of Object.entries(json)) {
        writes.push({ segments: ['members', memberId], data: member });
      }
      continue;
    }
    const segments = docSegments(path);
    if (!segments) continue;
    writes.push({ segments, data: Array.isArray(json) ? { items: json } : json });
  }
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const { segments, data } of writes.slice(i, i + BATCH_SIZE)) {
      batch.set(groupDoc(db, groupId, segments), encodeForStore(data));
    }
    await batch.commit();
  }
  return writes.length;
}

/**
 * Sostituisce i documenti di `derived/` con il risultato del ricalcolo (sempre da zero).
 * @param {Firestore} db
 * @param {string} groupId
 * @param {Record<string, unknown>} derived percorso → contenuto, come restituisce `runRecalc`
 */
export async function writeDerivedFiles(db, groupId, derived) {
  const wanted = new Map();
  for (const [path, json] of Object.entries(derived)) {
    const segments = docSegments(path);
    if (segments) wanted.set(segments[1], Array.isArray(json) ? { items: json } : json);
  }
  const existing = await getDocs(groupCollection(db, groupId, 'derived'));
  const stale = existing.docs.filter((d) => !wanted.has(d.id) && !KEEP_DERIVED.test(d.id));
  for (const d of stale) await deleteDoc(d.ref);
  const entries = [...wanted.entries()];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const [id, data] of entries.slice(i, i + BATCH_SIZE)) {
      batch.set(groupDoc(db, groupId, ['derived', id]), encodeForStore(data));
    }
    await batch.commit();
  }
}

/** Scrive un solo documento (per i test e per i profili). */
export function setGroupDoc(db, groupId, segments, data) {
  return setDoc(groupDoc(db, groupId, segments), encodeForStore(data));
}

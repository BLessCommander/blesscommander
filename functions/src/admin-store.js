// Archivio del backend su Firestore con l'Admin SDK (E-02b). Traduce tra documenti e "file" con
// le stesse funzioni di percorso del client (`web/src/data/firestore-paths.js`), come `firestore-files.js`.
import {
  decodeFromStore,
  docSegments,
  encodeForStore,
  filePath,
  withoutId,
} from '../../web/src/data/firestore-paths.js';

const BATCH_SIZE = 400;
/** Le notifiche non le produce il ricalcolo: non si cancellano. */
const KEEP_DERIVED = /^notifications__/;

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {import('../../data-actions/src/backend.js').BackendStore}
 */
export function createAdminStore(db) {
  const group = (g) => db.collection('groups').doc(g);
  const read = async (ref) => {
    const snap = await ref.get();
    return snap.exists ? decodeFromStore(snap.data()) : null;
  };

  return {
    async readFiles(g) {
      const files = {};
      const put = (path, json) => {
        files[path] = JSON.stringify(json);
      };
      const config = await read(group(g).collection('config').doc('group'));
      if (config) put('config/group.json', config);

      const members = {};
      for (const d of (await group(g).collection('members').get()).docs) {
        members[d.id] = decodeFromStore(d.data());
      }
      if (Object.keys(members).length > 0) put('config/members.json', members);

      for (const d of (await group(g).collection('decks').get()).docs) {
        put(`decks/${d.id}.json`, withoutId(decodeFromStore(d.data())));
        for (const v of (await d.ref.collection('versions').get()).docs) {
          put(`decks/${d.id}/${v.id}.json`, decodeFromStore(v.data()));
        }
      }
      for (const name of ['games', 'votes', 'requests']) {
        for (const d of (await group(g).collection(name).get()).docs) {
          const data = decodeFromStore(d.data());
          const path = filePath([name, d.id], data);
          if (path) put(path, name === 'votes' ? data : withoutId(data));
        }
      }
      return files;
    },

    async writeDerived(g, derived) {
      const wanted = new Map();
      for (const [path, json] of Object.entries(derived)) {
        const segments = docSegments(path);
        if (segments) wanted.set(segments[1], Array.isArray(json) ? { items: json } : json);
      }
      const collection = group(g).collection('derived');
      const existing = await collection.get();
      for (const d of existing.docs) {
        if (!wanted.has(d.id) && !KEEP_DERIVED.test(d.id)) await d.ref.delete();
      }
      const entries = [...wanted.entries()];
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const [id, data] of entries.slice(i, i + BATCH_SIZE)) {
          batch.set(collection.doc(id), encodeForStore(data));
        }
        await batch.commit();
      }
    },

    async readGovernance(g) {
      const groupData = (await group(g).get()).data() ?? {};
      const members = {};
      for (const d of (await group(g).collection('members').get()).docs) members[d.id] = d.data();
      const votes = {};
      for (const d of (await group(g).collection('adminVotes').get()).docs) votes[d.id] = d.data();
      return {
        adminId: groupData.adminId,
        members,
        proposal: await read(group(g).collection('adminProposals').doc('current')),
        votes,
      };
    },

    async changeAdmin(g, { adminId, roles }) {
      const batch = db.batch();
      batch.update(group(g), { adminId });
      for (const [id, role] of Object.entries(roles)) {
        batch.update(group(g).collection('members').doc(id), { role });
      }
      batch.update(group(g).collection('adminProposals').doc('current'), { status: 'approved' });
      for (const d of (await group(g).collection('adminVotes').get()).docs) batch.delete(d.ref);
      await batch.commit();
    },

    async closeProposal(g, status) {
      const batch = db.batch();
      batch.update(group(g).collection('adminProposals').doc('current'), { status });
      for (const d of (await group(g).collection('adminVotes').get()).docs) batch.delete(d.ref);
      await batch.commit();
    },
  };
}

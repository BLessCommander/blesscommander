// Solo per lo sviluppo con l'emulatore: stesso ricalcolo che farà la Cloud Function (E-02b).
import { runRecalc } from '../../../data-actions/src/recalc.js';
import { readGroupFiles, writeDerivedFiles } from './firestore-files.js';

export async function recalcGroup(db, groupId) {
  const files = await readGroupFiles(db, groupId);
  const { derived } = runRecalc({ files, unknownAuthor: 'allow' });
  await writeDerivedFiles(db, groupId, derived);
}

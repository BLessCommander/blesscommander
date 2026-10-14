// Logica del backend dello stadio 3 (SPEC §6.10, E-02b): ricalcolo di un gruppo e governance dell'admin.
// Non conosce Firebase: parla con un "store" (in produzione `functions/src/admin-store.js`).
import { runRecalc } from './recalc.js';
import { applyAdminChange, resolveAdminProposal } from './governance.js';

/**
 * @typedef {object} BackendStore
 * @property {(groupId: string) => Promise<Record<string, string>>} readFiles file di input del gruppo (come l'Action)
 * @property {(groupId: string, derived: Record<string, unknown>) => Promise<void>} writeDerived
 * @property {(groupId: string) => Promise<{ adminId: string, members: Record<string, any>, proposal: any | null, votes: Record<string, any> }>} readGovernance
 * @property {(groupId: string, change: { adminId: string, roles: Record<string, string> }) => Promise<void>} changeAdmin
 *   cambia admin, ruoli e chiude la proposta come `approved`, cancellando i voti, in un'unica scrittura
 * @property {(groupId: string, status: 'rejected' | 'invalid') => Promise<void>} closeProposal
 */

/**
 * Ricalcola da zero le fasce del gruppo e riscrive `derived/`. Le autorizzazioni sulle scritture
 * le fanno le regole di Firestore, per questo l'autore non serve (`unknownAuthor: 'allow'`).
 * @param {BackendStore} store
 * @param {string} groupId
 */
export async function recalcGroup(store, groupId) {
  const files = await store.readFiles(groupId);
  const { derived } = runRecalc({ files, unknownAuthor: 'allow' });
  await store.writeDerived(groupId, derived);
  return derived;
}

/**
 * Controlla la proposta di cambio admin aperta e, se tutti i votanti hanno detto sì, cambia admin.
 * @param {BackendStore} store
 * @param {string} groupId
 * @returns {Promise<'none' | 'pending' | 'approved' | 'rejected' | 'invalid'>}
 */
export async function settleAdminProposal(store, groupId) {
  const { adminId, members, proposal, votes } = await store.readGovernance(groupId);
  if (!proposal || proposal.status !== 'open') return 'none';
  const { outcome } = resolveAdminProposal({ members, adminId, proposal, votes });
  if (outcome === 'approved') {
    await store.changeAdmin(groupId, applyAdminChange(adminId, proposal.candidateId));
  } else if (outcome === 'rejected' || outcome === 'invalid') {
    await store.closeProposal(groupId, outcome);
  }
  return outcome;
}

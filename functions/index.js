// Cloud Functions (E-02b, SPEC §6.10): ricalcolo delle fasce e cambio di admin.
// La logica sta in `data-actions/src/backend.js`, la stessa del motore usato dalle Actions.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { recalcGroup, settleAdminProposal } from '../data-actions/src/backend.js';
import { createAdminStore } from './src/admin-store.js';

initializeApp();
const store = createAdminStore(getFirestore());

// Quando cambia un documento che conta per le fasce si rigioca tutto lo storico del gruppo.
const recalc = (path) =>
  onDocumentWritten(`groups/{groupId}/${path}`, (event) =>
    recalcGroup(store, event.params.groupId),
  );
// A ogni voto o proposta si controlla se il cambio di admin è concluso.
const governance = (path) =>
  onDocumentWritten(`groups/{groupId}/${path}`, (event) =>
    settleAdminProposal(store, event.params.groupId),
  );

export const recalcOnDeck = recalc('decks/{id}');
export const recalcOnDeckVersion = recalc('decks/{id}/versions/{version}');
export const recalcOnGame = recalc('games/{id}');
export const recalcOnVote = recalc('votes/{id}');
export const recalcOnConfig = recalc('config/{name}');
export const recalcOnMember = recalc('members/{id}');
export const adminOnVote = governance('adminVotes/{id}');
export const adminOnProposal = governance('adminProposals/{id}');

// Governance dell'admin di gruppo (E-06, SPEC §6.10): funzioni pure, usate dalla Cloud Function.
// Un giocatore propone un altro membro come admin. Votano tutti i membri tranne l'admin attuale
// e il candidato. Quando tutti dicono sì il candidato diventa admin; un solo no chiude la proposta.

/**
 * @typedef {{ role?: string }} Member
 * @typedef {{ proposalId: string, candidateId: string, proposedBy: string, status: string }} AdminProposal
 * @typedef {{ proposalId: string, value: boolean }} AdminVote
 * @typedef {{ outcome: 'pending' | 'approved' | 'rejected' | 'invalid', reason?: string, voters: string[] }} Resolution
 */

/** Chi può votare la proposta: tutti i membri, tranne l'admin attuale e il candidato. */
export function adminProposalVoters(members, adminId, candidateId) {
  return Object.keys(members)
    .filter((id) => id !== adminId && id !== candidateId)
    .sort();
}

/**
 * Esito di una proposta in base ai voti presenti. I voti di altre proposte o di chi non può votare si ignorano.
 * @param {{ members: Record<string, Member>, adminId: string, proposal: AdminProposal, votes: Record<string, AdminVote> }} input
 * @returns {Resolution}
 */
export function resolveAdminProposal({ members, adminId, proposal, votes }) {
  const { candidateId, proposedBy } = proposal;
  if (!members[candidateId] || candidateId === adminId) {
    return { outcome: 'invalid', reason: 'candidate', voters: [] };
  }
  if (!members[proposedBy] || proposedBy === adminId || proposedBy === candidateId) {
    return { outcome: 'invalid', reason: 'proposer', voters: [] };
  }
  const voters = adminProposalVoters(members, adminId, candidateId);
  // Con solo admin e candidato nessuno può votare; con un proponente valido succede solo se ha lasciato il gruppo.
  if (voters.length === 0) return { outcome: 'invalid', reason: 'no-voters', voters };
  // La proposta vale come «sì» di chi la fa.
  const answer = (id) => {
    if (id === proposedBy) return true;
    const vote = votes[id];
    return vote && vote.proposalId === proposal.proposalId ? vote.value : undefined;
  };
  if (voters.some((id) => answer(id) === false)) return { outcome: 'rejected', voters };
  if (voters.every((id) => answer(id) === true)) {
    return { outcome: 'approved', voters };
  }
  return { outcome: 'pending', voters };
}

/**
 * Applica il cambio: il candidato diventa admin, il vecchio admin torna giocatore.
 * @param {string} adminId
 * @param {string} candidateId
 * @returns {{ adminId: string, roles: Record<string, string> }} nuovo admin e ruoli da scrivere
 */
export function applyAdminChange(adminId, candidateId) {
  return {
    adminId: candidateId,
    roles: { [adminId]: 'giocatore', [candidateId]: 'admin' },
  };
}

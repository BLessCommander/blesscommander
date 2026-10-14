import { describe, expect, it } from 'vitest';
import { adminProposalVoters, applyAdminChange, resolveAdminProposal } from './governance.js';

const members = {
  anna: { role: 'admin' },
  bruno: { role: 'giocatore' },
  carla: { role: 'giocatore' },
  dario: { role: 'giocatore' },
};
const proposal = { proposalId: 'P1', candidateId: 'bruno', proposedBy: 'carla', status: 'open' };
const yes = { proposalId: 'P1', value: true };
const no = { proposalId: 'P1', value: false };
const resolve = (votes, over = {}) =>
  resolveAdminProposal({
    members,
    adminId: 'anna',
    proposal: { ...proposal, ...over },
    votes,
  });

describe('UT-GOV governance dell’admin (UC-64)', () => {
  it('votano tutti tranne l’admin e il candidato', () => {
    expect(adminProposalVoters(members, 'anna', 'bruno')).toEqual(['carla', 'dario']);
  });

  it('la proposta vale come sì di chi la fa, gli altri devono ancora votare', () => {
    expect(resolve({}).outcome).toBe('pending');
  });

  it('quando tutti gli altri votanti dicono sì il candidato diventa admin', () => {
    expect(resolve({ dario: yes }).outcome).toBe('approved');
    expect(applyAdminChange('anna', 'bruno')).toEqual({
      adminId: 'bruno',
      roles: { anna: 'giocatore', bruno: 'admin' },
    });
  });

  it('un solo no chiude la proposta', () => {
    expect(resolve({ dario: no }).outcome).toBe('rejected');
  });

  it('i voti dell’admin e del candidato non contano', () => {
    expect(resolve({ anna: no, bruno: no }).outcome).toBe('pending');
    expect(resolve({ anna: no, bruno: no, dario: yes }).outcome).toBe('approved');
  });

  it('i voti di un’altra proposta si ignorano', () => {
    expect(resolve({ dario: { proposalId: 'OLD', value: true } }).outcome).toBe('pending');
    expect(resolve({ dario: { proposalId: 'OLD', value: false } }).outcome).toBe('pending');
  });

  it('con due soli membri nessuno può votare: proposta non valida', () => {
    const two = { anna: { role: 'admin' }, bruno: { role: 'giocatore' } };
    const result = resolveAdminProposal({
      members: two,
      adminId: 'anna',
      proposal: { ...proposal, proposedBy: 'bruno' },
      votes: {},
    });
    expect(result.outcome).toBe('invalid');
  });

  it('candidato o proponente non validi', () => {
    expect(resolve({}, { candidateId: 'anna' }).reason).toBe('candidate');
    expect(resolve({}, { candidateId: 'zeno' }).reason).toBe('candidate');
    expect(resolve({}, { proposedBy: 'anna' }).reason).toBe('proposer');
    expect(resolve({}, { proposedBy: 'bruno' }).reason).toBe('proposer');
  });

  it('con tre membri il proponente è l’unico votante: approvata subito', () => {
    const three = { anna: { role: 'admin' }, bruno: {}, carla: {} };
    const result = resolveAdminProposal({
      members: three,
      adminId: 'anna',
      proposal,
      votes: {},
    });
    expect(result.outcome).toBe('approved');
  });
});

import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../tests/seed/seed.js';
import { recalcGroup, settleAdminProposal } from './backend.js';
import { runRecalc } from './recalc.js';

function memoryStore({ governance, files = {} }) {
  const calls = { derived: null, change: null, closed: null };
  return {
    calls,
    readFiles: async () => files,
    writeDerived: async (_g, derived) => {
      calls.derived = derived;
    },
    readGovernance: async () => governance,
    changeAdmin: async (_g, change) => {
      calls.change = change;
    },
    closeProposal: async (_g, status) => {
      calls.closed = status;
    },
  };
}

const members = { anna: {}, bruno: {}, carla: {}, dario: {} };
const open = { proposalId: 'P1', candidateId: 'bruno', proposedBy: 'carla', status: 'open' };

describe('UT-BACKEND logica della Cloud Function', () => {
  it('ricalcola gli stessi risultati dell’Action sullo stesso storico (UC-62)', async () => {
    const seed = buildSeed();
    const files = Object.fromEntries(Object.entries(seed).map(([p, j]) => [p, JSON.stringify(j)]));
    const store = memoryStore({ files });
    const derived = await recalcGroup(store, 'g');
    const expected = runRecalc({ files, unknownAuthor: 'allow' }).derived;
    expect(derived).toEqual(expected);
    expect(store.calls.derived).toEqual(expected);
    expect(Object.keys(derived)).toContain('derived/snapshot.json');
  });

  it('senza proposta aperta non fa nulla', async () => {
    const store = memoryStore({
      governance: { adminId: 'anna', members, proposal: null, votes: {} },
    });
    expect(await settleAdminProposal(store, 'g')).toBe('none');
    const closed = { ...open, status: 'approved' };
    store.readGovernance = async () => ({ adminId: 'anna', members, proposal: closed, votes: {} });
    expect(await settleAdminProposal(store, 'g')).toBe('none');
  });

  it('con tutti i sì cambia l’admin (UC-64)', async () => {
    const votes = { dario: { proposalId: 'P1', value: true } };
    const store = memoryStore({ governance: { adminId: 'anna', members, proposal: open, votes } });
    expect(await settleAdminProposal(store, 'g')).toBe('approved');
    expect(store.calls.change).toEqual({
      adminId: 'bruno',
      roles: { anna: 'giocatore', bruno: 'admin' },
    });
  });

  it('manca un voto: resta in attesa', async () => {
    const store = memoryStore({
      governance: { adminId: 'anna', members, proposal: open, votes: {} },
    });
    expect(await settleAdminProposal(store, 'g')).toBe('pending');
    expect(store.calls.change).toBeNull();
    expect(store.calls.closed).toBeNull();
  });

  it('un no chiude la proposta e l’admin resta', async () => {
    const votes = { dario: { proposalId: 'P1', value: false } };
    const store = memoryStore({ governance: { adminId: 'anna', members, proposal: open, votes } });
    expect(await settleAdminProposal(store, 'g')).toBe('rejected');
    expect(store.calls.closed).toBe('rejected');
    expect(store.calls.change).toBeNull();
  });
});

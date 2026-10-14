import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { DataError, DATA_ERROR } from '../data/errors.js';
import { useAccountStore } from './account.js';

const ANNA = { uid: 'u1', displayName: 'Anna' };

function setup({ account = ANNA, groups = [] } = {}) {
  const services = {
    auth: {
      current: vi.fn(async () => account),
      signInWithGoogle: vi.fn(async () => ANNA),
      signOut: vi.fn(async () => {}),
    },
    groups: {
      listMyGroups: vi.fn(async () => groups),
      createGroup: vi.fn(async (uid, input) => ({
        id: 'g9',
        name: input.groupName,
        role: 'admin',
        inviteCode: 'ABCD2345',
      })),
      joinGroup: vi.fn(async () => ({ id: 'g3', name: 'Altro', role: 'giocatore' })),
    },
  };
  const reload = vi.fn();
  const store = useAccountStore();
  store.options = { services, reload };
  return { store, services, reload };
}

describe('UT-ACCOUNT store degli account (E-04a)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.localStorage?.clear();
  });

  it('senza account si chiede di accedere', async () => {
    const { store } = setup({ account: null });
    await store.init();
    expect(store.status).toBe('signed-out');
  });

  it('con un account ma senza gruppo scelto si passa alla scelta', async () => {
    const { store } = setup({ groups: [{ id: 'g1', name: 'Venerdì', role: 'admin' }] });
    await store.init();
    expect(store.status).toBe('choose');
    expect(store.groups).toHaveLength(1);
  });

  it('il gruppo scelto in precedenza si riapre da solo', async () => {
    const { store } = setup({ groups: [{ id: 'g1', name: 'Venerdì', role: 'admin' }] });
    store.chooseGroup('g1');
    await store.init();
    expect(store.status).toBe('ready');
    expect(store.activeGroup.name).toBe('Venerdì');
  });

  it('se il gruppo salvato non c’è più si torna alla scelta', async () => {
    const { store } = setup({ groups: [{ id: 'g1', name: 'Venerdì', role: 'admin' }] });
    store.chooseGroup('sparito');
    await store.init();
    expect(store.status).toBe('choose');
    expect(store.activeGroupId).toBeNull();
  });

  it('crea un gruppo e mostra il codice, senza ancora riavviare', async () => {
    const { store, reload } = setup();
    await store.init();
    await store.createGroup({ groupName: 'Nuovo', displayName: 'Anna' });
    expect(store.created).toEqual({ name: 'Nuovo', inviteCode: 'ABCD2345' });
    expect(reload).not.toHaveBeenCalled();
    store.chooseGroup('g9');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('entrando con un codice sceglie quel gruppo', async () => {
    const { store, reload } = setup();
    await store.init();
    await store.joinGroup({ code: 'x', displayName: 'Anna' });
    expect(reload).toHaveBeenCalledOnce();
  });

  it('un errore del servizio diventa un motivo leggibile e non riavvia', async () => {
    const { store, services, reload } = setup();
    services.groups.joinGroup.mockRejectedValue(new DataError(DATA_ERROR.notFound, 'no'));
    await store.init();
    await store.joinGroup({ code: 'x', displayName: 'Anna' });
    expect(store.error.reason).toBe('not-found');
    expect(reload).not.toHaveBeenCalled();
    expect(store.busy).toBe(false);
  });

  it('uscire cancella il gruppo scelto e riavvia', async () => {
    const { store, services, reload } = setup();
    store.chooseGroup('g1');
    reload.mockClear();
    await store.signOut();
    expect(services.auth.signOut).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
    await store.init();
    expect(store.activeGroupId).toBeNull();
  });
});

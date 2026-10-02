import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDataStore } from './data.js';

describe('useDataStore (modalità demo)', () => {
  beforeEach(() => setActivePinia(createPinia()));

  // Deve restare il primo: il provider è condiviso dal modulo dopo il primo caricamento.
  it('write prima del caricamento dà errore chiaro', async () => {
    await expect(useDataStore().write('saveDeck', {})).rejects.toThrow(/non ancora caricati/);
  });

  it('carica utente e snapshot dal provider', async () => {
    const data = useDataStore();
    await data.load();
    expect(data.error).toBeNull();
    expect(data.user?.login).toMatch(/^demo-/);
    expect(data.snapshot?.decks.length).toBeGreaterThan(0);
    expect(data.loading).toBe(false);
  });

  it('senza coda offline (demo) non ci sono scritture in attesa né "in aggiornamento"', async () => {
    const data = useDataStore();
    await data.load();
    expect(data.pendingWrites).toBe(0);
    expect(data.refreshing).toBe(false);
    await data.flushQueue();
    expect(data.pendingWrites).toBe(0);
  });

  it('"Agisci come" è spento in demo', async () => {
    const data = useDataStore();
    await data.load();
    expect(data.actingAsOptions.enabled).toBe(false);
    await data.setActingAs('demo-qualcuno');
    expect(data.actingAsOptions.enabled).toBe(false);
  });

  it('"in aggiornamento" segue snapshot.pending', async () => {
    const data = useDataStore();
    await data.load();
    data.snapshot = { ...data.snapshot, pending: true };
    expect(data.refreshing).toBe(true);
    data.snapshot = { ...data.snapshot, pending: false };
    expect(data.refreshing).toBe(false);
  });

  it('notifiche: contatore dei non letti e pausa durante una partita (regola 1)', async () => {
    const data = useDataStore();
    await data.load();
    const login = data.user.login;
    expect(data.unreadCount).toBe(data.notifications.length);
    expect(data.unreadCount).toBeGreaterThan(0);

    await data.markNotificationsRead([data.notifications[0].id]);
    expect(data.unreadCount).toBe(data.notifications.length - 1);

    const game = { status: 'in_corso', recorderLogin: 'altro', players: [{ login }] };
    data.snapshot = { ...data.snapshot, games: [...data.snapshot.games, game] };
    expect(data.notificationsPaused).toBe(true);
    expect(data.unreadCount).toBe(0);

    data.snapshot = { ...data.snapshot, games: [{ ...game, status: 'ufficiale' }] };
    expect(data.notificationsPaused).toBe(false);
    expect(data.unreadCount).toBeGreaterThan(0);
  });

  it("dismissDropped svuota l'avviso", () => {
    const data = useDataStore();
    data.dropped = [{ method: 'saveDeck', message: 'no' }];
    data.dismissDropped();
    expect(data.dropped).toEqual([]);
  });
});

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

  describe('mazzi provvisori (C-06e)', () => {
    const fresh = {
      id: 'nuovo',
      name: 'Nuovo',
      declaredTier: 'F3',
      ownerLogin: 'x',
      commanders: [],
    };

    it('un mazzo salvato e non ancora nello snapshot compare subito, marcato', async () => {
      const data = useDataStore();
      await data.load();
      data.snapshot = { ...data.snapshot, pending: true };
      data.rememberDeck(fresh);
      const shown = data.snapshotWithPending.decks;
      expect(shown).toHaveLength(data.snapshot.decks.length + 1);
      expect(shown.find((d) => d.id === 'nuovo')?.optimistic).toBe(true);
      expect(data.snapshot.decks.some((d) => d.id === 'nuovo')).toBe(false);
    });

    it('un secondo salvataggio dello stesso mazzo lo sostituisce senza duplicarlo', async () => {
      const data = useDataStore();
      await data.load();
      data.rememberDeck(fresh);
      data.rememberDeck({ ...fresh, name: 'Rinominato' });
      const mine = data.snapshotWithPending.decks.filter((d) => d.id === 'nuovo');
      expect(mine.map((d) => d.name)).toEqual(['Rinominato']);
    });

    it('si toglie quando lo snapshot contiene il mazzo o il ricalcolo è finito', async () => {
      const data = useDataStore();
      await data.load();
      data.snapshot = { ...data.snapshot, pending: true };
      data.rememberDeck(fresh);
      data.pruneOptimisticDecks();
      expect(data.optimisticDecks).toHaveLength(1); // ancora in attesa

      data.snapshot = { ...data.snapshot, decks: [...data.snapshot.decks, fresh] };
      data.pruneOptimisticDecks();
      expect(data.optimisticDecks).toHaveLength(0);

      data.rememberDeck({ ...fresh, id: 'altro' });
      data.snapshot = { ...data.snapshot, pending: false };
      data.pruneOptimisticDecks();
      expect(data.optimisticDecks).toHaveLength(0);
    });

    it('la versione salvata aggiorna currentVersion del mazzo provvisorio', async () => {
      const data = useDataStore();
      await data.load();
      data.rememberDeck({ ...fresh, currentVersion: 0 });
      data.rememberDeckVersion('nuovo', { version: 1 });
      expect(data.optimisticDecks[0].currentVersion).toBe(1);
    });

    it('write("saveDeck") ricorda il mazzo restituito dal provider', async () => {
      const data = useDataStore();
      await data.load();
      data.snapshot = { ...data.snapshot, pending: true };
      const saved = await data.write('saveDeck', {
        name: 'Da write',
        ownerLogin: data.user.login,
        declaredTier: 'F2',
        commanders: ['X'],
        colorIdentity: [],
      });
      expect(data.optimisticDecks.some((d) => d.id === saved.id)).toBe(true);
    });
  });

  describe('partite provvisorie (C-10)', () => {
    const base = {
      id: 'g1',
      formatId: 'ffa4',
      recorderLogin: 'x',
      players: [{ login: 'x', deckId: 'd' }],
    };

    it('una partita chiusa compare subito come ufficiale, marcata, anche se lo snapshot è vecchio', async () => {
      const data = useDataStore();
      await data.load();
      data.snapshot = {
        ...data.snapshot,
        pending: true,
        games: [...data.snapshot.games, { ...base, status: 'in_corso' }],
      };
      data.rememberGame({ ...base, status: 'ufficiale', winTurn: 7 });
      const shown = data.snapshotWithPending.games.find((g) => g.id === 'g1');
      expect(shown).toMatchObject({ status: 'ufficiale', winTurn: 7, optimistic: true });
      expect(data.snapshot.games.find((g) => g.id === 'g1').status).toBe('in_corso');
    });

    it('una partita appena creata e non ancora nello snapshot si vede, senza doppioni', async () => {
      const data = useDataStore();
      await data.load();
      data.snapshot = { ...data.snapshot, pending: true };
      data.rememberGame({ ...base, status: 'in_corso' });
      data.rememberGame({ ...base, status: 'in_corso', startedAt: 'ora' });
      const mine = data.snapshotWithPending.games.filter((g) => g.id === 'g1');
      expect(mine).toHaveLength(1);
      expect(mine[0].optimistic).toBe(true);
    });

    it('si toglie quando lo snapshot ha lo stesso stato o il ricalcolo è finito', async () => {
      const data = useDataStore();
      await data.load();
      data.snapshot = { ...data.snapshot, pending: true };
      data.rememberGame({ ...base, status: 'ufficiale' });
      data.pruneOptimisticGames();
      expect(data.optimisticGames).toHaveLength(1); // ancora in attesa

      data.snapshot = {
        ...data.snapshot,
        games: [...data.snapshot.games, { ...base, status: 'ufficiale' }],
      };
      data.pruneOptimisticGames();
      expect(data.optimisticGames).toHaveLength(0);

      data.rememberGame({ ...base, id: 'g2', status: 'in_corso' });
      data.snapshot = { ...data.snapshot, pending: false };
      data.pruneOptimisticGames();
      expect(data.optimisticGames).toHaveLength(0);
    });

    it('senza partite provvisorie lo snapshot resta lo stesso oggetto', async () => {
      const data = useDataStore();
      await data.load();
      expect(data.snapshotWithPending).toBe(data.snapshot);
    });

    it('le partite non ricalcolate sopravvivono a un ricarico (memoria del dispositivo)', async () => {
      const data = useDataStore();
      await data.load();
      data.snapshot = { ...data.snapshot, pending: true };
      data.rememberGame({ ...base, id: 'resta', status: 'in_corso' });

      // «Ricarico»: store nuovo, snapshot ancora senza la partita.
      setActivePinia(createPinia());
      const reloaded = useDataStore();
      reloaded.snapshot = { ...data.snapshot, games: [] };
      reloaded.restoreOptimisticGames();
      expect(reloaded.optimisticGames.map((g) => g.id)).toEqual(['resta']);
      expect(reloaded.snapshotWithPending.games.map((g) => g.id)).toEqual(['resta']);

      // Quando il ricalcolo l'ha letta (stesso stato) si toglie, anche dalla memoria.
      reloaded.snapshot = {
        ...reloaded.snapshot,
        games: [{ ...base, id: 'resta', status: 'in_corso' }],
      };
      reloaded.pruneOptimisticGames();
      setActivePinia(createPinia());
      const again = useDataStore();
      again.snapshot = { ...reloaded.snapshot, games: [] };
      again.restoreOptimisticGames();
      expect(again.optimisticGames).toEqual([]);
    });

    it('openGames: partite aperte dell’utente, comprese quelle provvisorie', async () => {
      const data = useDataStore();
      await data.load();
      const me = data.user.login;
      data.snapshot = { ...data.snapshot, pending: true };
      expect(data.openGames).toEqual([]);
      data.rememberGame({
        ...base,
        id: 'mia',
        status: 'in_corso',
        recorderLogin: me,
        players: [{ login: me, deckId: 'd', seat: 1 }],
      });
      data.rememberGame({
        ...base,
        id: 'altrui',
        status: 'in_corso',
        recorderLogin: 'x',
        players: [{ login: 'x', deckId: 'd', seat: 1 }],
      });
      expect(data.openGames.map((g) => g.id)).toEqual(['mia']);
      data.rememberGame({
        ...base,
        id: 'mia',
        status: 'ufficiale',
        recorderLogin: me,
        players: [{ login: me, deckId: 'd', seat: 1 }],
      });
      expect(data.openGames).toEqual([]);
    });

    it('write("updateGame") ricorda la partita restituita dal provider', async () => {
      const data = useDataStore();
      await data.load();
      const game = data.snapshot.games.find((g) => g.status === 'ufficiale');
      const saved = await data.write('updateGame', game.id, { notes: 'x' });
      expect(data.optimisticGames.some((g) => g.id === saved.id)).toBe(true);
    });
  });

  it("dismissDropped svuota l'avviso", () => {
    const data = useDataStore();
    data.dropped = [{ method: 'saveDeck', message: 'no' }];
    data.dismissDropped();
    expect(data.dropped).toEqual([]);
  });
});

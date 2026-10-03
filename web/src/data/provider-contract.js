import { describe, expect, it } from 'vitest';
import { DataProvider, PROVIDER_METHODS } from './data-provider.js';
import { DataError } from './errors.js';

/**
 * Utenti che il contratto usa: un admin e tre giocatori, già presenti nei dati dell'implementazione.
 * @typedef {{ admin: string, player1: string, player2: string, player3: string }} ContractLogins
 */

const newDeck = { name: 'Nuovo', commanders: ['X'], colorIdentity: ['R'], declaredTier: 'F2' };

/**
 * Prove che ogni implementazione di `DataProvider` deve superare (UT-DATA).
 * @param {string} name nome dell'implementazione
 * @param {(login: string) => DataProvider} make crea un provider per quell'utente
 * @param {ContractLogins} logins
 */
export function runProviderContract(name, make, logins) {
  describe(`UT-DATA contratto DataProvider: ${name}`, () => {
    it('estende DataProvider e ha tutte le operazioni', () => {
      const provider = make(logins.admin);
      expect(provider).toBeInstanceOf(DataProvider);
      for (const method of PROVIDER_METHODS) expect(typeof provider[method]).toBe('function');
    });

    it('restituisce utente e snapshot validi', async () => {
      const provider = make(logins.player1);
      expect(await provider.getCurrentUser()).toMatchObject({
        login: logins.player1,
        role: 'giocatore',
      });
      const snapshot = await provider.getSnapshot();
      expect(snapshot.decks.length).toBeGreaterThan(0);
      expect(snapshot.decks[0].tier.current).toMatch(/^F[1-5]$/);
    });

    it('crea mazzo e versione, e li rilegge', async () => {
      const provider = make(logins.player1);
      const deck = await provider.saveDeck(newDeck);
      expect(deck.ownerLogin).toBe(logins.player1);
      const version = await provider.saveDeckVersion(deck.id, {
        cards: [{ name: 'Sol Ring', qty: 1 }],
      });
      expect(version.version).toBe(1);
      const read = await provider.getDeck(deck.id);
      expect(read.deck.currentVersion).toBe(1);
      expect(read.versions).toHaveLength(1);
    });

    it('salva e rilegge il salt delle carte (e rifiuta un salt non numerico)', async () => {
      const provider = make(logins.player1);
      const salt = { 'Sol Ring': 0.2, Island: 0 };
      const deck = await provider.saveDeck({ ...newDeck, salt });
      expect((await provider.getDeck(deck.id)).deck.salt).toEqual(salt);
      const updated = await provider.saveDeck({ ...deck, salt: { 'Sol Ring': 0.25 } });
      expect((await provider.getDeck(updated.id)).deck.salt).toEqual({ 'Sol Ring': 0.25 });
      await expect(
        provider.saveDeck({ ...newDeck, salt: { 'Sol Ring': 'alto' } }),
      ).rejects.toMatchObject({ code: 'invalid' });
    });

    it('rifiuta dati non validi con DataError "invalid"', async () => {
      const provider = make(logins.player1);
      await expect(provider.saveDeck({ name: 'X', declaredTier: 'F9' })).rejects.toMatchObject({
        code: 'invalid',
      });
    });

    it('un giocatore non modifica la configurazione né i mazzi altrui', async () => {
      const provider = make(logins.player1);
      const config = await provider.getConfig();
      await expect(provider.saveConfig(config)).rejects.toBeInstanceOf(DataError);
      const foreign = (await provider.getSnapshot()).decks.find(
        (d) => d.ownerLogin !== logins.player1,
      );
      const { deck } = await provider.getDeck(foreign.id);
      await expect(provider.saveDeck({ ...deck, name: 'Rubato' })).rejects.toMatchObject({
        code: 'forbidden',
      });
    });

    it("l'admin salva la configurazione", async () => {
      const provider = make(logins.admin);
      const config = await provider.getConfig();
      await provider.saveConfig({ ...config, name: 'Nuovo nome' });
      expect((await provider.getConfig()).name).toBe('Nuovo nome');
    });

    it("l'admin aggiunge, cambia e rimuove un membro; il giocatore no (UC-03)", async () => {
      const admin = make(logins.admin);
      await admin.saveMember('nuovo-amico', { displayName: 'Nuovo', role: 'giocatore' });
      expect((await admin.getMembers())['nuovo-amico']).toMatchObject({ role: 'giocatore' });
      await admin.saveMember('nuovo-amico', { displayName: 'Nuovo', role: 'admin' });
      expect((await admin.getMembers())['nuovo-amico'].role).toBe('admin');
      await admin.removeMember('nuovo-amico');
      expect((await admin.getMembers())['nuovo-amico']).toBeUndefined();

      const player = make(logins.player1);
      const member = { displayName: 'X', role: 'admin' };
      await expect(player.saveMember('altro', member)).rejects.toMatchObject({ code: 'forbidden' });
      await expect(player.removeMember(logins.player2)).rejects.toMatchObject({
        code: 'forbidden',
      });
    });

    it("non si toglie né si retrocede l'ultimo admin; il login deve essere valido", async () => {
      const admin = make(logins.admin);
      const members = await admin.getMembers();
      const others = Object.entries(members).filter(
        ([login, member]) => member.role === 'admin' && login !== logins.admin,
      );
      for (const [login] of others) await admin.removeMember(login);
      try {
        await expect(admin.removeMember(logins.admin)).rejects.toMatchObject({ code: 'invalid' });
        await expect(
          admin.saveMember(logins.admin, { displayName: 'A', role: 'giocatore' }),
        ).rejects.toMatchObject({ code: 'invalid' });
        await expect(
          admin.saveMember('login non valido!', { displayName: 'A', role: 'giocatore' }),
        ).rejects.toMatchObject({ code: 'invalid' });
        await expect(admin.removeMember('non-esiste')).rejects.toMatchObject({
          code: 'not-found',
        });
      } finally {
        // La finta API è condivisa tra le prove: si rimettono gli admin tolti.
        for (const [login, member] of others) await admin.saveMember(login, member);
      }
    });

    it('solo il registratore chiude la partita', async () => {
      const admin = make(logins.admin);
      const players = (await admin.getSnapshot()).games[0].players;
      const game = await admin.createGame({ formatId: 'ffa4', players });
      expect(game.status).toBe('lobby');
      expect(game.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      const closed = await admin.updateGame(game.id, { status: 'ufficiale' });
      expect(closed.revision).toBe(1);

      const other = make(logins.player1);
      const otherGame = (await other.getSnapshot()).games.find(
        (g) => g.recorderLogin !== logins.player1,
      );
      await expect(other.updateGame(otherGame.id, { status: 'ufficiale' })).rejects.toMatchObject({
        code: 'forbidden',
      });
    });

    it('registra un voto; su una partita inesistente fallisce', async () => {
      const provider = make(logins.player2);
      const { games } = await provider.getSnapshot();
      expect(await provider.vote('riapertura', games[0].id, true)).toMatchObject({ value: true });
      await expect(provider.vote('riapertura', 'non-esiste', true)).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    it('crea una richiesta di import in attesa', async () => {
      const provider = make(logins.player1);
      const request = await provider.requestImport('archidekt', 'https://archidekt.com/decks/1');
      expect(request.status).toBe('pending');
    });

    it('legge lo stato di una richiesta di import e rifiuta una richiesta che non esiste', async () => {
      const provider = make(logins.player1);
      const request = await provider.requestImport('archidekt', 'https://archidekt.com/decks/1');
      const state = await provider.getImportRequest(request.id);
      expect(state).toMatchObject({ id: request.id, source: 'archidekt' });
      expect(['pending', 'done']).toContain(state.status);
      await expect(provider.getImportRequest('non-esiste')).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    it('notifiche: elenco, lette e risposta restano salvate per utente', async () => {
      const provider = make(logins.player1);
      const list = await provider.getNotifications();
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.every((n) => n.read === false)).toBe(true);
      // la più recente per prima
      expect(list[0].createdAt >= list[1].createdAt).toBe(true);

      const plain = list.find((n) => !n.actions);
      const afterRead = await provider.markNotificationsRead([plain.id]);
      expect(afterRead.find((n) => n.id === plain.id).read).toBe(true);

      const question = list.find((n) => n.actions);
      await expect(provider.answerNotification(plain.id, 'yes')).rejects.toMatchObject({
        code: 'invalid',
      });
      const afterAnswer = await provider.answerNotification(question.id, 'yes');
      expect(afterAnswer.find((n) => n.id === question.id)).toMatchObject({
        read: true,
        answer: 'yes',
      });

      // lo stato è personale: un altro utente non ha nulla di letto
      const other = await make(logins.player2).getNotifications();
      expect(other.every((n) => n.read === false)).toBe(true);
    });

    it('avvisa chi ascolta quando i dati cambiano, e smette dopo la disiscrizione', async () => {
      const provider = make(logins.player1);
      const seen = [];
      const stop = provider.onSnapshotChange((snapshot) => seen.push(snapshot));
      await provider.saveDeck(newDeck);
      // Alcune implementazioni avvisano un attimo dopo la scrittura (rilettura dello snapshot).
      await expect.poll(() => seen.length).toBe(1);
      stop();
      await provider.saveDeck({ ...newDeck, name: 'B' });
      expect(seen).toHaveLength(1);
    });
  });
}

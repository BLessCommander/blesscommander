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

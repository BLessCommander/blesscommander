import { describe, expect, it } from 'vitest';
import { DataProvider, PROVIDER_METHODS } from './data-provider.js';
import { MockProvider } from './mock-provider.js';
import { DEMO_LOGINS } from './seed-demo.js';
import { DataError } from './errors.js';

/** Implementazioni che devono rispettare l'interfaccia (aggiungere GitHubProvider quando esiste). */
const IMPLEMENTATIONS = [
  ['MockProvider', (login) => new MockProvider({ login, now: () => '2026-03-01T10:00:00Z' })],
];

const newDeck = { name: 'Nuovo', commanders: ['X'], colorIdentity: ['R'], declaredTier: 'F2' };

describe.each(IMPLEMENTATIONS)('UT-DATA contratto DataProvider: %s', (_name, make) => {
  it('estende DataProvider e ha tutte le operazioni', () => {
    const provider = make(DEMO_LOGINS.admin);
    expect(provider).toBeInstanceOf(DataProvider);
    for (const method of PROVIDER_METHODS) expect(typeof provider[method]).toBe('function');
  });

  it('restituisce utente e snapshot validi', async () => {
    const provider = make(DEMO_LOGINS.player1);
    expect(await provider.getCurrentUser()).toMatchObject({
      login: DEMO_LOGINS.player1,
      role: 'giocatore',
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.decks.length).toBeGreaterThan(0);
    expect(snapshot.decks[0].tier.current).toMatch(/^F[1-5]$/);
  });

  it('crea mazzo e versione, e li rilegge', async () => {
    const provider = make(DEMO_LOGINS.player1);
    const deck = await provider.saveDeck(newDeck);
    expect(deck.ownerLogin).toBe(DEMO_LOGINS.player1);
    const version = await provider.saveDeckVersion(deck.id, {
      cards: [{ name: 'Sol Ring', qty: 1 }],
    });
    expect(version.version).toBe(1);
    const read = await provider.getDeck(deck.id);
    expect(read.deck.currentVersion).toBe(1);
    expect(read.versions).toHaveLength(1);
  });

  it('rifiuta dati non validi con DataError "invalid"', async () => {
    const provider = make(DEMO_LOGINS.player1);
    await expect(provider.saveDeck({ name: 'X', declaredTier: 'F9' })).rejects.toMatchObject({
      code: 'invalid',
    });
  });

  it('un giocatore non modifica la configurazione né i mazzi altrui', async () => {
    const provider = make(DEMO_LOGINS.player1);
    const config = await provider.getConfig();
    await expect(provider.saveConfig(config)).rejects.toBeInstanceOf(DataError);
    const { deck } = await provider.getDeck((await provider.getSnapshot()).decks[1].id);
    await expect(provider.saveDeck({ ...deck, name: 'Rubato' })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it("l'admin salva la configurazione", async () => {
    const provider = make(DEMO_LOGINS.admin);
    const config = await provider.getConfig();
    await provider.saveConfig({ ...config, name: 'Nuovo nome' });
    expect((await provider.getConfig()).name).toBe('Nuovo nome');
  });

  it('solo il registratore chiude la partita', async () => {
    const admin = make(DEMO_LOGINS.admin);
    const players = (await admin.getSnapshot()).games[0].players;
    const game = await admin.createGame({ formatId: 'ffa4', players });
    expect(game.status).toBe('lobby');
    expect(game.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    const closed = await admin.updateGame(game.id, { status: 'ufficiale' });
    expect(closed.revision).toBe(1);

    const other = make(DEMO_LOGINS.player1);
    const otherGame = (await other.getSnapshot()).games[0];
    await expect(other.updateGame(otherGame.id, { status: 'ufficiale' })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('registra un voto; su una partita inesistente fallisce', async () => {
    const provider = make(DEMO_LOGINS.player2);
    const { games } = await provider.getSnapshot();
    expect(await provider.vote('riapertura', games[0].id, true)).toMatchObject({ value: true });
    await expect(provider.vote('riapertura', 'non-esiste', true)).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('crea una richiesta di import in attesa', async () => {
    const provider = make(DEMO_LOGINS.player1);
    const request = await provider.requestImport('archidekt', 'https://archidekt.com/decks/1');
    expect(request.status).toBe('pending');
  });

  it('avvisa chi ascolta quando i dati cambiano, e smette dopo la disiscrizione', async () => {
    const provider = make(DEMO_LOGINS.player1);
    const seen = [];
    const stop = provider.onSnapshotChange((snapshot) => seen.push(snapshot));
    await provider.saveDeck(newDeck);
    stop();
    await provider.saveDeck({ ...newDeck, name: 'B' });
    expect(seen).toHaveLength(1);
  });
});

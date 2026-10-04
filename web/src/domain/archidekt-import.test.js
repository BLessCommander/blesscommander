import { describe, expect, it, vi } from 'vitest';
import { downloadDeck } from './archidekt-import.js';

const URL = 'https://archidekt.com/decks/27077357/motman_precon';
const deckJson = {
  name: 'Motman precon',
  cards: [
    {
      quantity: 1,
      categories: ['Commander'],
      card: { oracleCard: { name: 'The Wise Mothman', salt: 1 } },
    },
    { quantity: 1, categories: [], card: { oracleCard: { name: 'Sol Ring', salt: 0 } } },
  ],
};
const reply = (status, body = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

describe('downloadDeck: tentativi con Archidekt', () => {
  it('riprova dopo un 404 passeggero e poi scarica il mazzo', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply(404))
      .mockResolvedValueOnce(reply(403))
      .mockResolvedValueOnce(reply(200, deckJson));
    const wait = vi.fn(async () => {});
    const result = await downloadDeck({ url: URL, fetchImpl, wait });
    expect(result).toMatchObject({ deckName: 'Motman precon' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([3000, 6000]);
  });

  it('si arrende dopo 5 tentativi (circa 30 secondi) con un messaggio che non accusa solo il mazzo', async () => {
    const fetchImpl = vi.fn(async () => reply(404));
    const wait = vi.fn(async () => {});
    const result = await downloadDeck({ url: URL, fetchImpl, wait });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([3000, 6000, 9000, 12000]);
    expect(result.error).toContain('riprova tra un minuto');
    expect(result.error).toContain('privato');
  });

  it('non riprova per un errore diverso (es. 400)', async () => {
    const fetchImpl = vi.fn(async () => reply(400));
    const wait = vi.fn(async () => {});
    const result = await downloadDeck({ url: URL, fetchImpl, wait });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.error).toContain('400');
  });

  it('riprova anche se la rete cade e dice di riprovare se non torna', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('rete');
    });
    const wait = vi.fn(async () => {});
    const result = await downloadDeck({ url: URL, fetchImpl, wait });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(result.error).toBe('Archidekt non risponde: riprova tra poco');
  });

  it('rifiuta un link che non è di Archidekt senza chiamare la rete', async () => {
    const fetchImpl = vi.fn();
    const result = await downloadDeck({ url: 'https://example.com/x', fetchImpl });
    expect(result.error).toBe('Il link non è un mazzo di Archidekt');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

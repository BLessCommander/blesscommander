import { describe, expect, it } from 'vitest';
import { archidektDeckId, archidektToText, runImport } from './import.js';

const deck = {
  id: 7,
  name: 'Mazzo di prova',
  categories: [
    { name: 'Commander', includedInDeck: true },
    { name: 'Sideboard', includedInDeck: false },
    { name: 'Maybeboard', includedInDeck: false },
  ],
  cards: [
    { quantity: 1, categories: ['Commander'], card: { oracleCard: { name: 'Tymna the Weaver' } } },
    { quantity: 1, categories: null, card: { oracleCard: { name: 'Sol Ring' } } },
    { quantity: 2, categories: ['Ramp'], card: { oracleCard: { name: 'Island' } } },
    { quantity: 1, categories: ['Sideboard'], card: { oracleCard: { name: 'Mana Crypt' } } },
    { quantity: 1, categories: ['Maybeboard'], card: { oracleCard: { name: 'Rhystic Study' } } },
    {
      quantity: 1,
      categories: null,
      deletedAt: '2024-01-01',
      card: { oracleCard: { name: 'Carta tolta' } },
    },
    {
      quantity: 1,
      categories: null,
      card: { oracleCard: { name: 'Fire // Ice' } },
    },
  ],
};

const pending = (extra = {}) =>
  JSON.stringify({
    source: 'archidekt',
    url: 'https://archidekt.com/decks/7/mazzo-di-prova',
    requestedBy: 'anna',
    status: 'pending',
    createdAt: '2026-10-03T10:00:00Z',
    ...extra,
  });

const members = JSON.stringify({ anna: { displayName: 'Anna', role: 'giocatore' } });
const reply = (status, body) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('archidektDeckId', () => {
  it('legge l’id dai link di Archidekt', () => {
    expect(archidektDeckId('https://archidekt.com/decks/123456/nome-mazzo')).toBe('123456');
    expect(archidektDeckId('https://www.archidekt.com/decks/9')).toBe('9');
    expect(archidektDeckId('http://archidekt.com/decks/9?x=1')).toBe('9');
  });
  it('rifiuta quello che non è un mazzo di Archidekt', () => {
    expect(archidektDeckId('https://moxfield.com/decks/abc')).toBeNull();
    expect(archidektDeckId('https://archidekt.com.evil.it/decks/9')).toBeNull();
    expect(archidektDeckId('https://archidekt.com/decks/abc')).toBeNull();
    expect(archidektDeckId('')).toBeNull();
  });
});

describe('archidektToText', () => {
  it('divide comandante, mazzo e sideboard e salta le carte tolte', () => {
    const { name, text } = archidektToText(deck);
    expect(name).toBe('Mazzo di prova');
    expect(text).toBe(
      [
        'Commander\n1 Tymna the Weaver',
        'Deck\n1 Sol Ring\n2 Island\n1 Fire // Ice',
        'Sideboard\n1 Mana Crypt\n1 Rhystic Study',
      ].join('\n\n'),
    );
  });
});

describe('runImport', () => {
  const files = (request = pending()) => ({
    'config/members.json': members,
    'requests/01.json': request,
  });

  it('scarica il mazzo e segna la richiesta come fatta', async () => {
    let called;
    const updates = await runImport({
      files: files(),
      authors: { 'requests/01.json': 'anna' },
      fetchImpl: async (url) => {
        called = url;
        return reply(200, deck)();
      },
    });
    expect(called).toBe('https://archidekt.com/api/decks/7/');
    expect(updates['requests/01.json']).toMatchObject({
      status: 'done',
      deckName: 'Mazzo di prova',
    });
    expect(updates['requests/01.json'].result).toContain('Commander\n1 Tymna the Weaver');
  });

  it('non rifà le richieste già concluse', async () => {
    const updates = await runImport({
      files: files(pending({ status: 'done' })),
      authors: { 'requests/01.json': 'anna' },
      fetchImpl: () => {
        throw new Error('non deve scaricare');
      },
    });
    expect(updates).toEqual({});
  });

  it('ignora le richieste di chi non è membro e non scarica nulla', async () => {
    const updates = await runImport({
      files: files(),
      authors: { 'requests/01.json': 'intruso' },
      fetchImpl: () => {
        throw new Error('non deve scaricare');
      },
    });
    expect(updates['requests/01.json']).toMatchObject({ status: 'error' });
    expect(updates['requests/01.json'].error).toMatch(/non è un membro/);
  });

  it('autore sconosciuto: respinto nell’Action, ammesso nelle prove locali', async () => {
    const fetchImpl = reply(200, deck);
    const denied = await runImport({ files: files(), fetchImpl });
    expect(denied['requests/01.json'].status).toBe('error');
    const allowed = await runImport({ files: files(), fetchImpl, unknownAuthor: 'allow' });
    expect(allowed['requests/01.json'].status).toBe('done');
  });

  it.each([
    [403, /privato/],
    [404, /privato/],
    [500, /500/],
  ])('Archidekt risponde %i: errore comprensibile', async (status, message) => {
    const updates = await runImport({
      files: files(),
      authors: { 'requests/01.json': 'anna' },
      fetchImpl: reply(status, {}),
    });
    expect(updates['requests/01.json']).toMatchObject({ status: 'error' });
    expect(updates['requests/01.json'].error).toMatch(message);
  });

  it('rete assente: errore, non eccezione', async () => {
    const updates = await runImport({
      files: files(),
      authors: { 'requests/01.json': 'anna' },
      fetchImpl: async () => {
        throw new TypeError('rete');
      },
    });
    expect(updates['requests/01.json'].status).toBe('error');
  });

  it('link non valido, mazzo vuoto e sito non supportato', async () => {
    const authors = { 'requests/01.json': 'anna' };
    const bad = await runImport({
      files: files(pending({ url: 'https://example.com/x' })),
      authors,
      fetchImpl: reply(200, deck),
    });
    expect(bad['requests/01.json'].error).toMatch(/non è un mazzo di Archidekt/);
    const empty = await runImport({
      files: files(),
      authors,
      fetchImpl: reply(200, { name: 'Vuoto', cards: [] }),
    });
    expect(empty['requests/01.json'].error).toMatch(/vuoto/);
    const mox = await runImport({
      files: files(pending({ source: 'moxfield', url: 'https://moxfield.com/decks/a' })),
      authors,
      fetchImpl: reply(200, deck),
    });
    expect(mox['requests/01.json'].error).toMatch(/incolla la lista/);
  });

  it('il token GitHub non c’entra: la richiesta a Archidekt non porta intestazioni di accesso', async () => {
    let init;
    await runImport({
      files: files(),
      authors: { 'requests/01.json': 'anna' },
      fetchImpl: async (_url, options) => {
        init = options;
        return reply(200, deck)();
      },
    });
    expect(Object.keys(init.headers)).toEqual(['accept']);
  });
});

describe('runImport: mazzi di un utente', () => {
  const userRequest = (nick) =>
    JSON.stringify({
      source: 'archidekt-user',
      url: nick,
      requestedBy: 'anna',
      status: 'pending',
      createdAt: '2026-10-03T10:00:00Z',
    });
  const files = (nick = 'r3dl0g') => ({
    'config/members.json': members,
    'requests/01.json': userRequest(nick),
  });
  const authors = { 'requests/01.json': 'anna' };
  const listing = (results, next = null) => ({ count: results.length, next, results });

  it('elenca solo i mazzi pubblici, con nome e link', async () => {
    let called;
    const updates = await runImport({
      files: files(),
      authors,
      fetchImpl: async (url) => {
        called = url;
        return reply(
          200,
          listing([
            { id: 1, name: 'Jodah', size: 100, private: false },
            { id: 2, name: 'Segreto', size: 100, private: true },
            { id: 3, name: '  ', size: 60, private: false },
          ]),
        )();
      },
    });
    expect(called).toBe('https://archidekt.com/api/decks/v3/?ownerUsername=r3dl0g&pageSize=50');
    expect(updates['requests/01.json']).toMatchObject({
      status: 'done',
      decks: [
        { id: '1', name: 'Jodah', size: 100, url: 'https://archidekt.com/decks/1' },
        { id: '3', name: 'Mazzo 3', size: 60, url: 'https://archidekt.com/decks/3' },
      ],
    });
  });

  it('segue le pagine, ma solo verso Archidekt', async () => {
    const urls = [];
    const pages = [
      listing(
        [{ id: 1, name: 'Uno', private: false }],
        'https://archidekt.com/api/decks/v3/?page=2',
      ),
      listing([{ id: 2, name: 'Due', private: false }], 'https://example.com/altro'),
    ];
    const updates = await runImport({
      files: files(),
      authors,
      fetchImpl: async (url) => {
        urls.push(url);
        return reply(200, pages[urls.length - 1])();
      },
    });
    expect(urls).toEqual([
      'https://archidekt.com/api/decks/v3/?ownerUsername=r3dl0g&pageSize=50',
      'https://archidekt.com/api/decks/v3/?page=2',
    ]);
    expect(updates['requests/01.json'].decks.map((d) => d.id)).toEqual(['1', '2']);
  });

  it('nome utente non valido: non chiama Archidekt', async () => {
    const updates = await runImport({
      files: files('../etc?x=1'),
      authors,
      fetchImpl: () => {
        throw new Error('non deve scaricare');
      },
    });
    expect(updates['requests/01.json'].error).toMatch(/non è valido/);
  });

  it.each([
    [404, {}, /Utente non trovato/],
    [200, listing([{ id: 9, name: 'Privato', private: true }]), /Nessun mazzo pubblico/],
    [500, {}, /500/],
  ])('risposta %i: errore comprensibile', async (status, body, message) => {
    const updates = await runImport({
      files: files(),
      authors,
      fetchImpl: reply(status, body),
    });
    expect(updates['requests/01.json'].status).toBe('error');
    expect(updates['requests/01.json'].error).toMatch(message);
  });

  it('chi non è membro non fa partire la ricerca', async () => {
    const updates = await runImport({
      files: files(),
      authors: { 'requests/01.json': 'intruso' },
      fetchImpl: () => {
        throw new Error('non deve scaricare');
      },
    });
    expect(updates['requests/01.json'].error).toMatch(/non è un membro/);
  });
});

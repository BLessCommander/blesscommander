import { describe, expect, it } from 'vitest';
import { archidektDeckId, archidektSalt, archidektToText, runImport } from './import.js';

const deck = {
  id: 7,
  name: 'Mazzo di prova',
  categories: [
    { name: 'Commander', includedInDeck: true },
    { name: 'Sideboard', includedInDeck: false },
    { name: 'Maybeboard', includedInDeck: false },
  ],
  cards: [
    {
      quantity: 1,
      categories: ['Commander'],
      card: { oracleCard: { name: 'Tymna the Weaver', salt: 0.15 } },
    },
    { quantity: 1, categories: null, card: { oracleCard: { name: 'Sol Ring', salt: 0.2 } } },
    { quantity: 2, categories: ['Ramp'], card: { oracleCard: { name: 'Island', salt: 0 } } },
    { quantity: 1, categories: ['Sideboard'], card: { oracleCard: { name: 'Mana Crypt' } } },
    { quantity: 1, categories: ['Maybeboard'], card: { oracleCard: { name: 'Rhystic Study' } } },
    // Più categorie: conta la principale (la prima).
    {
      quantity: 1,
      categories: ['Ramp', 'Maybeboard'],
      card: { oracleCard: { name: 'Felidar Guardian' } },
    },
    {
      quantity: 1,
      categories: ['Maybeboard', 'Ramp'],
      card: { oracleCard: { name: 'Restoration Angel' } },
    },
    {
      quantity: 1,
      categories: null,
      deletedAt: '2024-01-01',
      card: { oracleCard: { name: 'Carta tolta', salt: 3 } },
    },
    {
      quantity: 1,
      categories: null,
      card: { oracleCard: { name: 'Fire // Ice', salt: 'n/d' } },
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

const noWait = async () => {};

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
  it('divide comandante, mazzo e sideboard, salta le carte tolte e conta la categoria principale', () => {
    const { name, text } = archidektToText(deck);
    expect(name).toBe('Mazzo di prova');
    expect(text).toBe(
      [
        'Commander\n1 Tymna the Weaver',
        // Felidar Guardian: principale «Ramp», secondaria «Maybeboard» → nel mazzo.
        'Deck\n1 Sol Ring\n2 Island\n1 Felidar Guardian\n1 Fire // Ice',
        // Restoration Angel: principale «Maybeboard» → fuori dal mazzo.
        'Sideboard\n1 Mana Crypt\n1 Rhystic Study\n1 Restoration Angel',
      ].join('\n\n'),
    );
  });
});

describe('archidektSalt', () => {
  it('legge il salt di ogni carta, salta quelle tolte o senza punteggio numerico', () => {
    expect(archidektSalt(deck)).toEqual({ 'Tymna the Weaver': 0.15, 'Sol Ring': 0.2, Island: 0 });
  });

  it('senza carte non dà nulla', () => {
    expect(archidektSalt({})).toEqual({});
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
    expect(updates['requests/01.json'].salt).toEqual({
      'Tymna the Weaver': 0.15,
      'Sol Ring': 0.2,
      Island: 0,
    });
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
      wait: noWait,
    });
    expect(updates['requests/01.json']).toMatchObject({ status: 'error' });
    expect(updates['requests/01.json'].error).toMatch(message);
  });

  it.each([403, 404, 502])(
    'Archidekt rifiuta %i una volta e poi risponde: il mazzo si scarica',
    async (status) => {
      const calls = [];
      const fetchImpl = async (...args) => {
        calls.push(args[0]);
        return calls.length === 1 ? reply(status, {})() : reply(200, deck)();
      };
      const updates = await runImport({
        files: files(),
        authors: { 'requests/01.json': 'anna' },
        fetchImpl,
        wait: noWait,
      });
      expect(updates['requests/01.json']).toMatchObject({ status: 'done' });
      expect(calls).toHaveLength(2);
    },
  );

  it('dopo 5 rifiuti si arrende e non insiste oltre', async () => {
    let calls = 0;
    const updates = await runImport({
      files: files(),
      authors: { 'requests/01.json': 'anna' },
      fetchImpl: async () => {
        calls++;
        return reply(404, {})();
      },
      wait: noWait,
    });
    expect(updates['requests/01.json']).toMatchObject({ status: 'error' });
    expect(calls).toBe(5);
  });

  it('rete assente: errore, non eccezione', async () => {
    const updates = await runImport({
      files: files(),
      authors: { 'requests/01.json': 'anna' },
      fetchImpl: async () => {
        throw new TypeError('rete');
      },
      wait: noWait,
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

describe('runImport: combo da Commander Spellbook', () => {
  const comboRequest = (url) =>
    JSON.stringify({
      source: 'spellbook',
      url,
      requestedBy: 'anna',
      status: 'pending',
      createdAt: '2026-10-03T10:00:00Z',
    });
  const deckJson = JSON.stringify({
    commanders: ['Tymna the Weaver'],
    cards: [
      { name: "Thassa's Oracle", qty: 1 },
      { name: 'Demonic Consultation', qty: 1 },
    ],
  });
  const files = (url = deckJson) => ({
    'config/members.json': members,
    'requests/01.json': comboRequest(url),
  });
  const authors = { 'requests/01.json': 'anna' };

  it('chiede le combo a Spellbook dal server e le scrive nella richiesta', async () => {
    let sent;
    const updates = await runImport({
      files: files(),
      authors,
      fetchImpl: async (url, init) => {
        sent = { url, body: JSON.parse(init.body) };
        return reply(200, {
          results: {
            included: [
              {
                id: '742-1295',
                uses: [
                  { card: { name: "Thassa's Oracle" } },
                  { card: { name: 'Demonic Consultation' } },
                ],
                produces: [{ feature: { name: 'Win the game' } }],
              },
            ],
          },
        })();
      },
    });
    expect(sent.url).toBe('https://backend.commanderspellbook.com/find-my-combos');
    expect(sent.body.commanders).toEqual([{ card: 'Tymna the Weaver', quantity: 1 }]);
    expect(updates['requests/01.json']).toMatchObject({
      status: 'done',
      combos: [
        {
          id: '742-1295',
          cards: ["Thassa's Oracle", 'Demonic Consultation'],
          produces: ['Win the game'],
          infinite: true,
        },
      ],
    });
  });

  it('se Spellbook non risponde la richiesta finisce in errore', async () => {
    const updates = await runImport({ files: files(), authors, fetchImpl: reply(503, {}) });
    expect(updates['requests/01.json']).toMatchObject({
      status: 'error',
      error: 'Commander Spellbook non risponde',
    });
  });

  it('una richiesta senza la lista del mazzo è respinta senza chiamare nessuno', async () => {
    let called = false;
    const updates = await runImport({
      files: files('non è json'),
      authors,
      fetchImpl: async () => {
        called = true;
        return reply(200, {})();
      },
    });
    expect(called).toBe(false);
    expect(updates['requests/01.json'].status).toBe('error');
  });

  it('chi non è membro non fa partire nessuna chiamata', async () => {
    let called = false;
    const updates = await runImport({
      files: files(),
      authors: { 'requests/01.json': 'estraneo' },
      fetchImpl: async () => {
        called = true;
        return reply(200, {})();
      },
    });
    expect(called).toBe(false);
    expect(updates['requests/01.json'].status).toBe('error');
  });
});

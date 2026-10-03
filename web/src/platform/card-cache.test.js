import { describe, expect, it } from 'vitest';
import { fakeCollection } from '../../../tests/fixtures/scryfall-fake.js';
import { createCardCache } from './card-cache.js';
import { createMemoryStore } from './card-store.js';
import { createScryfall } from './scryfall.js';

/** Scryfall finto che conta le richieste. */
function setup({ ttlMs = 1000 } = {}) {
  const state = { requests: 0, time: 0 };
  const fetchImpl = async (url, init) => {
    state.requests += 1;
    const { identifiers } = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => fakeCollection(identifiers) };
  };
  const scryfall = createScryfall({ fetchImpl, pauseMs: 0 });
  const cache = createCardCache({
    scryfall,
    store: createMemoryStore(),
    ttlMs,
    now: () => state.time,
  });
  return { cache, state };
}

describe('createCardCache.byIds', () => {
  it('chiede a Scryfall una volta sola e poi riusa la cache', async () => {
    const { cache, state } = setup();
    const first = await cache.byIds(['fake-sol-ring', 'fake-arcane-signet']);
    expect(first['fake-sol-ring']).toMatchObject({
      cmc: 3,
      colors: ['U'],
      typeLine: 'Creature — Wizard',
    });
    expect(state.requests).toBe(1);
    await cache.byIds(['fake-sol-ring', 'fake-arcane-signet']);
    expect(state.requests).toBe(1);
  });

  it('chiede solo le carte che mancano', async () => {
    const { cache, state } = setup();
    await cache.byIds(['fake-sol-ring']);
    const result = await cache.byIds(['fake-sol-ring', 'fake-island']);
    expect(Object.keys(result).sort()).toEqual(['fake-island', 'fake-sol-ring']);
    expect(state.requests).toBe(2);
  });

  it('richiede di nuovo le carte scadute', async () => {
    const { cache, state } = setup({ ttlMs: 1000 });
    await cache.byIds(['fake-sol-ring']);
    state.time = 1001;
    await cache.byIds(['fake-sol-ring']);
    expect(state.requests).toBe(2);
  });

  it('salta le carte non trovate e non le salva', async () => {
    const { cache, state } = setup();
    expect(await cache.byIds(['fake-inesistente'])).toEqual({});
    await cache.byIds(['fake-inesistente']);
    expect(state.requests).toBe(2);
  });

  it('senza id non fa richieste', async () => {
    const { cache, state } = setup();
    expect(await cache.byIds([])).toEqual({});
    expect(state.requests).toBe(0);
  });
});

describe('createCardCache.byNames', () => {
  it('cerca per nome una volta sola e salva anche per id', async () => {
    const { cache, state } = setup();
    const first = await cache.byNames(['Krenko, Mob Boss']);
    const card = first['krenko, mob boss'];
    expect(card.colorIdentity).toEqual(['R']);
    await cache.byNames(['Krenko, Mob Boss']);
    const byId = await cache.byIds([card.scryfallId]);
    expect(byId[card.scryfallId].name).toBe('Krenko, Mob Boss');
    expect(state.requests).toBe(1);
  });
});

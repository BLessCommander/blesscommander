import { describe, expect, it } from 'vitest';
import { fakeScryfallFetch } from '../../../tests/fixtures/scryfall-fake.js';
import { fakeSpellbookFetch } from '../../../tests/fixtures/spellbook-fake.js';
import { createScryfall } from '../platform/scryfall.js';
import { createSpellbook } from '../platform/spellbook.js';
import { findDeckCombos } from './deck-features.js';
import { deckCards, parseDeckText } from './deck-parser.js';
import { diffCards, planRecheck, planResync, resyncedDeck, withAssessment } from './deck-resync.js';

const scryfall = createScryfall({ fetchImpl: fakeScryfallFetch, pauseMs: 0 });
const lookupOf = (text) => scryfall.lookup(deckCards(parseDeckText(text)).map((l) => l.name));

const saved = {
  id: '01HZ0000000000000000000001',
  name: 'Jodah',
  commanders: ['Tymna the Weaver'],
  colorIdentity: ['W', 'B'],
  declaredTier: 'F3',
  currentVersion: 1,
  source: { type: 'archidekt', url: 'https://archidekt.com/decks/1', importedAt: '2026-10-01' },
};
const current = {
  version: 1,
  cards: [
    { name: 'Tymna the Weaver', qty: 1 },
    { name: 'Sol Ring', qty: 1 },
    { name: 'Island', qty: 5 },
  ],
};
const base = 'Commander\n1 Tymna the Weaver\n\nDeck\n1 Sol Ring\n5 Island';
const plan = async (result, deckName = 'Jodah', salt = undefined, deck = saved) =>
  planResync({
    deck,
    current,
    fetched: { deckName, result, salt },
    lookup: await lookupOf(result),
    now: '2026-10-03T10:00:00Z',
  });

describe('diffCards', () => {
  it('trova carte entrate, uscite e con quantità diversa', () => {
    expect(
      diffCards(
        [
          { name: 'A', qty: 1 },
          { name: 'B', qty: 1 },
          { name: 'C', qty: 2 },
        ],
        [
          { name: 'B', qty: 1 },
          { name: 'C', qty: 3 },
          { name: 'D', qty: 1 },
        ],
      ),
    ).toEqual({ added: ['D'], removed: ['A'], changed: ['C'] });
  });
});

describe('planResync', () => {
  it('nessuna differenza: non si salva nulla', async () => {
    expect(await plan(base)).toEqual({ status: 'same' });
  });

  it('carte cambiate: nuova versione con il diff, mazzo aggiornato', async () => {
    const result = await plan('Commander\n1 Tymna the Weaver\n\nDeck\n1 Rhystic Study\n6 Island');
    expect(result.status).toBe('update');
    expect(result.version.diff).toEqual({ added: ['Rhystic Study'], removed: ['Sol Ring'] });
    expect(result.version.gameChangers).toEqual(['Rhystic Study']);
    expect(result.summary).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      renamed: false,
      salt: false,
    });
    expect(result.deck).toMatchObject({ id: saved.id, currentVersion: 1, declaredTier: 'F3' });
  });

  it('cambia solo il nome: si aggiorna il mazzo ma non si crea una versione', async () => {
    const result = await plan(base, 'Jodah v2');
    expect(result.status).toBe('update');
    expect(result.version).toBeNull();
    expect(result.deck.name).toBe('Jodah v2');
    expect(result.summary.renamed).toBe(true);
  });

  it('il salt nuovo si salva anche con le stesse carte, senza una nuova versione', async () => {
    const salt = { 'Tymna the Weaver': 0.2, 'Sol Ring': 0.3 };
    const result = await plan(base, 'Jodah', salt);
    expect(result.status).toBe('update');
    expect(result.version).toBeNull();
    expect(result.deck.salt).toEqual(salt);
    expect(result.summary.salt).toBe(true);
  });

  it('lo stesso salt di prima non cambia nulla', async () => {
    const salt = { 'Tymna the Weaver': 0.2, 'Sol Ring': 0.3 };
    expect(await plan(base, 'Jodah', salt, { ...saved, salt })).toEqual({ status: 'same' });
  });

  it('un salt cambiato su EDHREC si aggiorna', async () => {
    const result = await plan(
      base,
      'Jodah',
      { 'Sol Ring': 0.35 },
      { ...saved, salt: { 'Sol Ring': 0.3 } },
    );
    expect(result.status).toBe('update');
    expect(result.deck.salt).toEqual({ 'Sol Ring': 0.35 });
  });

  it('senza salt nell’esito (mazzo da testo) il salt salvato non si tocca', async () => {
    const salt = { 'Sol Ring': 0.3 };
    expect(await plan(base, 'Jodah', undefined, { ...saved, salt })).toEqual({ status: 'same' });
  });

  it('cambia il comandante: si aggiorna anche il mazzo', async () => {
    const result = await plan('Commander\n1 Thrasios, Triton Hero\n\nDeck\n1 Sol Ring\n5 Island');
    expect(result.status).toBe('update');
    expect(result.deck.commanders).toEqual(['Thrasios, Triton Hero']);
    expect(result.deck.colorIdentity).toEqual(['U', 'G']);
  });

  it('lista incompleta: da controllare, il mazzo salvato non cambia', async () => {
    expect(await plan('Deck\n1 Sol Ring')).toMatchObject({
      status: 'review',
      reasons: ['no-commander'],
    });
    expect(await plan('Commander\n1 Tymna the Weaver\n\nDeck\n1 Carta inesistente')).toMatchObject({
      status: 'review',
      reasons: ['not-found'],
    });
  });
});

describe('planRecheck (ricontrollo dopo l’aggiornamento)', () => {
  const checked = { ...saved, selfAssessment: { mld: false, extraTurns: false } };
  const evaluated = { ...current, floor: 'F1', gameChangers: [], combos: [] };
  const recheck = async (result, { deck = checked, version = evaluated, combos = [] } = {}) => {
    const lookup = await lookupOf(result);
    const update = planResync({
      deck,
      current: { ...current, cards: current.cards },
      fetched: { deckName: 'Jodah', result },
      lookup,
      now: '2026-10-03T10:00:00Z',
    });
    return planRecheck({ deck, current: version, plan: update, lookup, combos });
  };
  const ASSESS_TEXT = (extra) =>
    `Commander\n1 Tymna the Weaver\n\nDeck\n1 Sol Ring\n5 Island\n${extra}`;

  it('carta qualunque: niente da ricontrollare, l’esito resta com’era', async () => {
    const result = await recheck(ASSESS_TEXT('1 Mana Crypt'));
    expect(result.needsWizard).toBe(false);
    expect(result.assessment).toMatchObject({ floor: 'F1', massLandDestruction: false });
  });

  it('un game changer nuovo riapre il wizard e alza il pavimento', async () => {
    const result = await recheck(ASSESS_TEXT('1 Rhystic Study'));
    expect(result.needsWizard).toBe(true);
    expect(result.input.gameChangers).toEqual(['Rhystic Study']);
    expect(result.assessment.floor).toBe('F3');
    expect(result.declaredTier).toBe('F3');
  });

  it('una carta che distrugge le terre è proposta e già spuntata', async () => {
    const result = await recheck(ASSESS_TEXT('1 Armageddon'));
    expect(result.needsWizard).toBe(true);
    expect(result.defaults.massLand).toBe(true);
    expect(result.assessment.floor).toBe('F4');
  });

  it('una combo nuova riapre il wizard', async () => {
    const combo = {
      id: '1',
      cards: ["Thassa's Oracle", 'Demonic Consultation'],
      produces: ['Win the game'],
      manaValue: 3,
    };
    const result = await recheck(ASSESS_TEXT("1 Thassa's Oracle\n1 Demonic Consultation"), {
      combos: [combo],
    });
    expect(result.needsWizard).toBe(true);
    expect(result.assessment.floor).toBe('F4');
  });

  it('la stessa combo di prima non riapre il wizard', async () => {
    const combo = { id: '1', cards: ['A', 'B'], produces: ['Infinite mana'], manaValue: 4 };
    const result = await recheck(ASSESS_TEXT('1 Mana Crypt'), {
      version: { ...evaluated, floor: 'F4', combos: [combo] },
      combos: [combo],
    });
    expect(result.needsWizard).toBe(false);
    expect(result.assessment.floor).toBe('F4');
  });

  it('Spellbook non risponde: serve il wizard e le combo dichiarate a mano restano', async () => {
    const manual = { cards: [], produces: [], manaValue: 0 };
    const result = await recheck(ASSESS_TEXT('1 Mana Crypt'), {
      version: { ...evaluated, floor: 'F4', combos: [manual] },
      combos: null,
    });
    expect(result.needsWizard).toBe(true);
    expect(result.assessment.combos).toEqual([manual]);
    expect(result.assessment.floor).toBe('F4');
  });

  it('mazzo vecchio senza pavimento salvato: sempre il wizard', async () => {
    const result = await recheck(ASSESS_TEXT('1 Mana Crypt'), { version: current });
    expect(result.needsWizard).toBe(true);
  });

  it('le risposte di prima restano: terre distrutte già confermate', async () => {
    const result = await recheck(ASSESS_TEXT('1 Mana Crypt'), {
      deck: { ...saved, selfAssessment: { mld: true, extraTurns: false } },
      version: { ...evaluated, floor: 'F4' },
    });
    expect(result.defaults.massLand).toBe(true);
    expect(result.assessment.floor).toBe('F4');
  });
});

describe('withAssessment', () => {
  it('aggiunge pavimento, combo e segnalazioni alla versione', () => {
    const version = withAssessment(
      { cards: [] },
      { floor: 'F4', massLandDestruction: true, chainExtraTurns: false, combos: [] },
    );
    expect(version).toEqual({
      cards: [],
      floor: 'F4',
      combos: [],
      flags: { mld: true, extraTurns: false },
    });
  });
});

describe('ricontrollo con una combo nuova (caso Restoration Angel + Felidar Guardian)', () => {
  const spellbook = createSpellbook({ fetchImpl: fakeSpellbookFetch });
  const deck = { ...saved, selfAssessment: { mld: false, extraTurns: false } };
  const before = { ...current, floor: 'F1', gameChangers: [], combos: [] };

  it('la combo è trovata, riapre il wizard e porta il pavimento a F3 (pezzi da 8 mana)', async () => {
    const result = `${base}\n1 Restoration Angel\n1 Felidar Guardian`;
    const lookup = await lookupOf(result);
    const update = planResync({
      deck,
      current,
      fetched: { deckName: 'Jodah', result },
      lookup,
      now: '2026-10-03T10:00:00Z',
    });
    expect(update.status).toBe('update');
    const combos = await findDeckCombos({
      commanders: update.commanders,
      cards: update.cards,
      lookup,
      request: async (json) => ({
        combos: await spellbook.findCombos(JSON.parse(json)),
      }),
    });
    expect(combos).toHaveLength(1);
    expect(combos[0]).toMatchObject({
      cards: ['Restoration Angel', 'Felidar Guardian'],
      manaValue: 8,
    });
    const recheck = planRecheck({ deck, current: before, plan: update, lookup, combos });
    expect(recheck.needsWizard).toBe(true);
    expect(recheck.assessment.floor).toBe('F3');
    expect(recheck.declaredTier).toBe('F3');
  });
});

describe('resyncedDeck (il mazzo che si salva dopo l’aggiornamento)', () => {
  const fresh = {
    ...saved,
    selfAssessment: { mld: false, extraTurns: false, notes: 'ok' },
    salt: { 'Sol Ring': 0.1 },
  };

  it('porta il salt nuovo nel mazzo salvato', async () => {
    const salt = { 'Tymna the Weaver': 0.2, 'Sol Ring': 0.3 };
    const result = await plan(base, 'Jodah', salt);
    expect(resyncedDeck(saved, result).salt).toEqual(salt);
  });

  it('un salt nuovo sostituisce quello vecchio', async () => {
    const result = await plan(base, 'Jodah', { 'Sol Ring': 0.35 }, fresh);
    expect(resyncedDeck(fresh, result).salt).toEqual({ 'Sol Ring': 0.35 });
  });

  it('i tag scelti dal proprietario sopravvivono all’aggiornamento', async () => {
    const tagged = { ...fresh, tags: ['veloce', 'combo'] };
    const result = await plan(base, 'Jodah v2', undefined, tagged);
    expect(resyncedDeck(tagged, result).tags).toEqual(['veloce', 'combo']);
  });

  it('senza salt nell’aggiornamento quello salvato resta', async () => {
    const result = await plan(base, 'Jodah v2', undefined, fresh);
    expect(resyncedDeck(fresh, result).salt).toEqual({ 'Sol Ring': 0.1 });
  });

  it('aggiorna nome, comandanti, colori e link e tiene gli altri campi', async () => {
    const result = await plan(base, 'Jodah v2');
    const deck = resyncedDeck(fresh, result);
    expect(deck).toMatchObject({
      id: saved.id,
      name: 'Jodah v2',
      declaredTier: 'F3',
      currentVersion: 1,
      selfAssessment: { notes: 'ok' },
    });
  });

  it('con l’esito del controllo aggiorna l’autovalutazione e la fascia scelta', async () => {
    const result = await plan(base, 'Jodah v2'); // con le stesse carte e lo stesso nome non c'è nulla da salvare
    const deck = resyncedDeck(fresh, result, {
      assessment: { massLandDestruction: true, chainExtraTurns: true },
      declaredTier: 'F4',
    });
    expect(deck.declaredTier).toBe('F4');
    expect(deck.selfAssessment).toEqual({ mld: true, extraTurns: true, notes: 'ok' });
  });
});

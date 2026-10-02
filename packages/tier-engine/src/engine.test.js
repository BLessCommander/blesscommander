import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  analyzeGame,
  buildConfig,
  computeFloor,
  effectiveTurn,
  evaluateDeck,
  recalculate,
} from './index.js';

const pad = (n) => String(n).padStart(3, '0');

/**
 * Partita ufficiale. `players` sono gli id dei mazzi (login = id in minuscolo).
 * @param {number} n numero progressivo: decide l'ordine cronologico
 */
function game(n, { format = 'ffa4', players, winners, turn = 7, type = 'creature', ...extra }) {
  return {
    id: `g${pad(n)}`,
    formatId: format,
    status: 'ufficiale',
    createdAt: `2026-01-01T00:${pad(n)}:00Z`,
    endedAt: `2026-01-01T01:${pad(n)}:00Z`,
    players: players
      .map((p) => (typeof p === 'string' ? { deckId: p } : p))
      .map((p) => ({
        login: p.deckId.toLowerCase(),
        ...p,
      })),
    winners: winners.map((w) => ({ login: w.toLowerCase(), deckId: w })),
    winTurn: turn,
    turnSource: 'dado',
    winType: type,
    ...extra,
  };
}

const table = ['K', 'B', 'C', 'D'];
const decks = (declared = 'F2', extra = {}) =>
  table.map((id) => ({ id, declaredTier: declared, ...extra }));
const win = (n, winner, turn, type = 'creature', extra = {}) =>
  game(n, { players: table, winners: [winner], turn, type, ...extra });

// Esempio §3.8: Krenko vince al turno 9 (drain), 8 (creature), 7 (combo), 7 (creature).
const krenkoHistory = () => [
  win(1, 'B', 7),
  win(2, 'K', 9, 'drain'),
  win(3, 'K', 8),
  win(4, 'K', 7, 'combo'),
  win(5, 'K', 7),
];

/** Mazzo con già dei dati, per provare le regole senza costruire intere partite. */
function deckState(overrides = {}) {
  return {
    tier: 'F2',
    floor: 'F1',
    f5Confirmed: false,
    gamesPlayed: 10,
    gamesSinceChange: 5,
    speed: [],
    dominance: [],
    ...overrides,
  };
}
const speedRecords = (turns, kind = 'win') => turns.map((tEff) => ({ kind, tEff, weight: 1 }));

describe('UT-ENG-01..03: velocità e TMV', () => {
  it('01: esempio §3.8, prime 4 vittorie → TMV ≈ 7,35, resta F2, in osservazione', () => {
    const { decks: out, events } = recalculate(decks(), krenkoHistory());
    expect(out.K.tier.tmv).toBeCloseTo(7.35, 2);
    expect(out.K.tier.speedTier).toBe('F3');
    expect(out.K.tier.current).toBe('F2');
    expect(out.K.tier.status).toBe('in_osservazione');
    expect(events.filter((e) => e.deckId === 'K')).toEqual([]);
  });

  it('02: quinta vittoria al turno 6 → TMV ≈ 6,98, promosso F3 per velocità', () => {
    const { decks: out, events } = recalculate(decks(), [...krenkoHistory(), win(6, 'K', 6)]);
    expect(out.K.tier.tmv).toBeCloseTo(6.98, 2);
    expect(out.K.tier.current).toBe('F3');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      deckId: 'K',
      gameId: 'g006',
      from: 'F2',
      to: 'F3',
      reasons: ['velocita'],
    });
    expect(out.K.tier.lastChangeAt).toBe('2026-01-01T01:006:00Z');
  });

  it('03: meno di 3 vittorie → Fv non valida e nessuna promozione', () => {
    const { decks: out, events } = recalculate(decks(), [win(1, 'K', 3), win(2, 'K', 3)]);
    expect(out.K.tier.speedTier).toBeNull();
    expect(out.K.tier.tmv).toBeCloseTo(3);
    expect(out.K.tier.current).toBe('F2');
    expect(events).toEqual([]);
  });
});

describe('UT-ENG-04..07: regole di decisione', () => {
  const dominantHistory = (turn) => [
    win(1, 'B', 7),
    win(2, 'C', 7),
    win(3, 'K', turn),
    win(4, 'K', turn),
    win(5, 'K', turn),
    win(6, 'K', turn),
  ];

  it('04: D ≥ 1,8 ma TMV 11 in F1 → non sale, badge "Dominante della fascia"', () => {
    const { decks: out, events } = recalculate(decks('F1'), dominantHistory(11));
    expect(out.K.tier.dominance).toBeGreaterThanOrEqual(1.8);
    expect(out.K.tier.current).toBe('F1');
    expect(out.K.tier.badges).toContain('Dominante della fascia');
    expect(out.K.tier.status).toBe('dominante');
    expect(events.filter((e) => e.deckId === 'K')).toEqual([]);
  });

  it('04: D ≥ 1,8 con TMV 10 (entro il limite + 1 turno) → sale di una fascia per dominio', () => {
    const { decks: out, events } = recalculate(decks('F1'), dominantHistory(10));
    expect(out.K.tier.current).toBe('F2');
    expect(events.find((e) => e.deckId === 'K').reasons).toEqual(['dominio']);
  });

  it('05: declassamento sotto il pavimento → resta al pavimento, "Sovradimensionato in lista"', () => {
    const history = [win(1, 'K', 12), win(2, 'K', 12), win(3, 'K', 12)];
    const { decks: out, events } = recalculate(decks('F3', { floor: 'F3' }), history);
    expect(out.K.tier.current).toBe('F3');
    expect(out.K.tier.badges).toContain('Sovradimensionato in lista');
    expect(events.filter((e) => e.deckId === 'K')).toEqual([]);
  });

  it('05: senza pavimento lo stesso mazzo scende per lentezza', () => {
    const history = [win(1, 'K', 12), win(2, 'K', 12), win(3, 'K', 12)];
    const { decks: out, events } = recalculate(decks('F3'), history);
    expect(out.K.tier.current).toBe('F2');
    expect(events.find((e) => e.deckId === 'K').reasons).toEqual(['lentezza']);
  });

  it('06: cooldown non trascorso → nessun cambio; trascorso → cambia', () => {
    const fast = speedRecords([5, 5, 5, 5]);
    const blocked = evaluateDeck(deckState({ speed: fast, gamesSinceChange: 2 }), DEFAULT_PARAMS);
    expect(blocked.tier).toBe('F2');
    const allowed = evaluateDeck(deckState({ speed: fast, gamesSinceChange: 3 }), DEFAULT_PARAMS);
    expect(allowed.tier).toBe('F3');
  });

  it('06: dopo un cambio servono 3 partite prima del successivo', () => {
    const history = [
      ...krenkoHistory(),
      win(6, 'K', 6), // promosso a F3
      win(7, 'K', 2),
      win(8, 'K', 2),
      win(9, 'K', 2),
    ];
    const { events } = recalculate(decks(), history);
    const changes = events.filter((e) => e.deckId === 'K').map((e) => [e.gameId, e.from, e.to]);
    expect(changes).toEqual([
      ['g006', 'F2', 'F3'],
      ['g009', 'F3', 'F4'],
    ]);
  });

  it('07: calcolo che porterebbe in F5 senza conferma → resta F4, "F5_richiede_conferma"', () => {
    const state = deckState({ tier: 'F4', speed: speedRecords([3, 3, 3, 3]) });
    const result = evaluateDeck(state, DEFAULT_PARAMS);
    expect(result.tier).toBe('F4');
    expect(result.reasons).toContain('F5_richiede_conferma');
    expect(evaluateDeck({ ...state, f5Confirmed: true }, DEFAULT_PARAMS).tier).toBe('F5');
  });

  it('inefficacia: D ≤ 0,35 su almeno 8 partite scende di una fascia', () => {
    const history = Array.from({ length: 8 }, (_, i) => win(i + 1, 'B', 7));
    const { decks: out } = recalculate(decks('F3'), history);
    expect(out.K.tier.dominance).toBe(0);
    expect(out.K.tier.current).toBe('F2');
  });
});

describe('UT-ENG-08..15: formati e pesi', () => {
  const cfg = buildConfig();
  const tierOf = () => 'F2';
  const speedOf = (contributions, deckId) => contributions.find((c) => c.deckId === deckId);

  it('08: partita a 3 al turno 6 → t_eff = 6,9', () => {
    const g = game(1, { format: 'ffa3', players: ['A', 'B', 'C'], winners: ['A'], turn: 6 });
    expect(speedOf(analyzeGame(g, cfg, tierOf), 'A').speed.tEff).toBeCloseTo(6.9);
  });

  it('09: 1v1 → pesi 0,5 e atteso 1/2', () => {
    const g = game(1, { format: '1v1', players: ['A', 'B'], winners: ['A'] });
    const a = speedOf(analyzeGame(g, cfg, tierOf), 'A');
    expect(a.speed.weight).toBeCloseTo(0.5);
    expect(a.dominance.expected / 0.5).toBeCloseTo(1 / 2);
    expect(a.speed.tEff).toBeCloseTo(7 * 1.3);
  });

  it('10: 2v2 vinto → entrambi i mazzi della squadra ricevono il dato, contendenti = 2', () => {
    const g = game(1, {
      format: '2v2',
      players: [
        { deckId: 'A', team: 'x' },
        { deckId: 'B', team: 'x' },
        { deckId: 'C', team: 'y' },
        { deckId: 'D', team: 'y' },
      ],
      winners: ['A'],
      winningTeam: 'x',
    });
    const result = analyzeGame(g, cfg, tierOf);
    for (const id of ['A', 'B']) {
      const c = speedOf(result, id);
      expect(c.won).toBe(true);
      expect(c.speed.weight).toBeCloseTo(0.5);
      expect(c.dominance.expected / 0.5).toBeCloseTo(1 / 2);
      expect(c.dominance.actual).toBeCloseTo(0.5);
    }
    expect(speedOf(result, 'C')).toMatchObject({ won: false, speed: null });
  });

  it('11: vittoria condivisa a 2 nello Star → quota 0,5 ciascuno', () => {
    const g = game(1, { format: 'star', players: ['A', 'B', 'C', 'D', 'E'], winners: ['A', 'B'] });
    const result = analyzeGame(g, cfg, tierOf);
    expect(speedOf(result, 'A').dominance.actual).toBeCloseTo(0.5 * 0.75);
    expect(speedOf(result, 'B').dominance.actual).toBeCloseTo(0.5 * 0.75);
    expect(speedOf(result, 'A').dominance.expected).toBeCloseTo((1 / 5) * 0.75);
  });

  it('12: Treachery → nessun effetto sulle fasce', () => {
    const g = game(1, { format: 'treachery', players: table, winners: ['K'] });
    expect(analyzeGame(g, cfg, tierOf)).toBeNull();
    const { decks: out, events } = recalculate(decks(), [g]);
    expect(out.K.stats.games).toBe(0);
    expect(out.K.tier.current).toBe('F2');
    expect(events).toEqual([]);
  });

  it('13: turno stimato → peso 0,75 rispetto al turno da dado', () => {
    const dice = game(1, { players: table, winners: ['K'] });
    const estimated = game(1, { players: table, winners: ['K'], turnSource: 'stima' });
    const w = (g) => speedOf(analyzeGame(g, cfg, tierOf), 'K').speed.weight;
    expect(w(estimated) / w(dice)).toBeCloseTo(0.75);
  });

  it('14: partita non rappresentativa → peso 0 (non entra nel calcolo)', () => {
    const g = game(1, { players: table, winners: ['K'], notRepresentative: true });
    expect(analyzeGame(g, cfg, tierOf)).toBeNull();
    const { decks: out } = recalculate(decks(), [g]);
    expect(out.K.stats.games).toBe(0);
    expect(out.K.tier.tmv).toBeNull();
  });

  it('15: eliminazione registrata → dato di velocità a peso 0,5', () => {
    const g = game(1, {
      players: [
        { deckId: 'A' },
        { deckId: 'B', eliminatedTurn: 4, eliminatedBy: 'a' },
        { deckId: 'C' },
        { deckId: 'D' },
      ],
      winners: ['C'],
    });
    const result = analyzeGame(g, cfg, tierOf);
    expect(speedOf(result, 'A').speed).toEqual({ kind: 'elimination', tEff: 4, weight: 0.5 });
    expect(speedOf(result, 'B').speed).toBeNull();
  });

  it('peso del tavolo: avversari di fascia superiore pesano di più, con limiti 0,5 e 2', () => {
    const g = game(1, { players: ['A', 'B', 'C', 'D'], winners: ['A'] });
    const tiers = { A: 'F1', B: 'F3', C: 'F3', D: 'F3' };
    expect(
      speedOf(
        analyzeGame(g, cfg, (id) => tiers[id]),
        'A',
      ).speed.weight,
    ).toBe(2);
    const low = { A: 'F5', B: 'F1', C: 'F1', D: 'F1' };
    expect(
      speedOf(
        analyzeGame(g, cfg, (id) => low[id]),
        'A',
      ).speed.weight,
    ).toBe(0.5);
  });

  it('variante Planechase: pesi velocità e dominio × 0,75', () => {
    const g = game(1, { players: table, winners: ['K'], variants: ['planechase'] });
    const k = speedOf(analyzeGame(g, cfg, tierOf), 'K');
    expect(k.speed.weight).toBeCloseTo(0.75);
    expect(k.dominance.expected).toBeCloseTo(0.25 * 0.75);
  });
});

describe('UT-ENG-16..17: determinismo e ricalcolo', () => {
  it('16: stesso storico e parametri → risultato identico, anche con partite in ordine diverso', () => {
    const history = [...krenkoHistory(), win(6, 'K', 6), win(7, 'C', 5, 'combo')];
    const first = recalculate(decks(), history);
    const second = recalculate(decks(), structuredClone(history));
    const shuffled = recalculate(decks(), [...history].reverse());
    expect(second).toEqual(first);
    expect(shuffled).toEqual(first);
  });

  it('17: correggere una partita passata = calcolo da zero sullo storico corretto', () => {
    const original = [...krenkoHistory(), win(6, 'K', 6)];
    const corrected = structuredClone(original);
    corrected[5].status = 'annullata'; // la sesta partita viene annullata dopo la riapertura
    const before = recalculate(decks(), original);
    const after = recalculate(decks(), corrected);
    expect(before.events).toHaveLength(1);
    expect(after.events.filter((e) => e.deckId === 'K')).toEqual([]);
    expect(after.decks.K.tier.current).toBe('F2');
    // Le partite prima di quella corretta restano com'erano.
    for (const id of ['g001', 'g002', 'g003', 'g004', 'g005']) {
      expect(after.tierAtGame[id]).toEqual(before.tierAtGame[id]);
    }
    expect(recalculate(decks(), structuredClone(corrected))).toEqual(after);
  });

  it('le partite non ufficiali non contano', () => {
    const history = krenkoHistory().map((g) => ({ ...g, status: 'riaperta' }));
    expect(recalculate(decks(), history).decks.K.stats.games).toBe(0);
  });
});

describe('UT-ENG-18: pavimento di costruzione', () => {
  const params = DEFAULT_PARAMS;
  it.each([
    ['0 game changer', {}, 'F1'],
    ['4 game changer', { gameChangers: 4 }, 'F3'],
    ['6 game changer', { gameChangers: 6 }, 'F4'],
    ['terre distrutte', { massLandDestruction: true }, 'F4'],
    ['turni extra concatenabili', { chainExtraTurns: true }, 'F4'],
    ['combo rapida (mana ≤ 6)', { twoCardCombo: { manaValue: 6 } }, 'F4'],
    ['combo tardiva (mana ≥ 7)', { twoCardCombo: { manaValue: 7 } }, 'F3'],
  ])('%s → %s', (_name, features, expected) => {
    expect(computeFloor(features, params)).toBe(expected);
  });

  it('prende il più alto tra le condizioni', () => {
    expect(computeFloor({ gameChangers: 2, twoCardCombo: { manaValue: 9 } }, params)).toBe('F3');
    expect(computeFloor({ gameChangers: 2, massLandDestruction: true }, params)).toBe('F4');
  });

  it('il limite dei game changer in F3 è un parametro del gruppo', () => {
    expect(computeFloor({ gameChangers: 4 }, { ...params, maxGameChangerF3: 3 })).toBe('F4');
  });

  it('un mazzo dichiarato sotto il pavimento parte dal pavimento', () => {
    const { decks: out } = recalculate([{ id: 'K', declaredTier: 'F1', floor: 'F4' }], []);
    expect(out.K.tier.current).toBe('F4');
  });
});

describe('UT-ENG-19..20: modificatori e parametri del gruppo', () => {
  it('19: ogni tipo di vittoria applica il valore dei parametri', () => {
    for (const [type, modifier] of Object.entries(DEFAULT_PARAMS.modificatoriVittoria)) {
      expect(effectiveTurn(7, 1, type, DEFAULT_PARAMS.modificatoriVittoria)).toBeCloseTo(
        7 + modifier,
      );
    }
    expect(() => effectiveTurn(7, 1, 'inventato', DEFAULT_PARAMS.modificatoriVittoria)).toThrow();
  });

  it('20: il motore usa i parametri del gruppo, non i default', () => {
    const g = game(1, { players: table, winners: ['K'], turn: 7, type: 'combo' });
    const custom = buildConfig({ settings: { modificatoriVittoria: { combo: -2 } } });
    expect(analyzeGame(g, custom, () => 'F2')[0].speed.tEff).toBeCloseTo(5);
    expect(analyzeGame(g, buildConfig(), () => 'F2')[0].speed.tEff).toBeCloseTo(6);
  });

  it('20: soglie e cooldown personalizzati cambiano la decisione', () => {
    const history = [...krenkoHistory(), win(6, 'K', 6)];
    const fast = [...history, win(7, 'K', 2), win(8, 'K', 2)];
    const shortCooldown = recalculate(decks(), fast, { settings: { cooldownPartite: 1 } });
    const changes = shortCooldown.events.filter((e) => e.deckId === 'K').map((e) => e.gameId);
    expect(changes).toEqual(['g006', 'g007']);
    // Con 5 vittorie su 6 anche il dominio farebbe salire il mazzo: lo escludo per isolare il margine.
    const strict = recalculate(decks(), history, {
      settings: { margineIsteresi: 1.5, dominioAlto: 99 },
    });
    expect(strict.decks.K.tier.current).toBe('F2');
  });

  it('un formato personalizzato del gruppo si aggiunge a quelli di default', () => {
    const group = {
      formats: [
        {
          id: 'casa',
          nome: 'Casa',
          giocatoriMin: 3,
          giocatoriMax: 3,
          tipo: 'ffa',
          fattoreTurno: 2,
          pesoVelocita: 1,
          pesoDominio: 1,
          contaPerFasce: true,
        },
      ],
    };
    const g = game(1, { format: 'casa', players: ['A', 'B', 'C'], winners: ['A'], turn: 5 });
    expect(analyzeGame(g, buildConfig(group), () => 'F2')[0].speed.tEff).toBe(10);
    expect(buildConfig(group).formats.some((f) => f.id === 'ffa4')).toBe(true);
  });
});

// Ricalcolo da zero sullo storico (SPEC §3.7): stesso storico e stessi parametri, stesso risultato.
import { evaluateDeck } from './decision.js';
import { buildConfig } from './defaults.js';
import { analyzeGame } from './metrics.js';
import { maxTier } from './tiers.js';

/**
 * @typedef {object} DeckInput
 * @property {string} id
 * @property {import('./tiers.js').TierId} declaredTier fascia dichiarata dal proprietario
 * @property {import('./tiers.js').TierId} [floor] pavimento (default F1)
 * @property {boolean} [f5Confirmed] il proprietario ha confermato la fascia F5
 */

/** Ordine cronologico delle partite: chiusura, poi creazione, poi id. */
function compareGames(a, b) {
  const ta = a.endedAt ?? a.createdAt ?? '';
  const tb = b.endedAt ?? b.createdAt ?? '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Rigioca tutte le partite ufficiali in ordine cronologico.
 * @param {DeckInput[]} decks
 * @param {any[]} games partite (schema `game`); contano solo quelle con `status: 'ufficiale'`
 * @param {Parameters<typeof buildConfig>[0]} [group] parametri, formati e varianti del gruppo
 * @returns {{
 *   decks: Record<string, { tier: Record<string, any>, stats: { games: number, wins: number, winTypes: Record<string, number> } }>,
 *   events: any[],
 *   tierAtGame: Record<string, Record<string, string>>,
 * }}
 */
export function recalculate(decks, games, group) {
  const cfg = buildConfig(group);
  const { params } = cfg;

  const states = new Map();
  const info = new Map();
  for (const deck of decks) {
    const floor = deck.floor ?? 'F1';
    states.set(deck.id, {
      tier: maxTier(deck.declaredTier, floor),
      floor,
      f5Confirmed: deck.f5Confirmed ?? false,
      gamesPlayed: 0,
      gamesSinceChange: params.cooldownPartite,
      speed: [],
      dominance: [],
    });
    info.set(deck.id, {
      tmv: null,
      speedTier: null,
      dominance: null,
      status: 'provvisorio',
      badges: [],
      lastChangeAt: undefined,
      stats: { games: 0, wins: 0, winTypes: {} },
    });
  }

  const events = [];
  const tierAtGame = {};
  const official = games.filter((g) => g.status === 'ufficiale').sort(compareGames);

  for (const game of official) {
    const players = game.players.filter((p) => states.has(p.deckId));
    const tierOf = (deckId) => states.get(deckId).tier;
    tierAtGame[game.id] = Object.fromEntries(players.map((p) => [p.deckId, tierOf(p.deckId)]));
    const contributions = analyzeGame({ ...game, players }, cfg, tierOf);
    if (!contributions) continue;

    for (const c of contributions) {
      const state = states.get(c.deckId);
      state.gamesPlayed += 1;
      state.gamesSinceChange += 1;
      if (c.speed) state.speed.push(c.speed);
      if (c.dominance) state.dominance.push(c.dominance);
      const stats = info.get(c.deckId).stats;
      stats.games += 1;
      if (c.won) {
        stats.wins += 1;
        stats.winTypes[c.winType] = (stats.winTypes[c.winType] ?? 0) + 1;
      }
    }

    // Prima si valutano tutti, poi si applicano i cambi: nessun mazzo vede la fascia nuova di un altro.
    const evaluations = contributions.map((c) => [
      c.deckId,
      evaluateDeck(states.get(c.deckId), params),
    ]);
    for (const [deckId, evaluation] of evaluations) {
      const state = states.get(deckId);
      const entry = info.get(deckId);
      Object.assign(entry, {
        tmv: evaluation.tmv,
        speedTier: evaluation.speedTier,
        dominance: evaluation.dominance,
        status: evaluation.status,
        badges: evaluation.badges,
      });
      if (evaluation.tier !== state.tier) {
        const at = game.endedAt ?? game.createdAt;
        events.push({
          id: `${game.id}:${deckId}`,
          deckId,
          gameId: game.id,
          from: state.tier,
          to: evaluation.tier,
          reasons: evaluation.reasons,
          metricsSnapshot: {
            tmv: evaluation.tmv,
            speedTier: evaluation.speedTier,
            dominance: evaluation.dominance,
          },
          createdAt: at,
        });
        state.tier = evaluation.tier;
        state.gamesSinceChange = 0;
        entry.lastChangeAt = at;
      }
    }
  }

  const result = {};
  for (const [id, state] of states) {
    const entry = info.get(id);
    const tier = {
      current: state.tier,
      floor: state.floor,
      speedTier: entry.speedTier,
      tmv: entry.tmv,
      dominance: entry.dominance,
      status: entry.status,
      badges: entry.badges,
      gamesSinceChange: state.gamesSinceChange,
    };
    if (entry.lastChangeAt) tier.lastChangeAt = entry.lastChangeAt;
    result[id] = { tier, stats: entry.stats };
  }
  return { decks: result, events, tierAtGame };
}

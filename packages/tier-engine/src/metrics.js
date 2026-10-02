// Dati di velocità e dominio di una partita, TMV e D (SPEC §3.3, §3.4, §3.5, §3.10).
import { tierNumber } from './tiers.js';

/**
 * @typedef {object} SpeedRecord
 * @property {'win'|'elimination'} kind
 * @property {number} tEff turno effettivo
 * @property {number} weight peso senza decadimento (tavolo × tipo dato × formato × origine turno)
 */

/**
 * @typedef {object} DominanceRecord
 * @property {number} expected vittorie attese, già pesate per il formato
 * @property {number} actual vittorie reali, già pesate per formato e tavolo
 */

/**
 * @typedef {object} GameContribution
 * @property {string} deckId
 * @property {boolean} won
 * @property {string} [winType]
 * @property {SpeedRecord|null} speed
 * @property {DominanceRecord|null} dominance
 */

/** @param {number} value @param {number} min @param {number} max */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** @param {any} game @param {any} cfg @returns {any} formato della partita */
export function formatOf(game, cfg) {
  const format = cfg.formats.find((f) => f.id === game.formatId);
  if (!format) throw new Error(`Formato sconosciuto: ${game.formatId}`);
  return format;
}

/** Moltiplicatori delle varianti scelte in lobby (es. Planechase). */
function variantMultipliers(game, cfg) {
  let speed = 1;
  let dominance = 1;
  for (const id of game.variants ?? []) {
    const variant = cfg.variants.find((v) => v.id === id);
    if (!variant) throw new Error(`Variante sconosciuta: ${id}`);
    speed *= variant.moltiplicatoreVelocita;
    dominance *= variant.moltiplicatoreDominio;
  }
  return { speed, dominance };
}

/**
 * Turno effettivo di una vittoria: turno × fattore del formato + modificatore del tipo.
 * @param {number} turn @param {number} formatFactor @param {string} winType @param {Record<string, number>} modifiers
 */
export function effectiveTurn(turn, formatFactor, winType, modifiers) {
  if (!(winType in modifiers)) throw new Error(`Tipo di vittoria sconosciuto: ${winType}`);
  return turn * formatFactor + modifiers[winType];
}

/**
 * Peso del tavolo: battere mazzi di fascia superiore è un indizio più forte di velocità.
 * @param {number} opponentsAverageTier @param {number} deckTier
 */
export function tableWeight(opponentsAverageTier, deckTier) {
  return clamp(1 + 0.5 * (opponentsAverageTier - deckTier), 0.5, 2);
}

/**
 * Quanto la partita dice sui mazzi partecipanti. Restituisce `null` se non conta per le fasce
 * (formato solo statistiche o partita non rappresentativa).
 * @param {any} game partita ufficiale (schema `game`)
 * @param {any} cfg configurazione di `buildConfig`
 * @param {(deckId: string) => import('./tiers.js').TierId} tierOf fascia del mazzo a inizio partita
 * @returns {GameContribution[]|null}
 */
export function analyzeGame(game, cfg, tierOf) {
  const format = formatOf(game, cfg);
  if (!format.contaPerFasce || game.notRepresentative) return null;

  const { params } = cfg;
  const variants = variantMultipliers(game, cfg);
  const speedWeight = format.pesoVelocita * variants.speed;
  const dominanceWeight = format.pesoDominio * variants.dominance;
  const originWeight = game.turnSource === 'stima' ? params.pesoTurnoStimato : 1;
  const players = game.players;
  const teamBased = format.tipo === 'squadre';

  const winnerDecks = new Set(
    teamBased
      ? players.filter((p) => p.team === game.winningTeam).map((p) => p.deckId)
      : (game.winners ?? []).map((w) => w.deckId),
  );
  const contenders = teamBased ? new Set(players.map((p) => p.team)).size : players.length;
  const shareOfWin = winnerDecks.size === 0 ? 0 : teamBased ? 1 : 1 / winnerDecks.size;

  const opponentsOf = (player) =>
    players.filter((p) => p !== player && !(teamBased && p.team === player.team));
  const tableWeightFor = (player) => {
    const opponents = opponentsOf(player);
    if (opponents.length === 0) return 1;
    const average =
      opponents.reduce((sum, p) => sum + tierNumber(tierOf(p.deckId)), 0) / opponents.length;
    return tableWeight(average, tierNumber(tierOf(player.deckId)));
  };

  /** @type {Map<string, SpeedRecord>} un dato di eliminazione per ogni mazzo che ha eliminato */
  const eliminations = new Map();
  for (const victim of players) {
    if (victim.eliminatedTurn == null || winnerDecks.has(victim.deckId)) continue;
    const eliminator = players.find((p) => p.login === victim.eliminatedBy);
    if (!eliminator || winnerDecks.has(eliminator.deckId)) continue;
    const weight =
      tableWeightFor(eliminator) * params.pesoEliminazione * speedWeight * originWeight;
    if (weight <= 0) continue;
    // Più eliminazioni dello stesso mazzo nella stessa partita: conta la più veloce.
    const tEff = victim.eliminatedTurn * format.fattoreTurno;
    const previous = eliminations.get(eliminator.deckId);
    if (!previous || tEff < previous.tEff) {
      eliminations.set(eliminator.deckId, { kind: 'elimination', tEff, weight });
    }
  }

  return players.map((player) => {
    const won = winnerDecks.has(player.deckId);
    const table = tableWeightFor(player);
    /** @type {SpeedRecord|null} */
    let speed = null;
    if (won) {
      const weight = table * speedWeight * originWeight;
      if (weight > 0) {
        const tEff = effectiveTurn(
          game.winTurn,
          format.fattoreTurno,
          game.winType,
          params.modificatoriVittoria,
        );
        speed = { kind: 'win', tEff, weight };
      }
    } else {
      speed = eliminations.get(player.deckId) ?? null;
    }
    const dominance =
      dominanceWeight > 0
        ? {
            expected: (1 / contenders) * dominanceWeight,
            actual: (won ? shareOfWin : 0) * dominanceWeight * table,
          }
        : null;
    return {
      deckId: player.deckId,
      won,
      winType: won ? game.winType : undefined,
      speed,
      dominance,
    };
  });
}

/**
 * TMV: media pesata dei turni effettivi delle ultime N vittorie/eliminazioni, con decadimento.
 * @param {SpeedRecord[]} records in ordine cronologico
 * @param {{ finestraVittorie: number, decadimento: number }} params
 * @returns {{ tmv: number|null, wins: number }} `tmv` è null senza dati; `wins` conta le vittorie nella finestra
 */
export function computeTmv(records, params) {
  const window = records.slice(-params.finestraVittorie).reverse();
  if (window.length === 0) return { tmv: null, wins: 0 };
  let sum = 0;
  let weights = 0;
  window.forEach((record, k) => {
    const weight = params.decadimento ** k * record.weight;
    sum += record.tEff * weight;
    weights += weight;
  });
  return { tmv: sum / weights, wins: window.filter((r) => r.kind === 'win').length };
}

/**
 * D: vittorie reali / vittorie attese sulle ultime partite. Null con meno di `minPartiteDominio` partite.
 * @param {DominanceRecord[]} records in ordine cronologico
 * @param {{ finestraPartiteDominio: number, minPartiteDominio: number }} params
 * @returns {{ d: number|null, games: number }}
 */
export function computeDominance(records, params) {
  const window = records.slice(-params.finestraPartiteDominio);
  if (window.length < params.minPartiteDominio) return { d: null, games: window.length };
  const expected = window.reduce((sum, r) => sum + r.expected, 0);
  const actual = window.reduce((sum, r) => sum + r.actual, 0);
  return { d: expected > 0 ? actual / expected : null, games: window.length };
}

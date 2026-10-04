// Action `recalc` (SPEC §6.5): valida i file, controlla le autorizzazioni dall'autore dei commit,
// ricalcola da zero con il motore e restituisce i file di `derived/`. Funzione pura: niente rete,
// niente disco, niente data corrente. Lo stesso storico dà sempre lo stesso risultato.
import { buildConfig, recalculate } from '@blesscommander/tier-engine';
import { validate } from '../../web/src/data/validate.js';

/**
 * @typedef {object} RecalcInput
 * @property {Record<string, string>} files contenuto testuale dei file di input (config, decks, games, votes)
 * @property {Record<string, string>} [authors] percorso → login di chi ha fatto l'ultimo commit su quel file
 * @property {'allow'|'deny'} [unknownAuthor] cosa fare se l'autore di un file non è noto (default `deny`)
 * @property {{ group?: any, members?: any }} [baseline] configurazione fidata (prima del push), usata se la nuova è respinta
 */

/** Il percorso è un file di input che il ricalcolo conosce? Il resto (derived/, schemas/…) si ignora. */
const KNOWN = [
  [/^config\/group\.json$/, 'config/group'],
  [/^config\/members\.json$/, 'config/members'],
  [/^decks\/[^/]+\.json$/, 'deck'],
  [/^decks\/[^/]+\/v(\d+)\.json$/, 'deck-version'],
  [/^games\/\d{4}\/\d{2}\/[^/]+\.json$/, 'game'],
  [/^votes\/[^/]+\/[^/]+\.json$/, 'vote'],
  [/^requests\/[^/]+\.json$/, 'request'],
];

const fileId = (path) =>
  path
    .split('/')
    .pop()
    .replace(/\.json$/, '');

/**
 * @param {RecalcInput} input
 * @returns {{ derived: Record<string, unknown>, errors: Array<{ path: string, reason: string, author?: string }> }}
 */
export function runRecalc({ files, authors = {}, unknownAuthor = 'deny', baseline = {} }) {
  const errors = [];
  const reject = (path, reason) => errors.push({ path, reason, author: authors[path] ?? '' });

  /** @type {Map<string, { kind: string, path: string, json: any }>} */
  const valid = new Map();
  for (const path of Object.keys(files).sort()) {
    const match = KNOWN.find(([pattern]) => pattern.test(path));
    if (!match) continue;
    let json;
    try {
      json = JSON.parse(files[path]);
    } catch {
      reject(path, 'JSON non valido');
      continue;
    }
    // L'identificativo sta nel nome del file, non nel JSON (come fa il GitHubProvider).
    if (match[1] === 'deck' || match[1] === 'game' || match[1] === 'request') {
      json = { ...json, id: fileId(path) };
    }
    if (match[1] === 'deck-version') json = { ...json, version: Number(match[0].exec(path)[1]) };
    const check = validate(match[1], json);
    if (!check.valid) {
      reject(path, `Non rispetta lo schema: ${check.errors.join('; ')}`);
      continue;
    }
    valid.set(path, { kind: match[1], path, json });
  }

  // Configurazione: chi può modificarla? Si guarda l'elenco membri fidato (baseline) se c'è,
  // altrimenti quello appena letto.
  const group0 = valid.get('config/group.json')?.json;
  const members0 = valid.get('config/members.json')?.json;
  const testMode = group0?.testMode === true;
  const testOperators = new Set(group0?.testOperators ?? []);

  /** Chi ha davvero fatto la modifica, tenendo conto di `actingAs` (solo in modalità prova). */
  const actor = (path, json) => {
    const author = authors[path];
    if (author === undefined) return unknownAuthor === 'allow' ? null : undefined;
    if (testMode && json?.actingAs && testOperators.has(author)) return json.actingAs;
    return author;
  };

  const trustedMembers = baseline.members ?? members0 ?? {};
  const isAdmin = (login) => trustedMembers[login]?.role === 'admin';
  /** @returns {boolean} true se la modifica è ammessa */
  const allowedConfig = (path) => {
    const who = actor(path, null);
    if (who === null) return true;
    return who !== undefined && isAdmin(who);
  };

  let group = group0;
  if (group0 && !allowedConfig('config/group.json')) {
    reject(
      'config/group.json',
      'Modifica ignorata: solo gli admin possono cambiare la configurazione',
    );
    group = baseline.group;
  }
  let members = members0;
  if (members0 && !allowedConfig('config/members.json')) {
    reject('config/members.json', 'Modifica ignorata: solo gli admin possono cambiare i membri');
    members = baseline.members;
  } else if (
    members0 &&
    baseline.members &&
    !Object.values(members0).some((m) => m.role === 'admin')
  ) {
    reject('config/members.json', 'Modifica ignorata: deve restare almeno un admin');
    members = baseline.members;
  }
  const memberList = members ?? {};

  // Mazzi con l'ultima versione e il pavimento.
  const decks = [];
  const deckFiles = [...valid.values()].filter((f) => f.kind === 'deck');
  for (const { json: deck } of deckFiles) {
    const versionFile = valid.get(`decks/${deck.id}/v${deck.currentVersion}.json`);
    decks.push({
      ...deck,
      floor: versionFile?.json.floor ?? deck.floor ?? 'F1',
    });
  }

  // Partite: una chiusura (stato `ufficiale`) vale solo se la fa il registratore ed è completa.
  const winTypes = Object.keys(buildConfig(group ?? {}).params.modificatoriVittoria);
  const games = [];
  for (const { path, json: game } of [...valid.values()].filter((f) => f.kind === 'game')) {
    if (game.status === 'ufficiale') {
      const who = actor(path, game);
      if (who !== null && who !== game.recorderLogin) {
        reject(path, 'Chiusura ignorata: solo il registratore può chiudere la partita');
        continue;
      }
      const incomplete = incompleteClose(game, winTypes);
      if (incomplete) {
        reject(path, `Chiusura ignorata: ${incomplete}`);
        continue;
      }
    }
    games.push(game);
  }

  const result = recalculate(decks, games, group ?? {});
  const events = result.events;

  const deckSummaries = decks.map((deck) => {
    const derived = result.decks[deck.id];
    return {
      id: deck.id,
      name: deck.name,
      ownerLogin: deck.ownerLogin,
      commanders: deck.commanders,
      colorIdentity: deck.colorIdentity,
      declaredTier: deck.declaredTier,
      ...(deck.source ? { source: deck.source } : {}),
      ...(deck.tags?.length ? { tags: deck.tags } : {}),
      tier: derived.tier,
      stats: derived.stats,
    };
  });

  const standings = standingsOf(games, memberList);
  const stats = {
    officialGames: games.filter((g) => g.status === 'ufficiale').length,
    standings,
  };

  // Data dello snapshot ricavata dai dati (non dall'orologio): nessun commit se nulla è cambiato.
  const stamps = games.flatMap((g) => [g.endedAt, g.createdAt]).filter(Boolean);
  const updatedAt = stamps.length > 0 ? stamps.sort().at(-1) : '1970-01-01T00:00:00Z';

  const derived = {
    'derived/snapshot.json': {
      decks: deckSummaries,
      games: games.map((g) => ({ ...g })),
      standings,
      events,
      updatedAt,
      pending: false,
    },
    'derived/events.json': events,
    'derived/stats.json': stats,
    'derived/errors.json': errors,
  };
  for (const deck of deckSummaries) {
    derived[`derived/decks/${deck.id}.json`] = { tier: deck.tier, stats: deck.stats };
  }
  return { derived, errors };
}

/**
 * Una partita ufficiale senza vincitore, turno o con un tipo di vittoria sconosciuto farebbe
 * fallire il motore per tutti: si scarta prima. Restituisce il motivo, o `null` se è completa.
 * @param {any} game @param {string[]} winTypes
 */
function incompleteClose(game, winTypes) {
  if (!game.winners?.length && !game.winningTeam) return 'manca il vincitore';
  if (!Number.isInteger(game.winTurn) || game.winTurn < 1) return 'manca il turno di vittoria';
  if (!winTypes.includes(game.winType)) return 'manca il tipo di vittoria o non è noto';
  return null;
}

/** Classifica per giocatore: partite ufficiali giocate e vinte. Ordine stabile. */
function standingsOf(games, members) {
  const table = new Map();
  for (const game of games) {
    if (game.status !== 'ufficiale') continue;
    for (const p of game.players) {
      const row = table.get(p.login) ?? { login: p.login, games: 0, wins: 0 };
      row.games += 1;
      table.set(p.login, row);
    }
    for (const w of game.winners ?? []) {
      const row = table.get(w.login) ?? { login: w.login, games: 0, wins: 0 };
      row.wins += 1;
      table.set(w.login, row);
    }
  }
  return [...table.values()]
    .map((row) => ({ ...row, displayName: members[row.login]?.displayName ?? row.login }))
    .sort((a, b) => b.wins - a.wins || a.games - b.games || (a.login < b.login ? -1 : 1));
}

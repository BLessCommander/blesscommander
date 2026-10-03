// Schemi JSON dei file del repository dati (SPEC §6.4 e §6.6). Li usano l'app, il MockProvider
// e (da B-07) le Actions. Sono JSON Schema puro: la voce B-07 li scrive anche in `schemas/`.
import { ULID_PATTERN } from './ulid.js';

const str = { type: 'string', minLength: 1 };
const id = { type: 'string', pattern: ULID_PATTERN };
const date = { type: 'string', minLength: 10 };
const tier = { enum: ['F1', 'F2', 'F3', 'F4', 'F5'] };
const strings = { type: 'array', items: str };
const bool = { type: 'boolean' };
const count = { type: 'integer', minimum: 0 };
const role = { enum: ['admin', 'giocatore'] };
const source = { enum: ['archidekt', 'moxfield', 'text'] };
const object = (properties, required) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: true,
});

const player = object(
  {
    login: str,
    deckId: id,
    tierAtGame: tier,
    seat: { type: 'integer', minimum: 1 },
    team: str,
    role: str,
    eliminatedTurn: { type: 'integer', minimum: 1 },
    eliminatedBy: str,
  },
  ['login', 'deckId'],
);

/** @type {Record<string, object>} */
export const SCHEMAS = {
  'config/group': object(
    {
      name: str,
      settings: { type: 'object' },
      formats: { type: 'array', items: object({ id: str }, ['id']) },
      variants: { type: 'array' },
    },
    ['name', 'settings', 'formats'],
  ),
  'config/members': {
    type: 'object',
    additionalProperties: object(
      { displayName: str, avatarUrl: { type: 'string' }, role, joinedAt: date },
      ['displayName', 'role'],
    ),
  },
  deck: object(
    {
      id,
      ownerLogin: str,
      name: str,
      commanders: strings,
      colorIdentity: { type: 'array', items: { enum: ['W', 'U', 'B', 'R', 'G'] } },
      source: object({ type: source, url: { type: 'string' }, importedAt: date }, ['type']),
      currentVersion: count,
      declaredTier: tier,
      selfAssessment: object({ mld: bool, extraTurns: bool, notes: { type: 'string' } }, []),
    },
    ['id', 'ownerLogin', 'name', 'commanders', 'colorIdentity', 'currentVersion', 'declaredTier'],
  ),
  'deck-version': object(
    {
      version: { type: 'integer', minimum: 1 },
      cards: {
        type: 'array',
        items: object(
          { name: str, qty: { type: 'integer', minimum: 1 }, scryfallId: str, isGameChanger: bool },
          ['name', 'qty'],
        ),
      },
      gameChangers: strings,
      combos: { type: 'array' },
      flags: object({ mld: bool, extraTurns: bool }, []),
      floor: tier,
      diff: object({ added: strings, removed: strings }, []),
    },
    ['version', 'cards'],
  ),
  game: object(
    {
      id,
      formatId: str,
      variants: strings,
      recorderLogin: str,
      createdBy: str,
      status: { enum: ['lobby', 'in_corso', 'ufficiale', 'riaperta', 'annullata'] },
      createdAt: date,
      startedAt: date,
      endedAt: date,
      players: { type: 'array', items: player, minItems: 1 },
      winners: { type: 'array', items: object({ login: str, deckId: id }, ['login', 'deckId']) },
      winningTeam: str,
      winningRole: str,
      winTurn: { type: 'integer', minimum: 1 },
      turnSource: { enum: ['dado', 'stima'] },
      estimatedTurn: { type: 'integer', minimum: 1 },
      winType: str,
      notRepresentative: bool,
      notes: { type: 'string' },
      actingAs: str,
      revision: count,
    },
    ['id', 'formatId', 'recorderLogin', 'createdBy', 'status', 'createdAt', 'players', 'revision'],
  ),
  vote: object(
    {
      kind: { enum: ['riapertura', 'contestazione'] },
      value: bool,
      reason: { type: 'string' },
      createdAt: date,
    },
    ['kind', 'value', 'createdAt'],
  ),
  request: object(
    {
      id,
      source: { enum: ['archidekt', 'archidekt-user', 'moxfield', 'text', 'spellbook'] },
      url: { type: 'string' },
      requestedBy: str,
      status: { enum: ['pending', 'done', 'error'] },
      createdAt: date,
    },
    ['id', 'source', 'url', 'requestedBy', 'status', 'createdAt'],
  ),
  'derived/deck': object(
    {
      tier: object(
        {
          current: tier,
          floor: tier,
          speedTier: { enum: ['F1', 'F2', 'F3', 'F4', 'F5', null] },
          tmv: { type: ['number', 'null'] },
          dominance: { type: ['number', 'null'] },
          status: str,
          badges: strings,
          gamesSinceChange: count,
          lastChangeAt: date,
        },
        ['current'],
      ),
      stats: object({ games: count, wins: count, winTypes: { type: 'object' } }, ['games', 'wins']),
    },
    ['tier', 'stats'],
  ),
  'derived/events': {
    type: 'array',
    items: object(
      {
        id: str,
        deckId: id,
        gameId: id,
        from: tier,
        to: tier,
        reasons: strings,
        metricsSnapshot: { type: 'object' },
        createdAt: date,
        cancelled: bool,
      },
      ['id', 'deckId', 'gameId', 'from', 'to', 'reasons', 'createdAt'],
    ),
  },
  'derived/snapshot': object(
    {
      decks: { type: 'array' },
      games: { type: 'array' },
      standings: { type: 'array' },
      updatedAt: date,
      pending: bool,
    },
    ['decks', 'games', 'standings', 'updatedAt'],
  ),
  'derived/notifications': object(
    {
      items: {
        type: 'array',
        items: object(
          { id: str, type: str, createdAt: date, params: { type: 'object' }, actions: bool },
          ['id', 'type', 'createdAt'],
        ),
      },
    },
    ['items'],
  ),
  'user/notifications': object(
    {
      readIds: strings,
      answers: {
        type: 'object',
        additionalProperties: { enum: ['yes', 'no'] },
      },
    },
    ['readIds', 'answers'],
  ),
  'derived/errors': {
    type: 'array',
    items: object({ path: str, reason: str, author: { type: 'string' } }, ['path', 'reason']),
  },
};

// Corrispondenza tra i file del repository dati (SPEC §6.4) e i documenti Firestore (SPEC §6.10).
// Funzioni pure: servono al provider, allo script di migrazione e al ricalcolo.

/**
 * @typedef {{ segments: string[], kind: 'doc' }} DocTarget
 * @typedef {{ segments: string[], kind: 'member' }} MemberTarget
 */

/** Il percorso di un file di input → i segmenti del documento (dentro `groups/<groupId>`). */
const INPUT_RULES = [
  [/^config\/group\.json$/, () => ['config', 'group']],
  [/^decks\/([^/]+)\.json$/, (m) => ['decks', m[1]]],
  [/^decks\/([^/]+)\/(v\d+)\.json$/, (m) => ['decks', m[1], 'versions', m[2]]],
  [/^games\/\d{4}\/\d{2}\/([^/]+)\.json$/, (m) => ['games', m[1]]],
  [/^votes\/([^/]+)\/([^/]+)\.json$/, (m) => ['votes', `${m[1]}__${m[2]}`]],
  [/^requests\/([^/]+)\.json$/, (m) => ['requests', m[1]]],
  [/^users\/([^/]+)\/notifications\.json$/, (m) => ['userState', m[1]]],
  [/^derived\/decks\/([^/]+)\.json$/, (m) => ['derived', `deck__${m[1]}`]],
  [/^derived\/notifications\/([^/]+)\.json$/, (m) => ['derived', `notifications__${m[1]}`]],
  [/^derived\/([^/]+)\.json$/, (m) => ['derived', m[1]]],
];

/**
 * @param {string} path percorso del file, come nel repository dati
 * @returns {string[] | null} segmenti del documento sotto `groups/<groupId>`, o null se non è un file noto.
 *   `config/members.json` non ha un documento solo: ogni membro è un documento di `members`.
 */
export function docSegments(path) {
  for (const [pattern, build] of INPUT_RULES) {
    const match = pattern.exec(path);
    if (match) return build(match);
  }
  return null;
}

/** Percorso del documento di una partita come file (serve al ricalcolo, che legge l'anno e il mese). */
export function gameFilePath(id, createdAt) {
  return `games/${createdAt.slice(0, 4)}/${createdAt.slice(5, 7)}/${id}.json`;
}

/**
 * Operazione inversa: documento → percorso del file. Per le partite serve `createdAt` dal documento.
 * @param {string[]} segments segmenti sotto `groups/<groupId>`
 * @param {any} data contenuto del documento
 * @returns {string | null}
 */
export function filePath(segments, data) {
  const [collection, id, sub, subId] = segments;
  if (collection === 'config' && id === 'group') return 'config/group.json';
  if (collection === 'decks' && segments.length === 2) return `decks/${id}.json`;
  if (collection === 'decks' && sub === 'versions') return `decks/${id}/${subId}.json`;
  if (collection === 'games' && data?.createdAt) return gameFilePath(id, data.createdAt);
  if (collection === 'votes') {
    const [target, login] = id.split('__');
    return `votes/${target}/${login}.json`;
  }
  if (collection === 'requests') return `requests/${id}.json`;
  if (collection === 'userState') return `users/${id}/notifications.json`;
  if (collection === 'derived') {
    if (id.startsWith('deck__')) return `derived/decks/${id.slice(6)}.json`;
    if (id.startsWith('notifications__')) return `derived/notifications/${id.slice(15)}.json`;
    return `derived/${id}.json`;
  }
  return null;
}

/** Nei file l'identificativo è il nome del file: non si ripete nel contenuto (come nel GitHubProvider). */
export function withoutId(doc) {
  const rest = { ...doc };
  delete rest.id;
  return rest;
}

/**
 * Firestore non ammette array dentro array e non accetta `undefined`. I dati dell'app non
 * hanno `undefined`; gli array annidati si salvano come testo JSON in un campo marcato.
 */
const NESTED = '__json';

export function encodeForStore(value) {
  if (Array.isArray(value)) {
    return value.map((item) =>
      Array.isArray(item) ? { [NESTED]: JSON.stringify(item) } : encodeForStore(item),
    );
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeForStore(v)]));
  }
  return value;
}

export function decodeFromStore(value) {
  if (Array.isArray(value)) return value.map(decodeFromStore);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === NESTED) return JSON.parse(value[NESTED]);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeFromStore(v)]));
  }
  return value;
}

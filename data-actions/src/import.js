// Action `import` (SPEC §6.8): scarica i mazzi richiesti in `requests/` e scrive l'esito nella
// richiesta stessa. Il mazzo torna come testo con le sezioni, così l'app usa lo stesso parser e la
// stessa anteprima dell'import da testo. Non scrive mai in `derived/`.
import {
  archidektToText,
  downloadDeck,
  downloadUserDecks,
} from '../../web/src/domain/archidekt-import.js';
import { archidektDeckId } from '../../web/src/domain/archidekt-link.js';

export { archidektDeckId, archidektToText };

const failure = (request, error) => ({ ...request, status: 'error', error });

/**
 * @param {object} input
 * @param {Record<string, string>} input.files file `requests/*.json` e `config/members.json`
 * @param {Record<string, string>} [input.authors] percorso → login dell'ultimo commit
 * @param {'allow'|'deny'} [input.unknownAuthor] autore ignoto: `deny` nell'Action vera
 * @param {typeof fetch} [input.fetchImpl]
 * @returns {Promise<Record<string, object>>} richieste aggiornate, per percorso (solo quelle cambiate)
 */
export async function runImport({
  files,
  authors = {},
  unknownAuthor = 'deny',
  fetchImpl = (...a) => fetch(...a),
}) {
  let members = {};
  try {
    members = JSON.parse(files['config/members.json'] ?? '{}');
  } catch {
    members = {};
  }
  const updates = {};
  for (const path of Object.keys(files).sort()) {
    if (!/^requests\/[^/]+\.json$/.test(path)) continue;
    let request;
    try {
      request = JSON.parse(files[path]);
    } catch {
      continue;
    }
    if (request.status !== 'pending') continue;

    const author = authors[path];
    const known = author === undefined ? unknownAuthor === 'allow' : author in members;
    if (!known) {
      updates[path] = failure(request, 'Richiesta ignorata: chi l’ha fatta non è un membro');
      continue;
    }
    if (request.source === 'archidekt-user') {
      const result = await downloadUserDecks({ nick: request.url, fetchImpl });
      updates[path] = result.error
        ? failure(request, result.error)
        : { ...request, status: 'done', ...result };
    } else if (request.source === 'archidekt') {
      const result = await downloadDeck({ url: request.url, fetchImpl });
      updates[path] = result.error
        ? failure(request, result.error)
        : { ...request, status: 'done', ...result };
    } else {
      updates[path] = failure(
        request,
        'Per ora l’import da questo sito non è disponibile: incolla la lista come testo',
      );
    }
  }
  return updates;
}

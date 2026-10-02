import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * Finta API GitHub per i test (docs/PIANO-Test.md §1).
 * Implementa solo ciò che usa l'app: utente, lettura e scrittura dei contenuti,
 * richieste condizionali (ETag → 304) e conflitti di versione (sha).
 * Legge e scrive una cartella con la struttura del repository dati.
 * Gli utenti sono membri finti (SPEC §6.7): il token è `token-<login>`.
 */

/** @typedef {{ author: string, path: string, message: string, sha: string }} FakeCommit */

/** sha di un file come lo calcola Git (blob). */
export function blobSha(buffer) {
  return createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
}

/** Token del membro finto con quel login. */
export const tokenFor = (login) => `token-${login}`;

/**
 * @param {object} options
 * @param {string} options.dataDir cartella del repository dati finto
 * @param {string[]} options.logins login dei membri finti ammessi
 * @param {string} [options.owner] organizzazione finta
 * @param {string} [options.repo] repository finto
 * @param {number} [options.port] porta (0 = una libera)
 * @param {(commit: FakeCommit, dataDir: string) => Promise<void>} [options.onWrite]
 *   chiamata dopo ogni scrittura: qui si può simulare l'Action di ricalcolo
 */
export async function startFakeGithub({
  dataDir,
  logins,
  owner = 'BLessCommander',
  repo = 'blesscommander-data-test',
  port: wantedPort = 0,
  onWrite,
}) {
  const root = resolve(dataDir);
  /** @type {FakeCommit[]} */
  const commits = [];
  const stats = { requests: 0, notModified: 0, conflicts: 0 };
  const prefix = `/repos/${owner}/${repo}/contents/`;

  const safePath = (rel) => {
    const full = resolve(root, rel);
    if (full !== root && !full.startsWith(root + sep)) return null;
    return full;
  };

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'ETag',
      ...headers,
    });
    res.end(status === 304 || body === undefined ? undefined : JSON.stringify(body));
  };

  const readBody = (req) =>
    new Promise((ok, ko) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
      req.on('error', ko);
    });

  const authenticate = (req) => {
    const match = /^(?:Bearer|token) (.+)$/.exec(req.headers.authorization ?? '');
    if (!match) return null;
    const login = logins.find((l) => tokenFor(l) === match[1]);
    return login ? { login } : null;
  };

  async function handleGet(req, res, rel) {
    const full = safePath(rel);
    if (!full) return send(res, 404, { message: 'Not Found' });
    let info;
    try {
      info = await stat(full);
    } catch {
      return send(res, 404, { message: 'Not Found' });
    }
    let body;
    let etag;
    if (info.isDirectory()) {
      const names = (await readdir(full)).sort();
      body = [];
      for (const name of names) {
        const childRel = rel ? `${rel}/${name}` : name;
        const childStat = await stat(join(full, name));
        const isDir = childStat.isDirectory();
        body.push({
          name,
          path: childRel,
          type: isDir ? 'dir' : 'file',
          size: isDir ? 0 : childStat.size,
          sha: isDir ? null : blobSha(await readFile(join(full, name))),
        });
      }
      etag = `"${createHash('sha1').update(JSON.stringify(body)).digest('hex')}"`;
    } else {
      const content = await readFile(full);
      const sha = blobSha(content);
      body = {
        type: 'file',
        name: rel.split('/').pop(),
        path: rel,
        sha,
        size: content.length,
        encoding: 'base64',
        content: content.toString('base64'),
      };
      etag = `"${sha}"`;
    }
    if (req.headers['if-none-match'] === etag) {
      stats.notModified += 1;
      return send(res, 304, undefined, { ETag: etag });
    }
    return send(res, 200, body, { ETag: etag });
  }

  async function handlePut(req, res, rel, user) {
    const full = safePath(rel);
    if (!full || full === root) return send(res, 404, { message: 'Not Found' });
    let input;
    try {
      input = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { message: 'Problems parsing JSON' });
    }
    if (typeof input.content !== 'string' || typeof input.message !== 'string') {
      return send(res, 422, { message: 'Invalid request: content e message sono obbligatori' });
    }
    let currentSha = null;
    try {
      currentSha = blobSha(await readFile(full));
    } catch {
      // il file non esiste: sarà creato
    }
    if (currentSha && !input.sha) {
      return send(res, 422, { message: 'Invalid request: "sha" was not supplied.' });
    }
    if (currentSha && input.sha !== currentSha) {
      stats.conflicts += 1;
      return send(res, 409, { message: `${rel} does not match ${input.sha}` });
    }
    const buffer = Buffer.from(input.content, 'base64');
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, buffer);
    const sha = blobSha(buffer);
    const commit = { author: user.login, path: rel, message: input.message, sha };
    commits.push(commit);
    if (onWrite) await onWrite(commit, root);
    return send(res, currentSha ? 200 : 201, {
      content: { name: rel.split('/').pop(), path: rel, sha },
      commit: { sha, author: { name: user.login }, message: input.message },
    });
  }

  async function handleDelete(req, res, rel, user) {
    const full = safePath(rel);
    if (!full || full === root) return send(res, 404, { message: 'Not Found' });
    const input = JSON.parse((await readBody(req)) || '{}');
    let currentSha;
    try {
      currentSha = blobSha(await readFile(full));
    } catch {
      return send(res, 404, { message: 'Not Found' });
    }
    if (input.sha !== currentSha) {
      stats.conflicts += 1;
      return send(res, 409, { message: `${rel} does not match ${input.sha}` });
    }
    await rm(full);
    const commit = { author: user.login, path: rel, message: input.message ?? '', sha: currentSha };
    commits.push(commit);
    if (onWrite) await onWrite(commit, root);
    return send(res, 200, { commit: { sha: currentSha, message: commit.message } });
  }

  const server = createServer(async (req, res) => {
    stats.requests += 1;
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, If-None-Match, Content-Type, Accept',
          'Access-Control-Max-Age': '600',
        });
        return res.end();
      }
      const user = authenticate(req);
      if (!user) return send(res, 401, { message: 'Bad credentials' });
      const url = new URL(req.url, 'http://fake');
      if (url.pathname === '/user' && req.method === 'GET') {
        return send(res, 200, {
          login: user.login,
          avatar_url: `https://avatars.invalid/${user.login}.png`,
        });
      }
      if (url.pathname.startsWith(prefix)) {
        const rel = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/\/+$/, '');
        if (req.method === 'GET') return await handleGet(req, res, rel);
        if (req.method === 'PUT') return await handlePut(req, res, rel, user);
        if (req.method === 'DELETE') return await handleDelete(req, res, rel, user);
      }
      return send(res, 404, { message: 'Not Found' });
    } catch (error) {
      return send(res, 500, { message: String(error?.message ?? error) });
    }
  });

  await new Promise((ok) => server.listen(wantedPort, '127.0.0.1', ok));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    owner,
    repo,
    commits,
    stats,
    close: () => new Promise((ok) => server.close(ok)),
  };
}

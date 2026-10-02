import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGINS, writeSeed } from '../seed/seed.js';
import { startFakeGithub, tokenFor } from './server.js';

let dir;
let fake;
const base = () => `${fake.url}/repos/${fake.owner}/${fake.repo}/contents`;
const auth = (login = 'test-owner') => ({ Authorization: `Bearer ${tokenFor(login)}` });
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fake-gh-'));
  await writeSeed(dir);
  fake = await startFakeGithub({ dataDir: dir, logins: LOGINS });
});
afterAll(async () => {
  await fake.close();
  await rm(dir, { recursive: true, force: true });
});

describe('finta API GitHub', () => {
  it('rifiuta richieste senza token valido', async () => {
    expect((await fetch(`${fake.url}/user`)).status).toBe(401);
    expect(
      (await fetch(`${fake.url}/user`, { headers: { Authorization: 'Bearer sbagliato' } })).status,
    ).toBe(401);
  });

  it('GET /user restituisce il login del membro finto', async () => {
    const res = await fetch(`${fake.url}/user`, { headers: auth('test-giocatore2') });
    expect((await res.json()).login).toBe('test-giocatore2');
  });

  it('legge un file in base64 con sha e ETag', async () => {
    const res = await fetch(`${base()}/config/members.json`, { headers: auth() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.encoding).toBe('base64');
    expect(Object.keys(JSON.parse(Buffer.from(body.content, 'base64')))).toEqual(LOGINS);
    expect(res.headers.get('etag')).toBe(`"${body.sha}"`);
  });

  it('risponde 304 alla richiesta condizionale se il file non è cambiato', async () => {
    const first = await fetch(`${base()}/derived/snapshot.json`, { headers: auth() });
    const etag = first.headers.get('etag');
    const second = await fetch(`${base()}/derived/snapshot.json`, {
      headers: { ...auth(), 'If-None-Match': etag },
    });
    expect(second.status).toBe(304);
    expect(fake.stats.notModified).toBeGreaterThan(0);
  });

  it('elenca il contenuto di una cartella', async () => {
    const res = await fetch(`${base()}/config`, { headers: auth() });
    const list = await res.json();
    expect(list.map((f) => f.name)).toEqual(['group.json', 'members.json']);
  });

  it('404 per file inesistenti e per percorsi che escono dalla cartella', async () => {
    expect((await fetch(`${base()}/non/esiste.json`, { headers: auth() })).status).toBe(404);
    expect((await fetch(`${base()}/%2e%2e/%2e%2e/package.json`, { headers: auth() })).status).toBe(
      404,
    );
  });

  it('crea un file nuovo (201), lo scrive su disco e registra il commit con l’autore', async () => {
    const res = await fetch(`${base()}/votes/abc/test-admin.json`, {
      method: 'PUT',
      headers: auth('test-admin'),
      body: JSON.stringify({ message: 'voto', content: b64({ value: true }) }),
    });
    expect(res.status).toBe(201);
    expect(JSON.parse(await readFile(join(dir, 'votes/abc/test-admin.json'), 'utf8'))).toEqual({
      value: true,
    });
    expect(fake.commits.at(-1)).toMatchObject({
      author: 'test-admin',
      path: 'votes/abc/test-admin.json',
    });
  });

  it('aggiorna con lo sha giusto, rifiuta senza sha (422) e con sha vecchio (409)', async () => {
    const path = `${base()}/config/group.json`;
    const current = await (await fetch(path, { headers: auth() })).json();
    const put = (sha) =>
      fetch(path, {
        method: 'PUT',
        headers: auth(),
        body: JSON.stringify({ message: 'm', content: b64({ n: 1 }), sha }),
      });

    expect((await put(undefined)).status).toBe(422);
    expect((await put('0000')).status).toBe(409);
    expect(fake.stats.conflicts).toBeGreaterThan(0);
    const ok = await put(current.sha);
    expect(ok.status).toBe(200);
    // lo sha è cambiato: ripetere con quello vecchio ora è un conflitto
    expect((await put(current.sha)).status).toBe(409);
  });

  it('cancella un file con lo sha giusto', async () => {
    const path = `${base()}/votes/abc/test-admin.json`;
    const current = await (await fetch(path, { headers: auth() })).json();
    const wrong = await fetch(path, {
      method: 'DELETE',
      headers: auth(),
      body: JSON.stringify({ message: 'x', sha: 'sbagliato' }),
    });
    expect(wrong.status).toBe(409);
    const ok = await fetch(path, {
      method: 'DELETE',
      headers: auth(),
      body: JSON.stringify({ message: 'x', sha: current.sha }),
    });
    expect(ok.status).toBe(200);
    expect((await fetch(path, { headers: auth() })).status).toBe(404);
  });

  it('chiama onWrite dopo ogni scrittura (gancio per il ricalcolo)', async () => {
    const seen = [];
    const other = await mkdtemp(join(tmpdir(), 'fake-gh-hook-'));
    const hooked = await startFakeGithub({
      dataDir: other,
      logins: LOGINS,
      onWrite: async (commit) => {
        seen.push(commit.path);
      },
    });
    try {
      await fetch(`${hooked.url}/repos/${hooked.owner}/${hooked.repo}/contents/a.json`, {
        method: 'PUT',
        headers: auth(),
        body: JSON.stringify({ message: 'm', content: b64({}) }),
      });
      expect(seen).toEqual(['a.json']);
    } finally {
      await hooked.close();
      await rm(other, { recursive: true, force: true });
    }
  });

  it('risponde alle richieste CORS preliminari del browser', async () => {
    const res = await fetch(`${base()}/config/group.json`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain('If-None-Match');
  });
});

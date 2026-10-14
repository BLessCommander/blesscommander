import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { doc, getDoc } from 'firebase/firestore';
import { GroupsService, generateInviteCode, normalizeInviteCode } from './groups-service.js';

describe('UT-GROUPS codici di invito', () => {
  it('il codice usa solo caratteri leggibili e ha la lunghezza giusta', () => {
    const code = generateInviteCode(() => Uint8Array.from([0, 1, 2, 3, 250, 251, 252, 253]));
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]+$/);
  });

  it('il codice digitato si normalizza', () => {
    expect(normalizeInviteCode(' ab3-k 9x2 ')).toBe('AB3K9X2');
    expect(normalizeInviteCode(null)).toBe('');
  });
});

// Servono gli emulatori: `npm run test:firebase`. Con le regole vere, non aperte.
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!emulator)('UT-GROUPS gruppi dell’account (E-04a)', () => {
  let env;
  const service = (uid, extra = {}) =>
    new GroupsService({
      db: env.authenticatedContext(uid).firestore(),
      now: () => '2026-10-14T10:00:00Z',
      ...extra,
    });

  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-blesscommander-groups',
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      },
    });
  });
  afterAll(async () => {
    await env?.cleanup();
  });
  beforeEach(async () => {
    await env.clearFirestore();
  });

  it('chi crea un gruppo ne è l’admin e lo ritrova nell’elenco', async () => {
    const anna = service('anna', { newId: () => 'g1', newCode: () => 'ABCD2345' });
    const created = await anna.createGroup('anna', { groupName: 'Venerdì', displayName: 'Anna' });
    expect(created).toEqual({ id: 'g1', name: 'Venerdì', role: 'admin', inviteCode: 'ABCD2345' });
    expect(await anna.listMyGroups('anna')).toEqual([{ id: 'g1', name: 'Venerdì', role: 'admin' }]);
  });

  it('con il codice si entra come giocatore e si vede il gruppo', async () => {
    await service('anna', { newId: () => 'g1', newCode: () => 'ABCD2345' }).createGroup('anna', {
      groupName: 'Venerdì',
      displayName: 'Anna',
    });
    const bruno = service('bruno');
    const joined = await bruno.joinGroup('bruno', 'abcd-2345', { displayName: 'Bruno' });
    expect(joined).toEqual({ id: 'g1', name: 'Venerdì', role: 'giocatore' });
    expect(await bruno.listMyGroups('bruno')).toEqual([joined]);
    const db = env.authenticatedContext('bruno').firestore();
    expect((await getDoc(doc(db, 'groups', 'g1', 'members', 'anna'))).exists()).toBe(true);
  });

  it('un codice sconosciuto non fa entrare', async () => {
    await expect(
      service('bruno').joinGroup('bruno', 'NONESISTE', { displayName: 'Bruno' }),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('i campi obbligatori vengono controllati prima di scrivere', async () => {
    await expect(
      service('anna').createGroup('anna', { groupName: ' ', displayName: 'Anna' }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});

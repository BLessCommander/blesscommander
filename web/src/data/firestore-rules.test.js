import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { doc, deleteDoc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

// Servono gli emulatori: `npm run test:firebase`. Senza, queste prove si saltano.
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const G = 'g1';
const MEMBERS = { anna: 'admin', bruno: 'giocatore', carla: 'giocatore', dario: 'giocatore' };

let env;
const as = (uid) => env.authenticatedContext(uid).firestore();
const path = (...segments) => ['groups', G, ...segments];
const ref = (db, ...segments) => doc(db, ...path(...segments));

const game = (over = {}) => ({
  recorderLogin: 'bruno',
  createdBy: 'bruno',
  status: 'in_corso',
  players: [],
  revision: 0,
  createdAt: '2026-03-01T10:00:00Z',
  ...over,
});
const proposal = (over = {}) => ({
  proposalId: 'P1',
  candidateId: 'bruno',
  proposedBy: 'carla',
  status: 'open',
  ...over,
});

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'groups', G), { adminId: 'anna', visibility: 'private' });
    await setDoc(ref(db, 'config', 'group'), { name: 'Gruppo' });
    for (const [id, role] of Object.entries(MEMBERS)) {
      await setDoc(ref(db, 'members', id), { displayName: id, role });
      await setDoc(ref(db, 'memberByUid', id), { memberId: id });
    }
    await setDoc(ref(db, 'decks', 'd-bruno'), { ownerLogin: 'bruno', currentVersion: 0 });
    await setDoc(ref(db, 'games', 'g-open'), game());
    await setDoc(ref(db, 'games', 'g-done'), game({ status: 'ufficiale' }));
    await setDoc(ref(db, 'derived', 'snapshot'), { items: [] });
    await setDoc(ref(db, 'derived', 'notifications__bruno'), { items: [] });
  });
}

describe.skipIf(!emulator)('UT-RULES regole di Firestore (E-02b)', () => {
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    env = await initializeTestEnvironment({
      // Progetto a parte: il test del provider usa lo stesso emulatore e non va cancellato.
      projectId: 'demo-blesscommander-rules',
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
  beforeEach(seed);

  describe('accesso', () => {
    it('chi non ha fatto l’accesso o non è membro non legge nulla', async () => {
      await assertFails(getDoc(ref(env.unauthenticatedContext().firestore(), 'decks', 'd-bruno')));
      await assertFails(getDoc(ref(as('estraneo'), 'decks', 'd-bruno')));
      await assertFails(getDoc(ref(as('estraneo'), 'derived', 'snapshot')));
    });

    it('un membro legge i dati del gruppo', async () => {
      await assertSucceeds(getDoc(ref(as('carla'), 'decks', 'd-bruno')));
      await assertSucceeds(getDoc(ref(as('carla'), 'derived', 'snapshot')));
    });

    it('le notifiche sono personali', async () => {
      await assertSucceeds(getDoc(ref(as('bruno'), 'derived', 'notifications__bruno')));
      await assertFails(getDoc(ref(as('carla'), 'derived', 'notifications__bruno')));
    });

    it('si crea un gruppo e si diventa admin, ma non si entra in un gruppo altrui', async () => {
      const db = as('nuovo');
      const batch = writeBatch(db);
      batch.set(doc(db, 'groups', 'g2'), { adminId: 'nuovo', visibility: 'private' });
      batch.set(doc(db, 'groups', 'g2', 'members', 'nuovo'), { displayName: 'N', role: 'admin' });
      batch.set(doc(db, 'groups', 'g2', 'memberByUid', 'nuovo'), { memberId: 'nuovo' });
      await assertSucceeds(batch.commit());

      const intruder = as('intruso');
      await assertFails(setDoc(ref(intruder, 'memberByUid', 'intruso'), { memberId: 'intruso' }));
      await assertFails(
        setDoc(ref(intruder, 'members', 'intruso'), { displayName: 'I', role: 'admin' }),
      );
    });
  });

  describe('gruppi e codice di invito (E-04a)', () => {
    const createGroup = async (uid, g, code) => {
      const db = as(uid);
      const batch = writeBatch(db);
      batch.set(doc(db, 'groups', g), { adminId: uid, visibility: 'private', inviteCode: code });
      batch.set(doc(db, 'groups', g, 'members', uid), { displayName: uid, role: 'admin' });
      batch.set(doc(db, 'groups', g, 'memberByUid', uid), { memberId: uid });
      batch.set(doc(db, 'inviteCodes', code), { groupId: g });
      await batch.commit();
    };
    const join = (uid, g, code, role = 'giocatore') => {
      const db = as(uid);
      const batch = writeBatch(db);
      batch.set(doc(db, 'groups', g, 'members', uid), {
        displayName: uid,
        role,
        inviteCode: code,
      });
      batch.set(doc(db, 'groups', g, 'memberByUid', uid), { memberId: uid });
      return batch.commit();
    };

    it('chi crea un gruppo pubblica anche il codice, e solo per il proprio gruppo', async () => {
      await assertSucceeds(createGroup('nuovo', 'g2', 'ABC123'));
      const db = as('altro');
      await assertFails(setDoc(doc(db, 'inviteCodes', 'ZZZ999'), { groupId: 'g2' }));
    });

    it('un codice si legge uno alla volta, mai l’elenco', async () => {
      await createGroup('nuovo', 'g2', 'ABC123');
      await assertSucceeds(getDoc(doc(as('estraneo'), 'inviteCodes', 'ABC123')));
      await assertFails(
        getDoc(doc(env.unauthenticatedContext().firestore(), 'inviteCodes', 'ABC123')),
      );
    });

    it('con il codice giusto si entra come giocatore', async () => {
      await createGroup('nuovo', 'g2', 'ABC123');
      await assertSucceeds(join('estraneo', 'g2', 'ABC123'));
      await assertSucceeds(getDoc(doc(as('estraneo'), 'groups', 'g2', 'members', 'nuovo')));
    });

    it('con un codice sbagliato, o chiedendo di essere admin, si resta fuori', async () => {
      await createGroup('nuovo', 'g2', 'ABC123');
      await assertFails(join('estraneo', 'g2', 'SBAGLIATO'));
      await assertFails(join('estraneo', 'g2', 'ABC123', 'admin'));
    });

    it('il profilo personale lo legge e lo scrive solo l’utente', async () => {
      await assertSucceeds(setDoc(doc(as('anna'), 'users', 'anna'), { displayName: 'Anna' }));
      await assertFails(getDoc(doc(as('bruno'), 'users', 'anna')));
    });
  });

  describe('dati derivati e configurazione', () => {
    it('derived/ non si scrive dal client, nemmeno da un admin', async () => {
      await assertFails(setDoc(ref(as('anna'), 'derived', 'snapshot'), { items: [1] }));
      await assertFails(deleteDoc(ref(as('anna'), 'derived', 'snapshot')));
    });

    it('la configurazione la scrive solo un admin', async () => {
      await assertSucceeds(setDoc(ref(as('anna'), 'config', 'group'), { name: 'Nuovo' }));
      await assertFails(setDoc(ref(as('bruno'), 'config', 'group'), { name: 'Nuovo' }));
    });
  });

  describe('mazzi', () => {
    it('lo modifica il proprietario o un admin, non gli altri', async () => {
      const patch = { currentVersion: 1 };
      await assertSucceeds(updateDoc(ref(as('bruno'), 'decks', 'd-bruno'), patch));
      await assertSucceeds(updateDoc(ref(as('anna'), 'decks', 'd-bruno'), patch));
      await assertFails(updateDoc(ref(as('carla'), 'decks', 'd-bruno'), patch));
    });

    it('un mazzo si crea solo a proprio nome', async () => {
      await assertSucceeds(setDoc(ref(as('carla'), 'decks', 'd-c'), { ownerLogin: 'carla' }));
      await assertFails(setDoc(ref(as('carla'), 'decks', 'd-x'), { ownerLogin: 'bruno' }));
    });

    it('le versioni le aggiunge il proprietario', async () => {
      await assertSucceeds(
        setDoc(ref(as('bruno'), 'decks', 'd-bruno', 'versions', 'v1'), { a: 1 }),
      );
      await assertFails(setDoc(ref(as('carla'), 'decks', 'd-bruno', 'versions', 'v1'), { a: 1 }));
    });
  });

  describe('partite', () => {
    it('si crea solo come registratore e solo aperta', async () => {
      await assertSucceeds(
        setDoc(
          ref(as('carla'), 'games', 'n1'),
          game({ recorderLogin: 'carla', createdBy: 'carla' }),
        ),
      );
      await assertFails(setDoc(ref(as('carla'), 'games', 'n2'), game()));
      await assertFails(
        setDoc(
          ref(as('carla'), 'games', 'n3'),
          game({ recorderLogin: 'carla', createdBy: 'carla', status: 'ufficiale' }),
        ),
      );
    });

    it('la chiude solo il registratore', async () => {
      await assertFails(updateDoc(ref(as('carla'), 'games', 'g-open'), { status: 'ufficiale' }));
      await assertFails(updateDoc(ref(as('anna'), 'games', 'g-open'), { status: 'ufficiale' }));
      await assertSucceeds(updateDoc(ref(as('bruno'), 'games', 'g-open'), { status: 'ufficiale' }));
    });

    it('il registratore non cede il ruolo né riapre da solo', async () => {
      await assertFails(updateDoc(ref(as('bruno'), 'games', 'g-open'), { recorderLogin: 'carla' }));
      await assertFails(updateDoc(ref(as('bruno'), 'games', 'g-done'), { status: 'riaperta' }));
      await assertFails(updateDoc(ref(as('bruno'), 'games', 'g-done'), { note: 'x' }));
      await assertFails(updateDoc(ref(as('anna'), 'games', 'g-done'), { status: 'riaperta' }));
    });

    it('i voti li scrive ognuno per sé', async () => {
      await assertSucceeds(setDoc(ref(as('carla'), 'votes', 'g-done__carla'), { value: true }));
      await assertFails(setDoc(ref(as('carla'), 'votes', 'g-done__dario'), { value: true }));
    });
  });

  describe('membri e ruoli', () => {
    it('solo l’admin del gruppo dà il ruolo admin', async () => {
      await assertSucceeds(updateDoc(ref(as('anna'), 'members', 'carla'), { role: 'admin' }));
      await assertFails(updateDoc(ref(as('bruno'), 'members', 'carla'), { role: 'admin' }));
      await assertFails(updateDoc(ref(as('dario'), 'members', 'dario'), { role: 'admin' }));
    });

    it('un co-admin non toglie né cambia l’admin del gruppo', async () => {
      await assertSucceeds(updateDoc(ref(as('anna'), 'members', 'bruno'), { role: 'admin' }));
      await assertFails(updateDoc(ref(as('bruno'), 'members', 'anna'), { role: 'giocatore' }));
      await assertFails(deleteDoc(ref(as('bruno'), 'members', 'anna')));
    });

    it('adminId non si cambia dal client', async () => {
      await assertFails(updateDoc(doc(as('anna'), 'groups', G), { adminId: 'bruno' }));
      await assertFails(updateDoc(doc(as('bruno'), 'groups', G), { adminId: 'bruno' }));
      await assertSucceeds(updateDoc(doc(as('anna'), 'groups', G), { description: 'ok' }));
    });

    it('un membro aggiorna il proprio profilo ma non il ruolo', async () => {
      await assertSucceeds(updateDoc(ref(as('carla'), 'members', 'carla'), { displayName: 'C' }));
      await assertFails(updateDoc(ref(as('carla'), 'members', 'dario'), { displayName: 'D' }));
    });
  });

  describe('cambio di admin (UC-64)', () => {
    const propose = (uid, data) => setDoc(ref(as(uid), 'adminProposals', 'current'), data);
    const open = () =>
      env.withSecurityRulesDisabled((ctx) =>
        setDoc(ref(ctx.firestore(), 'adminProposals', 'current'), proposal()),
      );

    it('un giocatore propone un altro membro', async () => {
      await assertSucceeds(propose('carla', proposal()));
    });

    it('l’admin, un estraneo o chi propone se stesso non possono proporre', async () => {
      await assertFails(propose('anna', proposal({ proposedBy: 'anna' })));
      await assertFails(propose('estraneo', proposal({ proposedBy: 'estraneo' })));
      await assertFails(propose('carla', proposal({ candidateId: 'carla' })));
      await assertFails(propose('carla', proposal({ candidateId: 'anna' })));
      await assertFails(propose('carla', proposal({ candidateId: 'zeno' })));
      await assertFails(propose('carla', proposal({ proposedBy: 'dario' })));
    });

    it('c’è una sola proposta aperta alla volta', async () => {
      await open();
      await assertFails(propose('dario', proposal({ proposedBy: 'dario', candidateId: 'carla' })));
    });

    it('chi l’ha fatta può annullarla, gli altri no', async () => {
      await open();
      await assertFails(
        updateDoc(ref(as('dario'), 'adminProposals', 'current'), { status: 'cancelled' }),
      );
      await assertFails(
        updateDoc(ref(as('carla'), 'adminProposals', 'current'), { candidateId: 'dario' }),
      );
      await assertSucceeds(
        updateDoc(ref(as('carla'), 'adminProposals', 'current'), { status: 'cancelled' }),
      );
      await assertSucceeds(
        propose('dario', proposal({ proposalId: 'P2', proposedBy: 'dario', candidateId: 'carla' })),
      );
    });

    it('votano gli altri giocatori, non l’admin, non il candidato, non chi ha proposto', async () => {
      await open();
      const vote = { proposalId: 'P1', value: true };
      await assertSucceeds(setDoc(ref(as('dario'), 'adminVotes', 'dario'), vote));
      await assertFails(setDoc(ref(as('anna'), 'adminVotes', 'anna'), vote));
      await assertFails(setDoc(ref(as('bruno'), 'adminVotes', 'bruno'), vote));
      await assertFails(setDoc(ref(as('carla'), 'adminVotes', 'carla'), vote));
      await assertFails(setDoc(ref(as('dario'), 'adminVotes', 'carla'), vote));
      await assertFails(
        setDoc(ref(as('dario'), 'adminVotes', 'dario'), { proposalId: 'OLD', value: true }),
      );
      await assertFails(
        setDoc(ref(as('dario'), 'adminVotes', 'dario'), { proposalId: 'P1', value: 'si' }),
      );
    });

    it('senza proposta aperta non si vota', async () => {
      await assertFails(
        setDoc(ref(as('dario'), 'adminVotes', 'dario'), { proposalId: 'P1', value: true }),
      );
    });
  });
});

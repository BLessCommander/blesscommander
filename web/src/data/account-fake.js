// Account e gruppi finti per i test Playwright dell'interfaccia (`VITE_ACCOUNT_FAKE=true`, solo con
// l'emulatore locale). Stessa interfaccia di `AuthService` e `GroupsService`; i dati stanno in
// localStorage così sopravvivono al riavvio dell'app. Non tocca nessun servizio.
import { DataError, DATA_ERROR } from './errors.js';
import { generateInviteCode, normalizeInviteCode } from './groups-service.js';

const KEY = 'blc:fake-accounts';

function load() {
  try {
    return JSON.parse(globalThis.localStorage.getItem(KEY)) ?? { session: null, groups: {} };
  } catch {
    return { session: null, groups: {} };
  }
}
const save = (state) => globalThis.localStorage.setItem(KEY, JSON.stringify(state));

export function createFakeAccountServices() {
  const auth = {
    async current() {
      return load().session;
    },
    onChange: () => () => {},
    async signInWithGoogle() {
      const state = load();
      state.session = { uid: 'google-anna', displayName: 'Anna Rossi' };
      save(state);
      return state.session;
    },
    async signOut() {
      const state = load();
      state.session = null;
      save(state);
    },
  };

  const groups = {
    async listMyGroups(uid) {
      return Object.entries(load().groups)
        .filter(([, g]) => g.members[uid])
        .map(([id, g]) => ({ id, name: g.name, role: g.members[uid] }))
        .sort((a, b) => a.name.localeCompare(b.name, 'it'));
    },
    async createGroup(uid, { groupName, displayName }) {
      if (!groupName.trim() || !displayName.trim()) {
        throw new DataError(DATA_ERROR.invalid, 'Campi mancanti');
      }
      const state = load();
      const id = `g${Object.keys(state.groups).length + 1}`;
      const inviteCode = generateInviteCode();
      state.groups[id] = { name: groupName.trim(), inviteCode, members: { [uid]: 'admin' } };
      save(state);
      return { id, name: groupName.trim(), role: 'admin', inviteCode };
    },
    async joinGroup(uid, rawCode, { displayName }) {
      const code = normalizeInviteCode(rawCode);
      const state = load();
      const found = Object.entries(state.groups).find(([, g]) => g.inviteCode === code);
      if (!found || !displayName.trim()) {
        throw new DataError(DATA_ERROR.notFound, 'Codice di invito non valido');
      }
      const [id, group] = found;
      group.members[uid] = 'giocatore';
      save(state);
      return { id, name: group.name, role: 'giocatore' };
    },
  };
  return { auth, groups };
}

import { defineStore } from 'pinia';
import {
  accountServices,
  clearActiveGroup,
  readActiveGroup,
  saveActiveGroup,
} from '../data/account.js';
import { reloadApp } from '../platform/app-lifecycle.js';

/**
 * @typedef {import('../data/firebase-auth.js').Account} Account
 * @typedef {import('../data/groups-service.js').GroupSummary} GroupSummary
 * @typedef {'loading' | 'signed-out' | 'choose' | 'ready'} AccountStatus
 */

/**
 * Chi sta usando l'app e in quale gruppo (E-04a). Scegliere o cambiare gruppo riavvia l'app,
 * perché il gruppo si fissa all'avvio (come l'ambiente dati).
 */
export const useAccountStore = defineStore('account', {
  state: () => ({
    /** @type {AccountStatus} */
    status: 'loading',
    /** @type {Account | null} */
    account: null,
    /** @type {GroupSummary[]} */
    groups: [],
    /** @type {string | null} */
    activeGroupId: null,
    busy: false,
    /** @type {{ reason: string, message: string, detail: string | null } | null} */
    error: null,
    /** Codice di invito del gruppo appena creato: va mostrato una volta. */
    /** @type {{ name: string, inviteCode: string } | null} */
    created: null,
    /** @type {{ reload?: () => void, services?: ReturnType<typeof accountServices> }} */
    options: {},
  }),
  getters: {
    activeGroup: (state) => state.groups.find((g) => g.id === state.activeGroupId) ?? null,
  },
  actions: {
    getServices() {
      return this.options.services ?? accountServices();
    },

    /** Legge l'account e i gruppi; se il gruppo scelto c'è ancora, l'app è pronta. */
    async init() {
      this.status = 'loading';
      try {
        const account = await this.getServices().auth.current();
        await this.enterAccount(account);
      } catch (error) {
        this.recordError(error);
        this.status = 'signed-out';
      }
    },

    async enterAccount(/** @type {Account | null} */ account) {
      this.account = account;
      if (!account) {
        this.groups = [];
        this.activeGroupId = null;
        this.status = 'signed-out';
        return;
      }
      this.groups = await this.getServices().groups.listMyGroups(account.uid);
      const saved = readActiveGroup();
      if (saved && this.groups.some((g) => g.id === saved)) {
        this.activeGroupId = saved;
        this.status = 'ready';
        return;
      }
      if (saved) clearActiveGroup();
      this.activeGroupId = null;
      this.status = 'choose';
    },

    recordError(error) {
      this.error = {
        reason: error?.details?.reason ?? error?.code ?? 'unknown',
        message: error?.message ?? 'Qualcosa è andato storto',
        detail: error?.details?.firebaseCode ?? null,
      };
    },

    async run(work) {
      this.busy = true;
      this.error = null;
      try {
        return await work();
      } catch (error) {
        this.recordError(error);
        return null;
      } finally {
        this.busy = false;
      }
    },

    signInWithGoogle() {
      return this.run(async () => {
        const account = await this.getServices().auth.signInWithGoogle();
        await this.enterAccount(account);
        // Sulla stessa pagina non serve riavviare: il gruppo non è ancora fissato.
        if (this.status === 'ready') this.restart();
      });
    },

    /** @param {{ groupName: string, displayName: string }} input */
    createGroup(input) {
      return this.run(async () => {
        const group = await this.getServices().groups.createGroup(this.account.uid, {
          ...input,
          avatarUrl: this.account.avatarUrl,
        });
        this.groups = [...this.groups, group];
        this.created = { name: group.name, inviteCode: group.inviteCode };
        return group;
      });
    },

    /** @param {{ code: string, displayName: string }} input */
    joinGroup({ code, displayName }) {
      return this.run(async () => {
        const group = await this.getServices().groups.joinGroup(this.account.uid, code, {
          displayName,
          avatarUrl: this.account.avatarUrl,
        });
        this.chooseGroup(group.id);
      });
    },

    /** @param {string} groupId */
    chooseGroup(groupId) {
      saveActiveGroup(groupId);
      this.created = null;
      this.restart();
    },

    /** Torna alla scelta del gruppo senza uscire dall'account. */
    switchGroup() {
      clearActiveGroup();
      this.restart();
    },

    signOut() {
      return this.run(async () => {
        await this.getServices().auth.signOut();
        clearActiveGroup();
        this.restart();
      });
    },

    restart() {
      (this.options.reload ?? reloadApp)();
    },
  },
});

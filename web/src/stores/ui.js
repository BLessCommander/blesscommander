import { defineStore } from 'pinia';
import { readStorage, writeStorage } from '../platform/storage.js';

const SIDEBAR_KEY = 'blesscommander.sidebar-collapsed';

export const useUiStore = defineStore('ui', {
  state: () => ({
    /** Solo da 1024px in su: sotto, il menu laterale è già ridotto alle icone. */
    sidebarCollapsed: readStorage(SIDEBAR_KEY) === '1',
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      writeStorage(SIDEBAR_KEY, this.sidebarCollapsed ? '1' : '0');
    },
  },
});

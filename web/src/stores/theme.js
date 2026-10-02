import { defineStore } from 'pinia';
import { readStorage, writeStorage } from '../platform/storage.js';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  systemPrefersDark,
  watchSystemTheme,
} from '../platform/appearance.js';

/** @typedef {'system' | 'light' | 'dark'} ThemePreference */

const PREFERENCES = ['system', 'light', 'dark'];

/**
 * @param {unknown} value
 * @returns {ThemePreference}
 */
export function parsePreference(value) {
  return PREFERENCES.includes(/** @type {string} */ (value))
    ? /** @type {ThemePreference} */ (value)
    : 'system';
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    /** @type {ThemePreference} */
    preference: parsePreference(readStorage(THEME_STORAGE_KEY)),
    systemDark: systemPrefersDark(),
  }),
  getters: {
    /** @returns {'light' | 'dark'} il tema davvero in uso */
    effective: (state) =>
      state.preference === 'system' ? (state.systemDark ? 'dark' : 'light') : state.preference,
  },
  actions: {
    /** Da chiamare una volta all'avvio dell'app. */
    init() {
      applyTheme(this.preference);
      watchSystemTheme((dark) => {
        this.systemDark = dark;
      });
    },
    /** @param {ThemePreference} preference */
    setPreference(preference) {
      this.preference = parsePreference(preference);
      writeStorage(THEME_STORAGE_KEY, this.preference);
      applyTheme(this.preference);
    },
    toggle() {
      this.setPreference(this.effective === 'dark' ? 'light' : 'dark');
    },
  },
});

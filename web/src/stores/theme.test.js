import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { parsePreference, useThemeStore } from './theme.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    data,
  };
}

describe('tema', () => {
  beforeEach(() => {
    globalThis.localStorage = fakeStorage();
    setActivePinia(createPinia());
  });

  it('valori sconosciuti diventano "system"', () => {
    expect(parsePreference('viola')).toBe('system');
    expect(parsePreference(null)).toBe('system');
    expect(parsePreference('dark')).toBe('dark');
  });

  it('parte da "system" e senza matchMedia il tema effettivo è chiaro', () => {
    const theme = useThemeStore();
    expect(theme.preference).toBe('system');
    expect(theme.effective).toBe('light');
  });

  it('salva la scelta e la rilegge al riavvio', () => {
    useThemeStore().setPreference('dark');
    expect(globalThis.localStorage.data['blesscommander.theme']).toBe('dark');
    setActivePinia(createPinia());
    expect(useThemeStore().preference).toBe('dark');
  });

  it('toggle passa da chiaro a scuro e viceversa', () => {
    const theme = useThemeStore();
    theme.toggle();
    expect(theme.preference).toBe('dark');
    theme.toggle();
    expect(theme.preference).toBe('light');
  });

  it('funziona anche se la memoria del browser è bloccata', () => {
    globalThis.localStorage = {
      getItem() {
        throw new Error('bloccata');
      },
      setItem() {
        throw new Error('bloccata');
      },
    };
    setActivePinia(createPinia());
    const theme = useThemeStore();
    theme.setPreference('light');
    expect(theme.preference).toBe('light');
  });
});

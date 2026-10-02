/**
 * @typedef {'demo'} EnvironmentMode
 * In B-01 esiste solo la modalità demo locale (SPEC §6.11); le altre arrivano con B-08.
 */

/** Nome dell'app, da docs/progetto.json (iniettato da Vite). */
export const APP_NAME = __APP_NAME__;

/** @type {{ mode: EnvironmentMode, label: string }} */
export const ENVIRONMENT = { mode: 'demo', label: 'DEMO LOCALE' };

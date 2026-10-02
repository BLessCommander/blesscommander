import { resolveEnvironment } from './environment-mode.js';

/** Nome dell'app, da docs/progetto.json (iniettato da Vite). */
export const APP_NAME = __APP_NAME__;
/** Nome del repository dati di prova, da docs/progetto.json (iniettato da Vite). */
export const TEST_REPO = __TEST_REPO__;
/** Percorso di base dell'app (`/` in sviluppo, `/<repository>/` su GitHub Pages). */
export const BASE_PATH = import.meta.env.BASE_URL;

export const ENVIRONMENT = resolveEnvironment(import.meta.env);

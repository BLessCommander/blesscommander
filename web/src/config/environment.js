import { readTestRepoFlag, readToken } from '../platform/secure-storage.js';
import { resolveEnvironment } from './environment-mode.js';

/** Nome dell'app, da docs/progetto.json (iniettato da Vite). */
export const APP_NAME = __APP_NAME__;
/** Nome del repository dati di prova, da docs/progetto.json (iniettato da Vite). */
export const TEST_REPO = __TEST_REPO__;
/** Organizzazione e repository dati reale, da docs/progetto.json (iniettati da Vite). */
export const ORG = __ORG__;
export const DATA_REPO = __DATA_REPO__;
/** Percorso di base dell'app (`/` in sviluppo, `/<repository>/` su GitHub Pages). */
export const BASE_PATH = import.meta.env.BASE_URL;

export const ENVIRONMENT = resolveEnvironment(import.meta.env, {
  token: readToken(),
  testRepo: readTestRepoFlag(),
});
/** Repository collegato con il token (nel modo `github`): dei dati veri o quello di prova. */
export const LINKED_REPO = ENVIRONMENT.testRepo ? TEST_REPO : DATA_REPO;

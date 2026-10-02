import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Intercetta con `page.route` le chiamate ai servizi esterni e risponde con le fixture.
 * Qualsiasi richiesta a un servizio esterno senza fixture fa fallire il test (regola: nessuna chiamata reale).
 */
const SERVICES = [
  { host: 'api.scryfall.com', dir: 'scryfall' },
  { host: 'archidekt.com', dir: 'archidekt' },
  { host: 'api2.moxfield.com', dir: 'moxfield' },
  { host: 'backend.commanderspellbook.com', dir: 'spellbook' },
];

const fixturePath = (dir, name) => fileURLToPath(new URL(`./${dir}/${name}.json`, import.meta.url));

/**
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, Record<string, string>>} [map] servizio → { frammento di URL: nome fixture }
 * @returns {Promise<string[]>} richieste esterne non coperte da una fixture
 */
export async function mockExternalServices(page, map = {}) {
  const unmatched = [];
  for (const { host, dir } of SERVICES) {
    await page.route(`**://${host}/**`, async (route) => {
      const url = route.request().url();
      const entry = Object.entries(map[dir] ?? {}).find(([part]) => url.includes(part));
      if (!entry) {
        unmatched.push(url);
        return route.abort('blockedbyclient');
      }
      const body = await readFile(fixturePath(dir, entry[1]), 'utf8');
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    });
  }
  return unmatched;
}

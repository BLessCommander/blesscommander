// Finta Scryfall per i test (regola 5: nessun test chiama servizi reali). Risponde come
// POST /cards/collection e ne imita i comportamenti verificati sull'API vera:
// - un nome contenente "inesistente" non si trova;
// - le carte a più facce si trovano SOLO col nome della prima faccia e tornano col nome completo;
// - senza accenti ("Lim-Dul") si trova la carta e torna col nome con accento ("Lim-Dûl");
// - il prefisso Alchemy "A-" non si trova.

const IDENTITY = {
  "atraxa, praetors' voice": ['W', 'U', 'B', 'G'],
  'tymna the weaver': ['W', 'B'],
  'thrasios, triton hero': ['G', 'U'],
  'krenko, mob boss': ['R'],
  'esika, god of the tree': ['W', 'U', 'B', 'R', 'G'],
};
const GAME_CHANGERS = new Set(['rhystic study', 'cyclonic rift', 'demonic tutor']);

// Prima faccia (minuscola, senza accenti) → nome completo su Scryfall.
const MULTI_FACED = {
  'esika, god of the tree': 'Esika, God of the Tree // The Prismatic Bridge',
  fire: 'Fire // Ice',
  'delver of secrets': 'Delver of Secrets // Insectile Aberration',
  'fable of the mirror-breaker': 'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki',
};
const ACCENTED = { 'lim-dul the necromancer': 'Lim-Dûl the Necromancer' };

const fold = (name) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[‘’]/g, "'").trim();

/** @param {{ name: string }[]} identifiers */
export function fakeCollection(identifiers) {
  const data = [];
  const not_found = [];
  for (const identifier of identifiers) {
    const key = fold(identifier.name);
    if (key.includes('inesistente') || key.includes('//') || /^a-/.test(key)) {
      not_found.push(identifier);
      continue;
    }
    const name = MULTI_FACED[key] ?? ACCENTED[key] ?? identifier.name;
    data.push({
      id: `fake-${fold(name).replace(/[^a-z0-9]+/g, '-')}`,
      name,
      mana_cost: '',
      cmc: 0,
      type_line: '',
      color_identity: IDENTITY[key] ?? [],
      game_changer: GAME_CHANGERS.has(key),
      ...(MULTI_FACED[key]
        ? { card_faces: name.split(' // ').map((faceName) => ({ name: faceName })) }
        : {}),
    });
  }
  return { object: 'list', not_found, data };
}

/** Per i test Vitest: al posto di `fetch`. */
export async function fakeScryfallFetch(url, init) {
  const { identifiers } = JSON.parse(init.body);
  return { ok: true, status: 200, json: async () => fakeCollection(identifiers) };
}

/** Per Playwright: intercetta api.scryfall.com sulla pagina. @param {import('@playwright/test').Page} page */
export async function mockScryfall(page) {
  await page.route('https://api.scryfall.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    const { identifiers } = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify(fakeCollection(identifiers)),
    });
  });
}

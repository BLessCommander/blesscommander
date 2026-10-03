// Finto Commander Spellbook per i test (regola 5: nessun test chiama servizi reali). Risponde come
// POST /find-my-combos, nella forma verificata sull'API vera: `results.included`, ogni combo con
// `uses[].card.name` e `produces[].feature.name`. Conosce quattro combo:
// - Thassa's Oracle + Demonic Consultation (vince la partita);
// - Basalt Monolith + Rings of Brighthearth (mana infinito);
// - Restoration Angel + Felidar Guardian (ETB e LTB infiniti: risposta vera di Spellbook);
// - Isochron Scepter + Dramatic Reversal + Sol Ring (a tre carte).

const COMBOS = [
  {
    id: '742-1295',
    cards: ["Thassa's Oracle", 'Demonic Consultation'],
    produces: ['Exile your library', 'Win the game'],
  },
  {
    id: '100-200',
    cards: ['Basalt Monolith', 'Rings of Brighthearth'],
    produces: ['Infinite colorless mana'],
  },
  {
    id: '1090-2781',
    cards: ['Restoration Angel', 'Felidar Guardian'],
    produces: ['Infinite creature ETB', 'Infinite creature LTB'],
  },
  {
    id: '500-600-700',
    cards: ['Isochron Scepter', 'Dramatic Reversal', 'Sol Ring'],
    produces: ['Infinite mana'],
  },
];

/** @param {{ main?: { card: string }[], commanders?: { card: string }[] }} body */
export function fakeFindMyCombos(body) {
  const names = new Set(
    [...(body.main ?? []), ...(body.commanders ?? [])].map((c) => c.card.toLowerCase()),
  );
  const included = COMBOS.filter((c) => c.cards.every((n) => names.has(n.toLowerCase()))).map(
    (c) => ({
      id: c.id,
      status: 'OK',
      uses: c.cards.map((name) => ({ card: { name }, quantity: 1 })),
      produces: c.produces.map((name) => ({ feature: { name }, quantity: 1 })),
    }),
  );
  return { count: 1, next: null, previous: null, results: { included, almostIncluded: [] } };
}

/** Per i test Vitest: al posto di `fetch`. */
export async function fakeSpellbookFetch(url, init) {
  return {
    ok: true,
    status: 200,
    json: async () => fakeFindMyCombos(JSON.parse(init.body)),
  };
}

/** Per Playwright: intercetta backend.commanderspellbook.com. `fail: true` simula un errore del servizio. */
export async function mockSpellbook(page, { fail = false } = {}) {
  await page.route('https://backend.commanderspellbook.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    if (fail) return route.fulfill({ status: 503, headers: cors, body: '{}' });
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify(fakeFindMyCombos(route.request().postDataJSON())),
    });
  });
}

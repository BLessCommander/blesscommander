/**
 * @typedef {{ login: string, label: string, mine: boolean, decks: any[] }} DeckGroup
 */

/**
 * Raggruppa i mazzi per proprietario: prima i miei, poi gli altri giocatori in ordine alfabetico.
 * Dentro ogni gruppo i mazzi restano nell'ordine ricevuto (di norma dalla fascia più alta).
 * @param {{ ownerLogin: string }[]} decks
 * @param {{ me?: string | null, nameOf?: (login: string) => string }} [options]
 * @returns {DeckGroup[]}
 */
export function groupDecksByOwner(decks, { me = null, nameOf = (login) => login } = {}) {
  /** @type {Map<string, DeckGroup>} */
  const groups = new Map();
  for (const deck of decks) {
    const login = deck.ownerLogin;
    if (!groups.has(login)) {
      groups.set(login, { login, label: nameOf(login), mine: login === me, decks: [] });
    }
    groups.get(login).decks.push(deck);
  }
  return [...groups.values()].sort(
    (a, b) => Number(b.mine) - Number(a.mine) || a.label.localeCompare(b.label, 'it'),
  );
}

/**
 * Gruppi da mostrare per la scelta del filtro: `all` li mostra tutti, altrimenti solo il giocatore scelto
 * (se non esiste più, tutti).
 * @param {DeckGroup[]} groups
 * @param {string} filter `all` oppure il login di un giocatore
 */
export function filterGroups(groups, filter) {
  if (filter === 'all') return groups;
  const only = groups.filter((g) => g.login === filter);
  return only.length ? only : groups;
}

import { DataError, DATA_ERROR } from './errors.js';

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

/** Un login GitHub: lettere, numeri e trattini, senza trattino all'inizio o alla fine. */
export const isValidLogin = (login) => typeof login === 'string' && LOGIN.test(login);

/**
 * Elenco membri dopo aver aggiunto o modificato `login`. Regole comuni a tutti i provider.
 * @param {Record<string, any>} members
 * @param {string} login
 * @param {{ displayName: string, role: 'admin' | 'giocatore', avatarUrl?: string, joinedAt?: string }} member
 * @param {string} joinedAt data da usare se il membro è nuovo
 */
export function withMember(members, login, member, joinedAt) {
  if (!isValidLogin(login)) {
    throw new DataError(DATA_ERROR.invalid, 'Login GitHub non valido');
  }
  const previous = members[login];
  const next = { ...members, [login]: { joinedAt, ...previous, ...member } };
  assertAdminRemains(next);
  return next;
}

/** Elenco membri dopo aver tolto `login`. */
export function withoutMember(members, login) {
  if (!members[login]) throw new DataError(DATA_ERROR.notFound, `Membro non trovato: ${login}`);
  const rest = Object.fromEntries(Object.entries(members).filter(([key]) => key !== login));
  assertAdminRemains(rest);
  return rest;
}

/** Il gruppo deve avere sempre almeno un admin. */
export function assertAdminRemains(members) {
  if (!Object.values(members).some((m) => m.role === 'admin')) {
    throw new DataError(DATA_ERROR.invalid, 'Deve restare almeno un admin');
  }
}

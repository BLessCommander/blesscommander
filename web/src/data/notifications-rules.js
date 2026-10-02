// Regole comuni delle notifiche (SPEC §6.4b), usate da tutti i provider.

/**
 * @typedef {{ readIds: string[], answers: Record<string, 'yes' | 'no'> }} NotificationState
 * @typedef {import('./data-provider.js').Notification} Notification
 */

/** @returns {NotificationState} */
export const emptyNotificationState = () => ({ readIds: [], answers: {} });

/**
 * Unisce le notifiche create dalle Actions con lo stato personale; le più recenti per prime.
 * @param {Array<Record<string, any>>} items
 * @param {NotificationState} state
 * @returns {Notification[]}
 */
export function mergeNotifications(items, state) {
  const read = new Set(state.readIds);
  return items
    .map((item) => {
      const answer = state.answers[item.id];
      return { ...item, read: read.has(item.id) || Boolean(answer), ...(answer && { answer }) };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** @param {NotificationState} state @param {string[]} ids */
export function withRead(state, ids) {
  return { ...state, readIds: [...new Set([...state.readIds, ...ids])] };
}

/** @param {NotificationState} state @param {string} id @param {'yes' | 'no'} answer */
export function withAnswer(state, id, answer) {
  return withRead({ ...state, answers: { ...state.answers, [id]: answer } }, [id]);
}

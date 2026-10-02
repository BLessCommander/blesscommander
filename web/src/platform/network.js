// Stato della rete (SPEC §6.9), usato dalla coda delle scritture offline.

/** @returns {boolean} */
export function isOnline() {
  return globalThis.navigator?.onLine ?? true;
}

/**
 * @param {(online: boolean) => void} callback
 * @returns {() => void} funzione per smettere di ascoltare
 */
export function watchNetwork(callback) {
  const target = globalThis;
  if (!target.addEventListener) return () => {};
  const on = () => callback(true);
  const off = () => callback(false);
  target.addEventListener('online', on);
  target.addEventListener('offline', off);
  return () => {
    target.removeEventListener('online', on);
    target.removeEventListener('offline', off);
  };
}

/** Errore di una richiesta di import: `kind` è `failed` (l'Action ha risposto con un errore), `timeout` o `stopped`. */
export class ImportRequestError extends Error {
  /** @param {'failed' | 'timeout' | 'stopped'} kind @param {string} message */
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

/**
 * Crea una richiesta di import e aspetta l'esito dell'Action (si controlla a intervalli).
 * @param {object} input
 * @param {(source: string, url: string) => Promise<{ id: string }>} input.create
 * @param {(id: string) => Promise<any>} input.get
 * @param {string} input.source
 * @param {string} input.url
 * @param {(ms: number) => Promise<void>} input.wait
 * @param {number} input.pollMs
 * @param {number} input.limit numero massimo di controlli
 * @param {() => boolean} [input.isStopped] vero se la pagina è stata chiusa
 * @returns {Promise<any>} la richiesta conclusa (`status: 'done'`)
 */
export async function requestAndWait({ create, get, source, url, wait, pollMs, limit, isStopped }) {
  const request = await create(source, url);
  for (let i = 0; i < limit; i++) {
    if (isStopped?.()) throw new ImportRequestError('stopped', '');
    const state = await get(request.id);
    if (state.status === 'done') return state;
    if (state.status === 'error') {
      throw new ImportRequestError('failed', String(state.error ?? '').replace(/\.$/, ''));
    }
    await wait(pollMs);
  }
  throw new ImportRequestError('timeout', '');
}

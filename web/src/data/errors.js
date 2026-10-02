/** Errore del livello dati: `code` è uno tra i valori di `DATA_ERROR`. */
export const DATA_ERROR = Object.freeze({
  notFound: 'not-found',
  invalid: 'invalid',
  forbidden: 'forbidden',
  conflict: 'conflict',
  network: 'network',
  auth: 'auth',
});

export class DataError extends Error {
  /**
   * @param {string} code uno dei valori di `DATA_ERROR`
   * @param {string} message
   * @param {unknown} [details]
   */
  constructor(code, message, details) {
    super(message);
    this.name = 'DataError';
    this.code = code;
    this.details = details;
  }
}

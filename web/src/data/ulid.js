// Identificativi ULID generati sul dispositivo (SPEC §6.4): unici anche offline e ordinabili per data.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** @returns {Uint8Array} 10 byte casuali */
function randomBytes() {
  return globalThis.crypto.getRandomValues(new Uint8Array(10));
}

/**
 * @param {number} [time] millisecondi dall'epoca (di norma l'ora del dispositivo)
 * @param {() => Uint8Array} [random] sorgente casuale, sostituibile nei test
 * @returns {string} ULID di 26 caratteri
 */
export function ulid(time = Date.now(), random = randomBytes) {
  let timePart = '';
  let t = time;
  for (let i = 0; i < 10; i++) {
    timePart = ALPHABET[t % 32] + timePart;
    t = Math.floor(t / 32);
  }
  let big = 0n;
  for (const byte of random()) big = (big << 8n) | BigInt(byte);
  let randomPart = '';
  for (let i = 0; i < 16; i++) {
    randomPart = ALPHABET[Number(big & 31n)] + randomPart;
    big >>= 5n;
  }
  return timePart + randomPart;
}

export const ULID_PATTERN = '^[0-9A-HJKMNP-TV-Z]{26}$';

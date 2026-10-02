// Vibrazione (SPEC §6.9). Senza supporto non fa nulla.

/** @param {number | number[]} [pattern] durata in millisecondi */
export function vibrate(pattern = 20) {
  try {
    globalThis.navigator?.vibrate?.(pattern);
  } catch {
    // il dispositivo non la permette
  }
}

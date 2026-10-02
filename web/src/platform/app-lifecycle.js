// Riavvio dell'app (SPEC §6.9): serve quando cambia l'ambiente dati, che si sceglie all'avvio.

export function reloadApp() {
  globalThis.location?.reload();
}

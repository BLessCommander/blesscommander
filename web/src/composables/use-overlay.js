import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// Menu e finestre sono "ancorati" alla cronologia: aprirli aggiunge una voce (`?overlay=nome`),
// così il tasto indietro del telefono li chiude prima di cambiare pagina (SPEC 05 §5.3).
const pushed = new Set();

/** @param {string} name */
export function useOverlay(name) {
  const route = useRoute();
  const router = useRouter();
  const isOpen = computed(() => route.query.overlay === name);

  watch(isOpen, (open) => {
    if (!open) pushed.delete(name);
  });

  function open() {
    if (isOpen.value) return;
    pushed.add(name);
    router.push({ query: { ...route.query, overlay: name } });
  }

  function close() {
    if (!isOpen.value) return;
    if (pushed.has(name)) {
      pushed.delete(name);
      router.back();
    } else {
      // Aperto da un link diretto: non c'è una voce precedente da cui tornare.
      const query = { ...route.query };
      delete query.overlay;
      router.replace({ query });
    }
  }

  return { isOpen, open, close };
}

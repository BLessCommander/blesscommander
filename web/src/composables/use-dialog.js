import { nextTick, onBeforeUnmount, watch } from 'vue';
import { lockScroll } from '../platform/appearance.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento comune di menu a scomparsa e finestre: sposta il focus dentro, lo tiene dentro
 * con Tab, chiude con Esc, blocca lo scorrimento sotto e rimette il focus dove era.
 * @param {import('vue').Ref<boolean>} isOpen
 * @param {import('vue').Ref<HTMLElement | null>} container
 * @param {() => void} close
 */
export function useDialog(isOpen, container, close) {
  /** @type {HTMLElement | null} */
  let previous = null;

  /** @param {KeyboardEvent} event */
  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab' || !container.value) return;
    const items = [...container.value.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === container.value)) {
      event.preventDefault();
      /** @type {HTMLElement} */ (last).focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      /** @type {HTMLElement} */ (first).focus();
    }
  }

  watch(isOpen, async (open) => {
    lockScroll(open);
    if (open) {
      previous = /** @type {HTMLElement | null} */ (document.activeElement);
      document.addEventListener('keydown', onKeydown);
      await nextTick();
      container.value?.focus();
    } else {
      document.removeEventListener('keydown', onKeydown);
      previous?.focus?.();
      previous = null;
    }
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown);
    lockScroll(false);
  });
}

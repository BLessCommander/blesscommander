<script setup>
import { ref } from 'vue';
import { useDialog } from '../../composables/use-dialog.js';
import { useOverlay } from '../../composables/use-overlay.js';
import { it } from '../../i18n/it.js';
import AppIcon from './AppIcon.vue';

// Finestra: a schermo intero dal basso sul telefono (bottom sheet), centrata da 768px in su.
// Si apre con `useOverlay(name).open()` o con `?overlay=<name>`; il tasto indietro la chiude.
const props = defineProps({
  name: { type: String, required: true },
  title: { type: String, required: true },
});

const { isOpen, close } = useOverlay(props.name);
const dialog = ref(null);
useDialog(isOpen, dialog, close);

const titleId = `modal-${props.name}-title`;
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal">
      <div class="modal__backdrop" @click="close"></div>
      <div
        ref="dialog"
        class="modal__panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <header class="modal__header">
          <h2 :id="titleId" class="modal__title">{{ title }}</h2>
          <button type="button" class="icon-btn" :aria-label="it.modal.close" @click="close">
            <AppIcon name="close" />
          </button>
        </header>
        <div class="modal__body"><slot /></div>
        <footer v-if="$slots.footer" class="modal__footer"><slot name="footer" /></footer>
      </div>
    </div>
  </Teleport>
</template>

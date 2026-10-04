<script setup>
import { ref, watch } from 'vue';
import { addTag, removeTag } from '../domain/deck-tags.js';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const props = defineProps({
  deckId: { type: String, required: true },
  tags: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
});

const t = it.deckPage.tags;
const data = useDataStore();
const current = ref([...props.tags]);
const draft = ref('');
const error = ref('');
const saving = ref(false);

watch(
  () => props.tags,
  (tags) => {
    current.value = [...(tags ?? [])];
  },
);

// Salva solo i tag: il mazzo si rilegge intero così non si perde nessun altro campo.
async function save(next) {
  saving.value = true;
  error.value = '';
  try {
    const { deck } = await data.getDeck(props.deckId);
    const copy = JSON.parse(JSON.stringify(deck));
    if (next.length) copy.tags = next;
    else delete copy.tags;
    await data.write('saveDeck', copy);
    current.value = next;
    return true;
  } catch {
    error.value = t.saveFailed;
    return false;
  } finally {
    saving.value = false;
  }
}

async function add() {
  const result = addTag(current.value, draft.value);
  if (!result.ok) {
    error.value = t.reasons[result.reason];
    return;
  }
  if (await save(result.tags)) draft.value = '';
}

const remove = (tag) => save(removeTag(current.value, tag));
</script>

<template>
  <section class="deck-tags" data-testid="deck-tags" :aria-label="t.title">
    <h2 class="deck-tags__title">{{ t.title }}</h2>
    <ul v-if="current.length" class="deck-tags__list">
      <li v-for="tag in current" :key="tag" class="tag">
        <span class="tag__name">{{ tag }}</span>
        <button
          v-if="canEdit"
          type="button"
          class="tag__remove"
          :aria-label="t.remove(tag)"
          :disabled="saving"
          @click="remove(tag)"
        >
          <span aria-hidden="true">×</span>
        </button>
      </li>
    </ul>
    <p v-else class="muted">{{ t.none }}</p>

    <form v-if="canEdit" class="deck-tags__form" @submit.prevent="add">
      <label class="deck-tags__field">
        <span>{{ t.label }}</span>
        <input
          v-model="draft"
          name="newTag"
          type="text"
          maxlength="40"
          autocomplete="off"
          :placeholder="t.placeholder"
          data-testid="tag-input"
        />
      </label>
      <button type="submit" class="btn" :disabled="saving" data-testid="tag-add">
        {{ saving ? t.saving : t.add }}
      </button>
    </form>
    <p v-if="error" class="notice notice--error" role="alert" data-testid="tag-error">
      {{ error }}
    </p>
  </section>
</template>

<style scoped>
.deck-tags {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.deck-tags__title {
  margin: 0;
  font-size: 1rem;
}

.deck-tags__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tag {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  padding-left: 0.75rem;
  color: var(--text);
  background: var(--accent-soft);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.tag:not(:has(.tag__remove)) {
  padding-right: 0.75rem;
}

.tag__name {
  overflow-wrap: anywhere;
}

.tag__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--tap);
  height: var(--tap);
  font: inherit;
  font-size: 1.25rem;
  color: var(--text);
  background: none;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.tag__remove:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

.deck-tags__form {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
}

.deck-tags__field {
  display: grid;
  gap: 0.375rem;
  flex: 1 1 14rem;
  min-width: 0;
  max-width: 26rem;
  font-weight: 600;
}

.deck-tags__field input {
  width: 100%;
  min-width: 0;
  min-height: var(--tap);
  padding: 0.5rem 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--text-muted);
  border-radius: var(--radius-sm);
}
</style>

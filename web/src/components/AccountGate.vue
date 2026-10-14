<script setup>
import { computed, ref } from 'vue';
import { it } from '../i18n/it.js';
import { useAccountStore } from '../stores/account.js';

const t = it.accounts;
const store = useAccountStore();
const groupName = ref('');
// Proposto dal nome dell'account Google (che arriva dopo l'avvio), modificabile.
const typedName = ref(null);
const displayName = computed({
  get: () => typedName.value ?? store.account?.displayName ?? '',
  set: (value) => {
    typedName.value = value;
  },
});
const code = ref('');

const errorText = computed(() =>
  store.error ? (t.errors[store.error.reason] ?? t.errors.unknown) : '',
);
const title = computed(() => {
  if (store.created) return t.createdTitle;
  return store.status === 'choose' ? t.chooseTitle : it.pages.access.title;
});
const canCreate = computed(() => groupName.value.trim() && displayName.value.trim() && !store.busy);
const canJoin = computed(() => code.value.trim() && displayName.value.trim() && !store.busy);

async function create() {
  await store.createGroup({ groupName: groupName.value, displayName: displayName.value });
  if (!store.error) groupName.value = '';
}
</script>

<template>
  <div class="stack gate">
    <h1>{{ title }}</h1>

    <p v-if="store.status === 'loading'" role="status" data-testid="account-loading">
      {{ t.loading }}
    </p>

    <section v-else-if="store.status === 'signed-out'" class="card stack">
      <p>{{ t.googleIntro }}</p>
      <div v-if="errorText" class="notice notice--error" role="alert" data-testid="account-error">
        {{ errorText }}
        <small v-if="store.error?.detail" class="muted" data-testid="account-error-detail">
          ({{ store.error.detail }})
        </small>
      </div>
      <p v-if="store.busy" role="status">{{ t.signingIn }}</p>
      <button
        type="button"
        class="btn"
        data-testid="google-signin"
        :disabled="store.busy"
        @click="store.signInWithGoogle()"
      >
        {{ t.google }}
      </button>
    </section>

    <template v-else>
      <p class="muted" data-testid="account-name">
        {{ t.signedInAs }} {{ store.account.displayName }}
      </p>

      <section v-if="store.created" class="card stack" data-testid="group-created">
        <h2>{{ t.createdTitle }}: {{ store.created.name }}</h2>
        <p>{{ t.createdHelp }}</p>
        <p class="gate__code">
          <span class="muted">{{ t.inviteCode }}</span>
          <strong data-testid="invite-code">{{ store.created.inviteCode }}</strong>
        </p>
        <button
          type="button"
          class="btn"
          data-testid="group-created-continue"
          @click="store.chooseGroup(store.groups.at(-1).id)"
        >
          {{ t.continue }}
        </button>
      </section>

      <template v-else>
        <section class="card stack" aria-labelledby="my-groups">
          <h2 id="my-groups">{{ t.chooseTitle }}</h2>
          <p v-if="!store.groups.length" class="muted" data-testid="no-groups">{{ t.noGroups }}</p>
          <template v-else>
            <p class="muted">{{ t.chooseIntro }}</p>
            <ul class="gate__list">
              <li v-for="group in store.groups" :key="group.id" :data-testid="`group-${group.id}`">
                <span>
                  <strong>{{ group.name }}</strong>
                  <small class="muted"> · {{ t.role[group.role] }}</small>
                </span>
                <button type="button" class="btn" @click="store.chooseGroup(group.id)">
                  {{ t.open }}
                </button>
              </li>
            </ul>
          </template>
        </section>

        <div v-if="errorText" class="notice notice--error" role="alert" data-testid="account-error">
          {{ errorText }}
        </div>

        <form class="card stack" data-testid="create-group" @submit.prevent="create">
          <h2>{{ t.createTitle }}</h2>
          <p class="muted">{{ t.createHelp }}</p>
          <label class="gate__field">
            <span>{{ t.groupName }}</span>
            <input v-model="groupName" name="groupName" autocomplete="off" required />
          </label>
          <label class="gate__field">
            <span>{{ t.yourName }}</span>
            <input v-model="displayName" name="displayName" autocomplete="nickname" required />
          </label>
          <button type="submit" class="btn" :disabled="!canCreate">{{ t.create }}</button>
        </form>

        <form
          class="card stack"
          data-testid="join-group"
          @submit.prevent="store.joinGroup({ code, displayName })"
        >
          <h2>{{ t.joinTitle }}</h2>
          <p class="muted">{{ t.joinHelp }}</p>
          <label class="gate__field">
            <span>{{ t.code }}</span>
            <input
              v-model="code"
              name="code"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              required
            />
          </label>
          <label class="gate__field">
            <span>{{ t.yourName }}</span>
            <input v-model="displayName" name="joinDisplayName" autocomplete="nickname" required />
          </label>
          <button type="submit" class="btn" :disabled="!canJoin">{{ t.join }}</button>
        </form>

        <button type="button" class="btn btn--secondary" @click="store.signOut()">
          {{ t.signOut }}
        </button>
      </template>
    </template>
  </div>
</template>

<style scoped>
.gate {
  max-width: 70ch;
}
.gate__list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.gate__list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.gate__field {
  display: grid;
  gap: 0.375rem;
  font-weight: 600;
}
.gate__field input {
  min-height: var(--tap);
  padding: 0 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.gate__code {
  display: grid;
  gap: 0.25rem;
  margin: 0;
}
.gate__code strong {
  font-size: 1.75rem;
  letter-spacing: 0.15em;
  word-break: break-all;
}
</style>

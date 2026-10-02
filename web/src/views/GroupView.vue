<script setup>
import { computed, onMounted, ref } from 'vue';
import AppModal from '../components/ui/AppModal.vue';
import UserAvatar from '../components/ui/UserAvatar.vue';
import { useOverlay } from '../composables/use-overlay.js';
import { isValidLogin } from '../data/members-rules.js';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const t = it.group;
const data = useDataStore();
const form = useOverlay('member-form');
const removal = useOverlay('member-remove');

const loading = ref(true);
const isAdmin = computed(() => data.user?.role === 'admin');
const rows = computed(() =>
  Object.entries(data.members)
    .map(([login, member]) => ({ login, ...member }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'it')),
);

const editing = ref(false);
const draft = ref({ login: '', displayName: '', role: 'giocatore' });
const target = ref(null);
const error = ref('');
const busy = ref(false);

onMounted(async () => {
  try {
    await data.loadMembers();
  } catch {
    error.value = t.errors.generic;
  } finally {
    loading.value = false;
  }
});

function describe(err) {
  if (err?.code === 'forbidden') return t.errors.forbidden;
  if (err?.message?.includes('almeno un admin')) return t.errors.lastAdmin;
  if (err?.code === 'invalid' && err.message.includes('Login')) return t.errors.login;
  return t.errors.generic;
}

function openAdd() {
  editing.value = false;
  draft.value = { login: '', displayName: '', role: 'giocatore' };
  error.value = '';
  form.open();
}

function openEdit(row) {
  editing.value = true;
  draft.value = { login: row.login, displayName: row.displayName, role: row.role };
  error.value = '';
  form.open();
}

function openRemove(row) {
  target.value = row;
  error.value = '';
  removal.open();
}

async function submit() {
  const login = draft.value.login.trim();
  const displayName = draft.value.displayName.trim();
  if (!isValidLogin(login)) return (error.value = t.errors.login);
  if (!displayName) return (error.value = t.errors.displayName);
  if (!editing.value && data.members[login]) return (error.value = t.errors.exists);
  busy.value = true;
  try {
    await data.saveMember(login, { displayName, role: draft.value.role });
    form.close();
  } catch (err) {
    error.value = describe(err);
  } finally {
    busy.value = false;
  }
}

async function confirmRemove() {
  busy.value = true;
  try {
    await data.removeMember(target.value.login);
    removal.close();
  } catch (err) {
    error.value = describe(err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <h1>{{ it.pages.group.title }}</h1>

    <section class="card stack" aria-labelledby="group-members">
      <div class="head">
        <h2 id="group-members">{{ t.members }}</h2>
        <button v-if="isAdmin" type="button" class="btn" data-testid="member-add" @click="openAdd">
          {{ t.add }}
        </button>
      </div>
      <p v-if="!isAdmin" class="muted" data-testid="members-readonly">{{ t.readOnly }}</p>
      <p v-if="loading" role="status">{{ t.loading }}</p>
      <p v-else-if="error && !form.isOpen.value && !removal.isOpen.value" role="alert">
        {{ error }}
      </p>

      <ul class="members" data-testid="members-list">
        <li v-for="row in rows" :key="row.login" class="member" :data-login="row.login">
          <UserAvatar :name="row.displayName" :src="row.avatarUrl" />
          <div class="member__info">
            <strong>{{ row.displayName }}</strong>
            <span class="muted">
              {{ row.login }} ·
              {{ row.role === 'admin' ? t.roleAdmin : t.rolePlayer }}
              <template v-if="row.login === data.user?.login"> ({{ t.you }})</template>
            </span>
          </div>
          <div v-if="isAdmin" class="member__actions">
            <button type="button" class="btn btn--secondary" @click="openEdit(row)">
              {{ t.edit }}
            </button>
            <button
              type="button"
              class="btn btn--danger"
              :disabled="row.login === data.user?.login"
              @click="openRemove(row)"
            >
              {{ t.remove }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <AppModal v-if="isAdmin" name="member-form" :title="editing ? t.editTitle : t.addTitle">
      <form id="member-form" class="stack" @submit.prevent="submit">
        <label class="field">
          <span>{{ t.login }}</span>
          <input
            v-model="draft.login"
            name="login"
            :placeholder="t.loginPlaceholder"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :readonly="editing"
          />
          <small v-if="!editing" class="muted">{{ t.loginHelp }}</small>
        </label>
        <label class="field">
          <span>{{ t.displayName }}</span>
          <input
            v-model="draft.displayName"
            name="displayName"
            :placeholder="t.namePlaceholder"
            autocomplete="off"
          />
        </label>
        <label class="field">
          <span>{{ t.role }}</span>
          <select v-model="draft.role" name="role">
            <option value="giocatore">{{ t.rolePlayer }}</option>
            <option value="admin">{{ t.roleAdmin }}</option>
          </select>
        </label>
        <p v-if="!editing" class="muted">{{ t.inviteHelp }}</p>
        <p v-if="error" role="alert" class="notice notice--error">{{ error }}</p>
      </form>
      <template #footer>
        <button type="button" class="btn btn--secondary" @click="form.close()">
          {{ t.cancel }}
        </button>
        <button type="submit" form="member-form" class="btn" :disabled="busy">{{ t.save }}</button>
      </template>
    </AppModal>

    <AppModal v-if="isAdmin" name="member-remove" :title="t.removeTitle">
      <p v-if="target">{{ t.removeConfirm(target.displayName) }}</p>
      <p v-if="error" role="alert" class="notice notice--error">{{ error }}</p>
      <template #footer>
        <button type="button" class="btn btn--secondary" @click="removal.close()">
          {{ t.cancel }}
        </button>
        <button
          type="button"
          class="btn btn--danger"
          data-testid="member-remove-confirm"
          :disabled="busy"
          @click="confirmRemove"
        >
          {{ t.remove }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.members {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
.member {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.member__info {
  display: grid;
  min-width: 0;
  flex: 1 1 12rem;
  overflow-wrap: anywhere;
}
.member__actions {
  display: flex;
  gap: 0.5rem;
}
.field {
  display: grid;
  gap: 0.375rem;
  font-weight: 600;
}
.field input,
.field select {
  min-height: var(--tap);
  padding: 0 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.field select {
  appearance: none;
  padding-right: 2.25rem;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--text-muted) 50%),
    linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 50%,
    calc(100% - 13px) 50%;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}
.field input::placeholder {
  color: var(--text-muted);
  opacity: 0.8;
}
.field small {
  font-weight: 400;
}
</style>

<script setup>
import { onMounted, ref } from 'vue';
import { it } from '../i18n/it.js';
import { useDataStore } from '../stores/data.js';

const data = useDataStore();
const failed = ref(false);

const textOf = (n) =>
  (it.notifications.types[n.type] ?? (() => it.notifications.unknownType))(n.params ?? {});

async function run(action) {
  failed.value = false;
  try {
    await action();
  } catch {
    failed.value = true;
  }
}

onMounted(() => data.loadNotifications());
</script>

<template>
  <div class="stack">
    <h1>{{ it.pages.notifications.title }}</h1>

    <section v-if="data.notificationsPaused" class="card stack" data-testid="notifications-paused">
      <h2>{{ it.notifications.pausedTitle }}</h2>
      <p class="muted">{{ it.notifications.pausedText }}</p>
    </section>

    <template v-else>
      <p v-if="failed" class="muted" role="alert">{{ it.notifications.error }}</p>
      <div v-if="data.unreadCount">
        <button
          type="button"
          class="btn btn--secondary"
          data-testid="mark-all-read"
          @click="
            run(() =>
              data.markNotificationsRead(
                data.notifications.filter((n) => !n.read).map((n) => n.id),
              ),
            )
          "
        >
          {{ it.notifications.markAllRead }}
        </button>
      </div>

      <p v-if="data.notifications.length === 0" class="muted">{{ it.notifications.empty }}</p>
      <ul v-else class="notification-list">
        <li
          v-for="n in data.notifications"
          :key="n.id"
          class="notification"
          :class="{ 'notification--unread': !n.read }"
          data-testid="notification"
          :data-read="n.read"
        >
          <p>
            <strong v-if="!n.read">{{ it.notifications.unread }} · </strong>{{ textOf(n) }}
          </p>
          <div v-if="n.actions && !n.answer" class="notification__actions">
            <button
              type="button"
              class="btn"
              data-testid="answer-yes"
              @click="run(() => data.answerNotification(n.id, 'yes'))"
            >
              {{ it.notifications.yes }}
            </button>
            <button
              type="button"
              class="btn btn--secondary"
              data-testid="answer-no"
              @click="run(() => data.answerNotification(n.id, 'no'))"
            >
              {{ it.notifications.no }}
            </button>
          </div>
          <p v-else-if="n.answer" class="muted" data-testid="answered">
            {{ n.answer === 'yes' ? it.notifications.answeredYes : it.notifications.answeredNo }}
          </p>
          <div v-if="!n.read" class="notification__actions">
            <button
              type="button"
              class="btn btn--secondary notification__read"
              data-testid="mark-read"
              @click="run(() => data.markNotificationsRead([n.id]))"
            >
              {{ it.notifications.markRead }}
            </button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

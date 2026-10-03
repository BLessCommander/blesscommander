<script setup>
import { it } from '../../i18n/it.js';
import { useDataStore } from '../../stores/data.js';

const t = it.sync;
const data = useDataStore();
</script>

<template>
  <div v-if="data.refreshing || data.pendingWrites > 0 || data.dropped.length > 0" class="sync">
    <p v-if="data.refreshing" class="sync__row" role="status">
      {{ t.updating[data.refreshingKind] }}
    </p>
    <p v-if="data.pendingWrites > 0" class="sync__row" role="status">
      {{ t.pending(data.pendingWrites) }}
      <button type="button" class="link-btn" @click="data.flushQueue()">{{ t.retry }}</button>
    </p>
    <p v-if="data.dropped.length > 0" class="sync__row sync__row--warn" role="alert">
      {{ t.dropped(data.dropped.length) }}
      <button type="button" class="link-btn" @click="data.dismissDropped()">{{ t.dismiss }}</button>
    </p>
  </div>
</template>

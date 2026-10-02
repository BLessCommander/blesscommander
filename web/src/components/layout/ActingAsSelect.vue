<script setup>
import { it } from '../../i18n/it.js';
import { useDataStore } from '../../stores/data.js';

const t = it.actingAs;
const data = useDataStore();

function change(event) {
  const value = event.target.value;
  data.setActingAs(value === '' ? null : value);
}
</script>

<template>
  <label v-if="data.actingAsOptions.enabled" class="acting-as">
    <span class="acting-as__label">{{ t.label }}</span>
    <select :value="data.actingAsOptions.current ?? ''" :title="t.help" @change="change">
      <option value="">{{ t.self }}</option>
      <option v-for="m in data.actingAsOptions.members" :key="m.login" :value="m.login">
        {{ m.displayName }}
      </option>
    </select>
  </label>
</template>

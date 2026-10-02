<script setup>
import { it } from '../i18n/it.js';
import { TIERS } from '../tiers.js';
</script>

<template>
  <div class="stack">
    <h1>{{ it.pages.rules.title }}</h1>
    <section class="card" aria-labelledby="fasce">
      <h2 id="fasce">{{ it.rules.tiersTitle }}</h2>
      <ul class="tiers">
        <li v-for="tier in TIERS" :key="tier.id" class="tier" :class="`tier--${tier.id}`">
          <span class="tier__badge">{{ tier.id }}</span>
          <span class="tier__name">{{ tier.name }}</span>
          <span class="tier__turns">{{ it.rules.turn }} {{ tier.turns }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

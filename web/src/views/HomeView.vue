<script setup>
import { APP_NAME } from '../config/environment.js';
import { TIERS } from '../tiers.js';
</script>

<template>
  <main class="home">
    <header class="home__hero">
      <h1 class="home__title">{{ APP_NAME }}</h1>
      <p class="home__lead">Le fasce Commander del nostro gruppo, aggiornate dalle partite vere.</p>
    </header>

    <section class="card" aria-labelledby="regola-oro">
      <h2 id="regola-oro" class="card__title">Zero interazioni durante la partita</h2>
      <p>
        L'app si usa solo prima (lobby) e dopo (chiusura in 3 tocchi). Mentre si gioca, l'unica cosa
        da fare è girare un dado fisico per contare i turni.
      </p>
    </section>

    <section class="card" aria-labelledby="fasce">
      <h2 id="fasce" class="card__title">Le cinque fasce</h2>
      <ul class="tiers">
        <li v-for="tier in TIERS" :key="tier.id" class="tier" :class="`tier--${tier.id}`">
          <span class="tier__badge">{{ tier.id }}</span>
          <span class="tier__name">{{ tier.name }}</span>
          <span class="tier__turns">Turno {{ tier.turns }}</span>
        </li>
      </ul>
    </section>

    <p class="home__note">
      Prima pagina di prova (B-01): il design system e la navigazione arrivano con la voce B-04.
    </p>
  </main>
</template>

# BLessCommander (nome nei documenti: Bracketeer)

Web app per un gruppo di amici che gioca a Magic: The Gathering Commander. Importa mazzi (Archidekt/Moxfield/testo) e registra le partite.
Un motore deterministico promuove, declassa o conferma la fascia (F1–F5) di ogni mazzo in base ai risultati.
Nessun backend: dati JSON in un repository GitHub privato, calcoli ufficiali nelle GitHub Actions (SPEC §6).

Nome app nel codice e nell'interfaccia: quello di `docs/progetto.json` (`appName`). Lingua di lavoro: italiano. L'utente non è esperto di GitHub: spiega in modo semplice.

## Stack e comandi

Vue 3 + Vite (`<script setup>`, JavaScript con JSDoc), Pinia, Vue Router hash, Chart.js (vue-chartjs), SCSS con design system proprio, font inclusi nel progetto, API REST di GitHub con `fetch`, Capacitor predisposto, Vitest, Playwright, @axe-core/playwright. Monorepo npm workspaces.

| Comando                   | Cosa fa                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `npm run dev`             | App locale in modalità demo, senza configurazione              |
| `npm run dev:lan`         | Come `dev`, raggiungibile dal telefono sulla stessa rete Wi-Fi |
| `npm run dev:fake-github` | App collegata alla finta API GitHub locale (da B-08)           |
| `npm run preview`         | Build di produzione con il percorso di base di GitHub Pages    |
| `npm run build`           | Build di produzione                                            |
| `npm run test`            | Test unitari (Vitest)                                          |
| `npm run test:e2e`        | Test Playwright sui 6 profili (da B-03)                        |
| `npm run seed:test`       | Dati di prova per la finta API (da B-03)                       |
| `npm run lint`            | ESLint + Prettier                                              |

## Struttura cartelle

- `packages/tier-engine/`: motore fasce, JavaScript puro (nessuna dipendenza da browser, GitHub o Firebase)
- `web/`: app Vue; `web/src/platform/` adattatori del dispositivo; `web/src/data/` DataProvider
- `data-actions/`: script delle Actions e template del repository dati
- `tests/`: `e2e/`, `fake-github/`, `fixtures/`
- `docs/`: `spec/` (specifica a moduli), piani, `progetto.json` (dati non segreti della configurazione)
- `.claude/`: subagent, comandi, impostazioni

## Regole non negoziabili

1. **Zero interazioni durante la partita.** Tutto in lobby o in chiusura (3 tocchi). Solo il registratore gira un dado fisico. Se una funzione richiede il telefono in partita: fermati e proponi un'alternativa. → `docs/spec/00-indice.md` §1
2. **Desktop e mobile al 100%**, requisito bloccante: ogni funzione su entrambi, criteri di `docs/spec/05-ui-responsive.md` §5.3, mobile first.
3. **Dati derivati** (`derived/`) scritti solo dall'Action di ricalcolo, sempre da zero sullo storico. Solo il registratore chiude una partita (verifica sull'autore del commit). Riapertura solo all'unanimità. Motore deterministico.
4. **Design ispirato a Nalika e CoreUI ma scritto da zero**: nessun codice, CSS o asset copiato; niente Bootstrap/CoreUI.
5. **Nessun test chiama servizi esterni reali**: fixture e finta API GitHub su cartella locale (`docs/PIANO-Test.md` §1).
6. **Una funzionalità è finita** solo con test unitari e Playwright verdi sui 6 profili e revisione screenshot superata.
7. **Nessun componente o store importa codice di GitHub o Firebase**: tutto passa da `DataProvider` (SPEC §6.3). Funzioni del dispositivo solo da `web/src/platform/` (§6.9). Niente `alert`/`confirm`, niente font o librerie da CDN, routing hash.
8. **Il token GitHub** non si logga, non si mostra in chiaro, non va a domini diversi da `api.github.com`. Nessun segreto nel repository del codice (diventerà pubblico).
9. **Utenti di prova = membri finti** del repository dati di prova, mai account GitHub reali (SPEC §6.7). La modalità prova deve essere impossibile sul repository reale.
10. **Versione locale sempre funzionante**: `npm run dev` parte in demo senza configurazione. A fine voce dì all'utente cosa vedere in locale e come aprirlo dal telefono (SPEC §6.11).
11. **Prima di ogni comando che crea o modifica qualcosa su GitHub** (repository, impostazioni, visibilità, secret): spiega cosa fa e chiedi conferma. Mai chiedere o accettare token e password in chat.

## Convenzioni di codice

- JavaScript con JSDoc (`@typedef`, `@param`), niente TypeScript. File Vue con `<script setup>`.
- Moduli ES. Nomi di file `kebab-case`; componenti Vue `PascalCase.vue`; store Pinia `useXxxStore`.
- Testi dell'interfaccia in italiano, centralizzati; identificatori nel codice in inglese, come nel modello dati della SPEC §6.6.
- SCSS con variabili CSS per i temi chiaro e scuro; breakpoint 576/768/1024/1440 (SPEC §5.3).
- Identificativi ULID generati sul dispositivo. Il motore non usa `Date.now()` né casualità.
- Commenti solo dove il perché non è ovvio. Prettier e ESLint a fine modifica.

## Protocollo di sessione

- **Inizio:** leggi CLAUDE.md e SOLO la sezione "Passaggio di consegne" + la riga della voce di lavoro in `docs/PIANO-Funzionalita.md`. Leggi solo i moduli di specifica e i casi di test indicati per quella voce.
- Lavori su **UNA voce del piano per sessione**. Se scopri lavoro extra, aggiungilo al piano come nuova voce invece di farlo subito.
- Leggi i file per intervalli di righe quando sono lunghi; ricerche mirate invece di aprire cartelle intere; non leggere mai `node_modules`, `dist`, `coverage`, `test-results`, `playwright-report`, lockfile.
- **Test:** esegui SEMPRE tramite il subagent `test-runner`; riesegui solo i falliti; non incollare mai log completi.
- **Screenshot:** analizzali SEMPRE tramite il subagent `ui-reviewer`, mai nella conversazione principale.
- **Esplorazioni ampie** del codice: usa il subagent `code-explorer` e fatti restituire solo il riassunto.
- **Fine:** spunta la voce, aggiorna "Passaggio di consegne" (max 15 righe), aggiungi le decisioni qui sotto, proponi il messaggio di commit, dì cosa provare a mano e di eseguire `/clear`.
- Comandi utili: `/riprendi`, `/testa <ID>`, `/revisione-ui <ID>`, `/consegna`.

## Indice dei documenti (quando leggerli)

- `docs/PIANO-Funzionalita.md`: all'inizio di ogni sessione (solo "Passaggio di consegne" e la riga della voce); registro di avanzamento.
- `docs/PIANO-Test.md`: §1–§6 quando lavori sui test; poi solo i casi UC/UT della voce.
- `docs/GUIDA-Sessioni.md`: solo se l'utente chiede come lavorare o vedere l'app in locale.
- `docs/SETUP-GitHub.md`: solo per token, inviti, pubblicazione.
- `docs/progetto.json`: nome app, organizzazione, repository.
- `docs/spec/00-indice.md`: obiettivo, regola d'oro, account; elenco dei moduli.
- `docs/spec/01-fasce-motore.md`: solo quando lavori sul motore, sulle fasce o sui parametri.
- `docs/spec/02-formati.md`: solo quando lavori su formati di gioco o sui loro pesi.
- `docs/spec/03-partite.md`: solo quando lavori su lobby, chiusura, riapertura.
- `docs/spec/04-mazzi-import.md`: solo quando lavori su mazzi, import, wizard.
- `docs/spec/05-ui-responsive.md`: solo quando lavori su interfaccia, layout, pagine, statistiche.
- `docs/spec/06-architettura-dati.md`: solo quando lavori su dati, provider, Actions, sicurezza, build.
- `docs/spec/07-roadmap-decisioni.md`: solo per decisioni e roadmap.

## Decisioni

- Nome dell'app: BLessCommander; organizzazione e repository: `BLessCommander/blesscommander`, `-data`, `-data-test` (privati; il codice diventerà pubblico alla voce C-15).
- Font Inter e Cinzel da pacchetti npm `@fontsource/*` (inclusi nel progetto, nessun CDN).
- `docs/SPEC.md` è solo una nota: la specifica sta in `docs/spec/`.

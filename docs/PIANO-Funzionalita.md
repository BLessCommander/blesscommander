# Piano funzionalità e avanzamento

> Va in `docs/PIANO-Funzionalita.md`. È il registro di avanzamento del progetto: Claude spunta le caselle e aggiorna la sezione "Passaggio di consegne" alla fine di ogni sessione. Ogni nuova sessione parte da qui.

**Legenda**
- `[ ]` da fare · `[~]` in corso · `[x]` fatto e testato
- **Dip.** = funzionalità che devono essere completate prima
- **Spec** = modulo della specifica da leggere (solo quello, non tutta la specifica)
- **Test** = casi d'uso del piano test da coprire

**Definizione di "fatto"** (vale per ogni voce): codice scritto, test unitari e Playwright verdi su profili telefono e desktop, criteri responsive della spec rispettati, nessun errore in console, voce spuntata qui e passaggio di consegne aggiornato.

---

## Fondamenta (bloccanti per tutto il resto)

| ID | Stato | Funzionalità | Dip. | Spec | Test |
|---|---|---|---|---|---|
| B-00 | [x] | Configurazione guidata: strumenti sul PC, account GitHub, organizzazione, repository, permessi (comando `/avvio`) | — | SETUP | — |
| B-01 | [x] | Monorepo, Vite + Vue, ESLint/Prettier, script npm, prima pagina visibile con `npm run dev` | B-00 | 06 | — |
| B-02 | [x] | Suddivisione della specifica in moduli `docs/spec/` e `CLAUDE.md` snello | — | tutta (una volta sola) | — |
| B-03 | [x] | Infrastruttura di test: Vitest, Playwright con 6 profili, finta API GitHub su cartella locale, fixture API esterne, helper responsive e accessibilità, dati di prova | B-01 | 07 | TP §2–§5 |
| B-04 | [x] | Design system e layout responsive (sidebar, header, bottom nav, temi, breakpoint) | B-01 | 05 | UC-30, UC-31, UC-32 |
| B-05 | [x] | Subagent e comandi personalizzati in `.claude/` | B-03 | — | — |
| B-06 | [x] | Livello dati: interfaccia `DataProvider`, `MockProvider`, schemi JSON dei file, adattatori di piattaforma in `web/src/platform/` (versione web) | B-01 | 06 | UT-DATA-* |
| B-08 | [x] | Versione locale completa: modalità demo con dati di prova, `dev:lan` per il telefono, `dev:fake-github`, `preview` con il percorso di GitHub Pages, schermata Ambiente | B-06, B-03 | 06 (§6.11) | UC-27 |
| B-07 | [x] | Repository dati: struttura cartelle, `config/` iniziale, Action `recalc` (validazione, autorizzazioni da autore commit, ricalcolo da zero, scrittura `derived/`), pubblicazione del motore compilato dal repo codice | B-06, C-01 | 06 | UT-ACT-* |
| B-09 | [x] | Pulizia avvisi Sass: sostituire `map-get` con `map.get` (`@use 'sass:map'`) in `web/src/styles/_mixins.scss`, controllare che non restino altri avvisi di deprecazione | B-04 | 05 | UC-30 |
| B-10 | [x] | `GitHubProvider` (lettura/scrittura via API REST, ETag, conflitti) collegato a `dev:fake-github`; collegamento facoltativo al repository reale dalla schermata Ambiente (token in `platform/secure-storage`, bloccato in modalità prova) | B-06, B-08 | 06 | UT-GH-*, UC-27 |
| B-11 | [x] | Usare lo store dati nelle pagine (dashboard, mazzi) al posto dei dati fissi; banner "in aggiornamento" e avviso delle scritture in coda scartate; selettore "Agisci come" in modalità prova (`actingAs`) | B-10 | 05, 06 (§6.7) | UC-27 |
| B-12 | [x] | Cassetto del menu su telefono: padding sotto il notch (`env(safe-area-inset-top)`), maschera che copre anche la barra in basso, cassetto fino al bordo inferiore (emerso dalla revisione screenshot di B-11) | B-04 | 05 | UC-30 |

---

## Core (MVP sullo stadio privato: senza queste l'app non serve al gruppo)

| ID | Stato | Funzionalità | Dip. | Spec | Test |
|---|---|---|---|---|---|
| C-01 | [x] | Motore fasce `packages/tier-engine` (pavimento, TMV, D, decisioni, formati, determinismo, ricalcolo) | B-03 | 01, 02 | UT-ENG-* |
| C-02 | [x] | `GitHubProvider`: lettura snapshot con richieste condizionali, scrittura file con gestione conflitti, coda offline | B-06, B-07 | 06 | UT-GH-*, UC-23, UC-24 |
| C-03 | [x] | Accesso con token GitHub (guida passo passo nella schermata), verifica membro e ruolo, profilo, uscita | C-02, B-04 | 06 | UC-01, UC-02 |
| C-04 | [x] | Gestione membri e ruoli dalla pagina Gruppo (admin), autorizzazioni verificate dall'Action | C-03 | 06 | UC-03, UC-19 |
| C-04b | [x] | Modalità prova: repository `bracketeer-data-test`, 4 utenti finti, selettore "Agisci come" per i `testOperators`, `actingAs` accettato dall'Action solo con `testMode`, banner di ambiente. **Fatto:** banner rosso "MODALITÀ PROVA", selettore, `actingAs` nell'Action, UC-26 e UT-ACT-TEST. **Il collegamento al repository di prova e UC-25 sono in C-04b2** | C-04 | 06 (§6.7) | UC-25, UC-26, UT-ACT-TEST |
| C-04b2 | [~] | Completare la modalità prova. **Fatto:** casella "Collega il repository di prova" nella pagina Accesso (`checkRepository` con `testRepo`: il repository di prova DEVE avere `testMode`, quello reale NON deve averlo), flag salvato col token, ambiente `REPOSITORY DI PROVA`, `npm run build:data-repo:test` (template di prova con `testMode`, proprietario come operatore e 4 utenti finti). **Resta:** UC-25 completo (lobby e chiusura come registratore) quando esiste C-05; pubblicare i dati iniziali su `-data-test` (chiede conferma, regola 11) | C-04b, C-05 | 06 (§6.7) | UC-25 |
| C-04d | [ ] | Stabilizzare il test `access.spec.js` "accede, resta dentro dopo il riavvio…": a volte va in timeout su `Token personale` sotto carico (visto su vari profili), ripassa da solo; trovare la causa (probabile corsa tra `reload` e `goto`) | C-03 | 06 | UC-01 |
| C-04c | [x] | Centro notifiche in-app: pagina `/notifiche` e campanella con contatore nell'header (desktop e telefono), elenco con letto/non letto e azioni dentro la notifica (es. rispondi sì/no a una richiesta), tipi estendibili (cambi fascia, riapertura, contestazione, richiesta di sostituzione admin). Silenziate per chi è in una partita in corso (regola 1). Stesso stile della UI esistente; da decidere in spec 06 dove si salva lo stato letto/non letto | C-04 | 05, 06, 03 | UC-65 |
| C-05 | [ ] | Import mazzo da testo + arricchimento Scryfall + rilevamento game changer | C-04 | 04 | UC-04 |
| C-06 | [ ] | Import da Archidekt (diretto dal browser o tramite Action `import`) | C-05, B-07 | 04, 06 | UC-05 |
| C-07 | [ ] | Wizard di autovalutazione e calcolo pavimento | C-05, C-01 | 01, 04 | UC-07 |
| C-08 | [ ] | Lista mazzi e scheda mazzo (metriche, storico fasce, grafici base) | C-07 | 04, 05 | UC-18 |
| C-09 | [ ] | Lobby: formato (tutti contro tutti 3/4/5–6, 1v1), giocatori, mazzi, registratore, "Inizia" con promemoria dado | C-08 | 03, 02 | UC-09 |
| C-10 | [ ] | Chiusura partita in 3 tocchi (turno da dado o stima), solo registratore, anteprima locale e stato "in aggiornamento" fino al ricalcolo dell'Action | C-09, C-01, B-07 | 03 | UC-10, UC-11, UC-12, UC-13, UC-14 |
| C-11 | [ ] | Eventi di fascia con spiegazione leggibile + notifiche dei cambi di fascia (usa il centro notifiche C-04c) | C-10, C-04c | 01, 03 | UC-15, UC-16, UC-20 |
| C-12 | [ ] | Dashboard (KPI, andamento, ultime partite, partita in corso) | C-10 | 05 | UC-17 |
| C-13 | [ ] | Storico partite con filtri | C-10 | 03 | UC-21 |
| C-14 | [ ] | Pagina Regolamento generata dai parametri + pagina Gruppo con parametri del motore | C-03, C-01 | 01, 02 | UC-22 |
| C-15 | [ ] | Pubblicazione: scansione segreti, repository del codice reso pubblico (con conferma), GitHub Pages via Actions, CI con test, pubblicazione automatica del motore nel repo dati | C-01…C-14 | 06 (§6.11) | CI, UC-28 |

---

## Secondarie (dopo l'MVP, in ordine di priorità consigliato)

| ID | Stato | Funzionalità | Dip. | Spec | Test |
|---|---|---|---|---|---|
| S-01 | [ ] | Import Moxfield tramite Action con ripiego guidato sull'import da testo | C-06 | 04 | UC-06 |
| S-02 | [ ] | Reimport e versioni del mazzo con diff (ritorno a Provvisorio oltre 10 carte) | C-08 | 04 | UC-08 |
| S-03 | [ ] | Riapertura partita con voto unanime e ricalcolo dello storico | C-11 | 03, 01 | UC-40 |
| S-04 | [ ] | Contestazione dei cambi di fascia con voto | C-11 | 01 | UC-41 |
| S-05 | [ ] | Formati a squadre (2v2, Emperor), Star, vittorie condivise | C-10 | 02 | UC-42 |
| S-06 | [ ] | Formati a ruoli (Treachery, Archenemy) con distribuzione segreta dei ruoli in lobby | S-05 | 02 | UC-43 |
| S-07 | [ ] | Varianti (Planechase, personalizzate) e formati personalizzati | S-05 | 02 | UC-44 |
| S-08 | [ ] | Tavolo bilanciato e randomizzatore posti | C-09 | 05 | UC-45 |
| S-09 | [ ] | Statistiche avanzate e classifiche (per fascia, formato, head-to-head, % turni da dado) | C-12 | 05 | UC-46 |
| S-10 | [ ] | Rilevamento combo (Commander Spellbook) nel pavimento | C-07 | 04 | UC-47 |
| S-11 | [ ] | PWA installabile e registrazione offline | C-10 | 05 | UC-48 |
| S-12 | [ ] | Simulatore "e se…" | C-01, C-08 | 01 | UC-49 |
| S-13 | [ ] | Taratura automatica dei fattori turno | S-09 | 02 | UC-50 |
| S-14 | [ ] | Stagioni | S-09 | 05 | UC-51 |
| S-15 | [ ] | Export CSV/JSON e backup del gruppo | C-13 | 05 | UC-52 |
| S-16 | [ ] | Serate con presenze | C-03 | 05 | UC-53 |

---

## Evoluzione (stadi 2 e 3)

| ID | Stato | Funzionalità | Dip. | Spec | Test |
|---|---|---|---|---|---|
| E-01 | [ ] | App Android e iOS con Capacitor: adattatori di piattaforma nativi, archivio sicuro del token, icone e schermata di avvio, build di prova | C-15, S-11 | 06 (§6.9) | UC-60 |
| E-02 | [ ] | `FirebaseProvider`, script di migrazione JSON → Firestore, regole Firestore | C-15 | 06 (§6.10) | UC-61 |
| E-03 | [ ] | Backend per validazione, ricalcolo e import (spostato dalle Actions) | E-02 | 06 (§6.10) | UC-62 |
| E-04 | [ ] | Login pubblico con **Google** (versione finale; il token GitHub resta solo per lo sviluppo) e **gruppi multipli**: ogni utente può stare in più gruppi, ogni gruppo con codice invito | E-02 | 06, 04 | UC-63 |
| E-05 | [ ] | Preparazione store: requisiti Wizards Fan Content Policy, Scryfall, privacy policy, schede store | E-01, E-04 | 06 (§6.9) | — |
| E-06 | [ ] | Governance dell'admin di gruppo: alla creazione del gruppo si designa l'admin; da lì solo l'admin può dare il ruolo admin. Sostituzione: se **tutti** i giocatori tranne l'admin fanno richiesta e rispondono sì, l'ultimo che dà il consenso diventa admin. Regola verificata dall'Action/backend, non solo dall'interfaccia | E-04, C-04c | 06, 03 | da definire (UC-64) |

---

## Passaggio di consegne

> Aggiornato da Claude a fine sessione. Massimo 15 righe: è ciò che la sessione successiva legge per ripartire senza rileggere tutto.

- **Ultima voce lavorata:** C-04c (fatta). C-04b2 resta `[~]` (UC-25 aspetta C-05).
- **Stato:** B-01–B-12, C-01–C-04c fatte. Vitest 169 verdi; Playwright 241 verdi sui 6 profili (poi rieseguiti i test notifiche: verdi); lint verde. Revisione screenshot superata (restano note basse: bordo di "Segna tutte come lette" nel tema scuro, card un po' alte su telefono). `access.spec.js` "accede, resta dentro…" ancora instabile (C-04d).
- **File principali:** `web/src/data/notifications-rules.js`, `data-provider.js`/`mock-provider.js`/`github-provider.js` (`getNotifications`, `markNotificationsRead`, `answerNotification`), `schemas.js`, `stores/data.js`, `views/NotificationsView.vue`, `components/layout/AppHeader.vue` (campanella), `tests/e2e/notifications.spec.js`, `tests/e2e/fixtures.js`.
- **Scelte:** notifiche create dalle Actions in `derived/notifications/<login>.json`; stato letto/risposte in `users/<login>/notifications.json` (scritto dal giocatore); `recalc` ignora `users/`. Specifiche in spec 06 §6.4b e spec 05 §5.4.
- **Problemi aperti:** nessuna Action genera ancora notifiche (arrivano con C-11 ed E-06). Pausa in partita coperta da Vitest, non da Playwright (manca la lobby). `-data-test` ancora da popolare (chiede conferma); il motore nel repository dati reale è vecchio.
- **Prossimo passo consigliato:** C-05 (import mazzo da testo + Scryfall), poi chiudere C-04b2 con UC-25; C-04d quando serve.

---
description: Configurazione guidata di GitHub (account, organizzazione, repository) e avvio dello sviluppo
---

# /avvio — Configurazione guidata e avvio del progetto

Questo comando ha due parti. Esegui la Parte 1 fino in fondo prima di passare alla Parte 2.

## Parte 1 — Configurazione guidata (voce B-00 del piano)

Sei una guida paziente per una persona che non ha mai configurato GitHub in modo avanzato. Parli in italiano, in modo semplice e concreto.

### Regole della guida
- **Un passo alla volta.** Per ogni passo: spiega in 1–3 frasi cosa facciamo e perché, dai le istruzioni, poi **fermati e aspetta** la risposta prima di andare avanti.
- **Verifica tu quando puoi.** Dopo ogni passo controlla con un comando (es. `git --version`, `gh auth status`, `gh api ...`) invece di fidarti e basta. Se la verifica fallisce, spiega il problema e come risolverlo.
- **Chiedi conferma prima di ogni comando che crea o modifica qualcosa** sul PC (git config) o su GitHub (repository, impostazioni). Mostra il comando e cosa fa.
- **Mai token o password in chat.** Se l'utente sta per incollarne uno, fermalo: i token si inseriscono solo nell'app o nei secret di GitHub.
- **Le azioni che richiedono il browser** (registrazione, creazione organizzazione, alcune impostazioni) le fa l'utente: dagli il percorso esatto dei menu e aspetta che confermi.
- **Comandi interattivi** come `gh auth login` vanno eseguiti dall'utente nel terminale di VS Code (menu Terminale → Nuovo terminale), non da te.
- **Salva i progressi** dopo ogni passo completato in `docs/progetto.json` (solo dati non segreti). Se il file esiste già, leggilo e riparti dal primo passo non completato, dicendo all'utente dove eravate rimasti.
- Se l'utente vuole fermarsi, salva i progressi e digli che basta rilanciare `/avvio`.

Formato di `docs/progetto.json`:
```json
{
  "appName": "Bracketeer",
  "org": "",
  "ownerLogin": "",
  "repos": { "code": "", "data": "", "test": "" },
  "onboarding": { "completedSteps": [], "completedAt": null }
}
```

### Passi

**1. Benvenuto.** Presentati in due righe, spiega che configureremo GitHub in circa 8 passi e che alla fine si inizia a sviluppare. Controlla `docs/progetto.json` per un'eventuale ripresa.

**2. Strumenti sul PC.** Esegui `git --version`, `node --version`, `npm --version`, `gh --version`. Per ognuno mancante indica dove scaricarlo (git-scm.com, nodejs.org versione LTS, cli.github.com) e aspetta. Node deve essere una versione LTS attuale; se è troppo vecchio, chiedi di aggiornarlo. Dopo un'installazione ricorda di chiudere e riaprire VS Code se il comando non viene trovato.

**3. Account GitHub.** Chiedi se ha già un account GitHub.
- Se no: registrazione su github.com/signup, poi aspetta.
- Spiega che i Termini di GitHub permettono **un solo account gratuito per persona** (più al massimo un account "macchina" per automazioni): gli account di prova **non** vanno creati, li gestirà l'app con utenti finti (modalità prova, SPEC §6.7).
- Consiglia di attivare l'autenticazione a due fattori: foto profilo → Settings → Password and authentication. Aspetta conferma.
- Consiglia di attivare l'email privata: Settings → Emails → "Keep my email addresses private", e annotare l'indirizzo `...@users.noreply.github.com` per il passo 4.

**4. Identità di Git.** Controlla `git config --global user.name` e `user.email`. Se mancano, chiedi nome ed email (consiglia l'indirizzo noreply) e, con conferma, impostali.

**5. Accesso a GitHub dal PC.** Esegui `gh auth status`.
- Se non è collegato: chiedi all'utente di eseguire nel terminale di VS Code `gh auth login` scegliendo GitHub.com, HTTPS, "Login with a web browser", e di confermare quando ha finito.
- Servono anche i permessi per gestire l'organizzazione e i workflow: chiedi di eseguire `gh auth refresh -h github.com -s admin:org,workflow` e di completare nel browser.
- Verifica con `gh auth status` e salva il login in `ownerLogin`.

**6. Nome dell'app e organizzazione.**
- Chiedi il nome dell'app (proposta: "Bracketeer", si può cambiare in futuro) e salvalo.
- Spiega in breve perché serve un'organizzazione: i token personali fine-grained, con cui gli amici accederanno solo ai dati, funzionano solo su repository di un'organizzazione di cui sono membri; inoltre permette team con permessi diversi. È gratuita.
- Chiedi il nome desiderato (solo minuscole, numeri e trattini; es. `<nomeapp>-gruppo`). Controlla con `gh api orgs/<nome>`: se esiste già e non è sua, proponi un'alternativa.
- L'organizzazione si crea solo dal browser: indica github.com/account/organizations/new → piano **Free** → nome scelto → email di contatto → "My personal account". Aspetta conferma.
- Verifica con `gh api user/memberships/orgs/<nome>`: il ruolo deve essere `admin`. Salva `org`.

**7. Impostazioni dell'organizzazione.**
- Con conferma, esegui:
  `gh api -X PATCH orgs/<org> -f default_repository_permission=none -F members_can_create_repositories=false`
  Spiega: i membri vedranno solo i repository assegnati tramite team e non potranno crearne di nuovi.
- Poi dal browser: pagina dell'organizzazione → **Settings → Personal access tokens → Settings**: consentire i token fine-grained (scegliere se richiedere l'approvazione: consiglia "senza approvazione" per semplicità, si può cambiare); limitare i token "classic". Aspetta conferma.

**8. Repository.** Spiega i tre repository e la scelta su GitHub Pages:
- `<app>` (codice): **privato** durante lo sviluppo locale; al momento della pubblicazione (voce C-15) diventerà **pubblico**, perché GitHub Pages gratuito pubblica solo da repository pubblici. Contiene solo codice, nessun dato né segreto.
- `<app>-data` (dati reali): **sempre privato**.
- `<app>-data-test` (dati di prova con utenti finti): **sempre privato**.
I nomi usano il nome dell'app in minuscolo; chiedi se vanno bene. Poi, con conferma, uno alla volta:
1. Se la cartella non è ancora un repository Git: `git init -b main`, `git add .`, `git commit -m "Documentazione iniziale"`.
2. `gh repo create <org>/<app> --private --source=. --remote=origin --push`
3. `gh repo create <org>/<app>-data --private --add-readme`
4. `gh repo create <org>/<app>-data-test --private --add-readme`
5. Per i due repository dati, permesso di scrittura alle Actions (servirà per salvare le fasce ricalcolate):
   `gh api -X PUT repos/<org>/<repo>/actions/permissions/workflow -f default_workflow_permissions=write`
Verifica con `gh repo list <org>` e salva i nomi in `repos`.

**9. Riepilogo.** Mostra cosa è stato configurato e cosa arriverà più avanti, senza farlo ora:
- token personali e secret `DATA_REPO_TOKEN`: alla voce B-07;
- utenti di prova e modalità prova: alla voce C-04b;
- pubblicazione su GitHub Pages: alla voce C-15;
- inviti agli amici e team `giocatori`: quando l'app sarà pronta (docs/SETUP-GitHub.md, percorso C).
Segna B-00 come fatta in `docs/PIANO-Funzionalita.md`, imposta `completedAt` in `docs/progetto.json`, fai commit e push con conferma ("Configurazione completata").

**10. Passaggio allo sviluppo.** Chiedi: "Procediamo con lo sviluppo?" Se sì, esegui la Parte 2. Se no, digli che può ripartire con `/avvio` (che salterà la Parte 1 già completata) quando vuole.

---

## Parte 2 — Avvio dello sviluppo (voci B-01, B-02, B-05)

Se la Parte 1 risulta già completata in `docs/progetto.json`, parti direttamente da qui.

Sei un senior full-stack developer. Costruiamo "Bracketeer", una web app per un gruppo di amici che gioca a Magic: The Gathering Commander: account, import mazzi da Archidekt/Moxfield, registrazione partite e fasce (F1–F5) promosse/declassate automaticamente.

Documenti in docs/:
- SPEC.md: specifica completa, fonte di verità.
- PIANO-Funzionalita.md: backlog diviso in Fondamenta (B), Core (C) e Secondarie (S), con dipendenze, modulo di specifica e casi di test per ogni voce. È anche il registro di avanzamento.
- PIANO-Test.md: strategia di test, profili Playwright, controlli automatici, revisione screenshot, casi d'uso.

Architettura in breve (dettagli in SPEC §6): nello stadio attuale NON usiamo Firebase né un backend. I dati sono file JSON in un repository privato separato (bracketeer-data) dentro un'organizzazione GitHub; l'app li legge e scrive con l'API REST di GitHub usando il token personale di ogni utente; i calcoli ufficiali (validazione, autorizzazioni, ricalcolo fasce, import) li fanno GitHub Actions nel repository dati. Il codice deve poter passare in futuro a Firebase (FirebaseProvider) e ad app Android/iOS con Capacitor senza riscritture.

Leggi docs/progetto.json: contiene nome dell'app, organizzazione e repository scelti nella Parte 1. Se il nome dell'app è diverso da "Bracketeer", usa quello nel codice e nell'interfaccia (nei documenti resta Bracketeer, non serve modificarli).

In questa sessione fai SOLO le voci B-01, B-02 e B-05, poi fermati. Prima di scrivere codice leggi SPEC.md per intero (è l'unica volta che lo leggi tutto) e presentami un piano breve; aspetta la mia approvazione. La voce B-01 termina con una prima pagina visibile: dimmi il comando da lanciare e l'indirizzo da aprire nel browser.

## B-02: specifica a moduli e CLAUDE.md
1. Dividi SPEC.md in docs/spec/ senza cambiare il contenuto:
   00-indice.md, 01-fasce-motore.md (§2–§3.9), 02-formati.md (§3.10), 03-partite.md (§4.3), 04-mazzi-import.md (§4.2 + parti di §3.2), 05-ui-responsive.md (§4.4–§4.7, §5), 06-architettura-dati.md (§6), 07-roadmap-decisioni.md (§7–§8). Poi sostituisci SPEC.md con una nota che rimanda a docs/spec/.
2. Crea CLAUDE.md, MASSIMO 150 righe, con solo:
   - descrizione in 3 righe del progetto;
   - stack e comandi (dev, dev:lan, dev:fake-github, preview, build, test unitari, test e2e, seed);
   - struttura cartelle;
   - le REGOLE NON NEGOZIABILI (sotto), in forma sintetica;
   - convenzioni di codice;
   - "Protocollo di sessione" (sotto);
   - indice dei documenti con "quando leggerlo" (es. "docs/spec/02-formati.md: solo quando lavori su formati o motore");
   - sezione "Decisioni" (vuota, una riga per decisione).
   Non mettere in CLAUDE.md contenuti che stanno già nella specifica: rimanda al modulo.

## Regole non negoziabili
1. ZERO interazioni con l'app durante la partita. Tutto in lobby (prima) o chiusura (dopo, in 3 tocchi). Unica azione durante il gioco: il registratore gira un dado fisico per contare i turni. Se una funzione richiede il telefono durante la partita, fermati e proponimi un'alternativa.
2. DESKTOP + MOBILE AL 100%, requisito bloccante: ogni funzione disponibile su entrambi, criteri di docs/spec/05-ui-responsive.md §5.3 rispettati, verificati con i test del piano. Progettazione mobile first.
3. I dati derivati (derived/: fasce, metriche, eventi) li scrive solo l'Action di ricalcolo, che riparte sempre da zero sullo storico; solo il registratore chiude una partita (verificato dall'Action tramite l'autore del commit); riapertura solo all'unanimità; motore deterministico.
4. Design ispirato a Nalika e CoreUI ma scritto da zero: nessun codice, CSS o asset copiato, niente Bootstrap/CoreUI come dipendenza.
5. Nessun test chiama servizi esterni reali: fixture e finta API GitHub su cartella locale (docs/PIANO-Test.md §1).
6. Una funzionalità non è finita finché i test unitari e Playwright sui 6 profili non sono verdi e la revisione screenshot non è passata.
7. Nessun componente o store importa codice specifico di GitHub o Firebase: tutto passa dall'interfaccia DataProvider (SPEC §6.3). Ogni funzione del dispositivo passa dagli adattatori in web/src/platform/ (SPEC §6.9). Niente alert/confirm del browser, niente font o librerie da CDN, routing hash: l'app deve poter diventare un'app Capacitor senza modifiche.
8. Il token GitHub dell'utente non viene mai loggato, mostrato in chiaro o inviato a domini diversi da api.github.com. Nessun segreto nel repository del codice: diventerà pubblico per GitHub Pages.
9. Gli utenti di prova non sono account GitHub reali (i Termini di GitHub permettono un solo account gratuito per persona): sono membri finti del repository dati di prova usati con "Agisci come" (SPEC §6.7). La modalità prova deve essere impossibile da attivare sul repository dei dati reali.
10. VERSIONE LOCALE SEMPRE FUNZIONANTE: dalla voce B-01 in poi `npm run dev` deve avviare l'app in modalità demo senza alcuna configurazione. A fine di ogni voce dimmi cosa posso vedere in locale e come aprirlo anche dal telefono (SPEC §6.11).
11. Prima di qualunque comando che crea o modifica qualcosa su GitHub (repository, impostazioni, visibilità, secret) spiegami cosa fa e chiedi conferma.

## Stack
Vue 3 + Vite (percorso di base configurabile per GitHub Pages) (<script setup>, JavaScript con JSDoc), Pinia, Vue Router in hash mode, Chart.js via vue-chartjs, SCSS con design system proprio e font inclusi nel progetto, API REST di GitHub (fetch diretto, nessun SDK pesante), GitHub Actions con Node LTS per gli script del repository dati, Capacitor predisposto (configurazione e adattatori, piattaforme native aggiunte nella voce E-01), Vitest, Playwright, @axe-core/playwright. Monorepo con npm workspaces: packages/tier-engine, web/, data-actions/ (script delle Actions e template del repository dati), tests/ (e2e, fake-github, fixtures).
Per lo sviluppo locale l'app usa MockProvider o la finta API GitHub con i dati di seed: non serve il repository dati reale finché non lo indico io.

## Protocollo di sessione (da scrivere in CLAUDE.md e seguire sempre)
- Inizio: leggi CLAUDE.md e SOLO la sezione "Passaggio di consegne" + la riga della voce di lavoro in docs/PIANO-Funzionalita.md. Leggi solo i moduli di specifica e i casi di test indicati per quella voce.
- Lavori su UNA voce del piano per sessione. Se scopri lavoro extra, aggiungilo al piano come nuova voce invece di farlo subito.
- Leggi i file per intervalli di righe quando sono lunghi; usa ricerche mirate invece di aprire cartelle intere; non leggere mai node_modules, dist, coverage, test-results, playwright-report, lockfile.
- Test: esegui SEMPRE tramite il subagent test-runner; riesegui solo i falliti; non incollare mai log completi nella conversazione.
- Screenshot: analizzali SEMPRE tramite il subagent ui-reviewer, mai nella conversazione principale.
- Esplorazioni ampie del codice (capire come funziona una parte esistente): usa un subagent e fatti restituire solo il riassunto.
- Fine: spunta la voce, aggiorna "Passaggio di consegne" (max 15 righe), aggiungi le decisioni in CLAUDE.md, proponi il messaggio di commit, dimmi cosa provare a mano e di eseguire /clear.

## B-05: subagent e comandi in .claude/
Crea questi subagent in .claude/agents/ (ognuno con descrizione chiara di quando usarlo e con i soli strumenti necessari; per test-runner, se disponibile, usa un modello più economico):
- test-runner: esegue i test richiesti (Vitest o Playwright, con progetto e tag), usa reporter sintetici, e restituisce SOLO: totale passati/falliti per profilo, e per ogni fallito file, titolo, profilo, prima riga d'errore utile e percorso dello screenshot/trace. Massimo 30 righe.
- ui-reviewer: dato un elenco di screenshot (percorsi), li apre, li valuta con la checklist di docs/PIANO-Test.md §5 e restituisce SOLO i problemi trovati (schermata, profilo, tema, problema, gravità, suggerimento). Se non ci sono problemi, una riga.
- code-explorer: esplora il codice per rispondere a una domanda precisa e restituisce un riassunto con percorsi e righe rilevanti, senza incollare file interi.

Crea questi comandi in .claude/commands/:
- /riprendi: applica il protocollo di inizio sessione e proponi il piano della prossima voce (o di quella indicata come argomento).
- /testa <ID>: esegue il ciclo di docs/PIANO-Test.md §6 per la voce indicata tramite test-runner.
- /revisione-ui <ID>: genera gli screenshot delle schermate toccate dalla voce (profili iphone e desktop-chrome, tema chiaro e scuro) e li passa a ui-reviewer.
- /consegna: applica il protocollo di fine sessione.

Configura anche .claude/settings.json per negare la lettura di node_modules, dist, coverage, test-results, playwright-report, android, ios e dei file .env.

Inizia leggendo docs/progetto.json, docs/SPEC.md e i due piani, poi presentami il piano della sessione.
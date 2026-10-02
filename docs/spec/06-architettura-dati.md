# Architettura tecnica e dati (SPEC §6)

## 6. Architettura tecnica

### 6.1 Tre stadi, un solo codice

| Stadio | Dati e accesso | Hosting | Quando |
|---|---|---|---|
| **0. Locale** | Dati di prova sul tuo PC (modalità demo) oppure il repository dati reale | Il tuo PC (`npm run dev`), visibile anche dal telefono sulla stessa rete Wi-Fi | Dal primo giorno di sviluppo |
| **1. Privato** | File JSON in un repository Git privato; accesso con l'account GitHub di ogni amico; calcoli ufficiali con GitHub Actions | GitHub Pages (repository del codice reso pubblico, dati sempre privati) | Uso nel gruppo |
| **2. App mobile** | Come lo stadio 1 | App Android e iOS generate con Capacitor dallo stesso codice | Quando il web è stabile |
| **3. Pubblico** | Firebase Auth + Firestore, migrazione automatica dei JSON | Web + store Android e iOS | Se tutto va bene |

Il codice è scritto fin dall'inizio per attraversare i tre stadi **senza riscritture**: l'interfaccia non sa dove stanno i dati (§6.3) e non usa nulla che non funzioni in un'app nativa (§6.9).

Niente Firebase e niente Render negli stadi 0 e 1: serve solo GitHub, costo zero.

### 6.2 Stack

| Livello | Scelta | Perché |
|---|---|---|
| Frontend | **Vue 3 + Vite** (Composition API) | Semplice, build statica, compatibile con Capacitor |
| Stato | Pinia | Standard di Vue |
| Routing | Vue Router in **modalità hash** | Funziona su qualunque hosting statico e dentro le app native |
| Grafici | Chart.js (via vue-chartjs) | Leggero |
| Stile | SCSS con design system proprio, font inclusi nel progetto (non da CDN) | Nessun template copiato; funziona offline e nelle app |
| App native | **Capacitor** | Trasforma la build web in app Android e iOS |
| Dati stadio 1 | Repository Git privato + **API REST di GitHub** dal browser | Nessun database, storia completa di ogni modifica |
| Calcoli stadio 1 | **GitHub Actions** nel repository dati | Fanno il lavoro del backend: ricalcolo fasce, validazione, import |
| Dati stadio 3 | Firebase Auth + Firestore | Login pubblico, tempo reale, scalabilità |
| Test | Vitest + Playwright | Vedi piano test |
| Hosting | Locale con Vite (stadio 0), **GitHub Pages** (stadio 1) | GitHub Pages gratuito pubblica solo da repository pubblici: il repository del codice diventa pubblico al momento della pubblicazione, i dati restano privati |

### 6.3 Livello dati intercambiabile (DataProvider)

Tutta l'app parla con i dati attraverso un'unica interfaccia, `DataProvider`. Le pagine e gli store Pinia non importano mai codice specifico di GitHub o Firebase.

| Operazione | Descrizione |
|---|---|
| `getCurrentUser()` | Utente collegato e suo ruolo |
| `getSnapshot()` | Stato calcolato del gruppo (mazzi con fasce e metriche, classifiche, ultime partite) |
| `getDeck(id)`, `saveDeck(deck)`, `saveDeckVersion(id, version)` | Mazzi e versioni |
| `createGame(game)`, `updateGame(id, patch)` | Lobby, avvio, chiusura, correzioni |
| `vote(kind, targetId, value)` | Voti di riapertura e contestazione |
| `requestImport(source, url)` | Import che il browser non può fare da solo |
| `getConfig()`, `saveConfig(config)` | Parametri del motore e formati (solo admin) |
| `onSnapshotChange(callback)` | Aggiornamenti: polling nello stadio 1, tempo reale nello stadio 3 |

Implementazioni:
- **`GitHubProvider`** (stadio 1–2);
- **`MockProvider`** in memoria, per i test e per lo sviluppo senza rete;
- **`FirebaseProvider`** (stadio 3).

Il formato dei dati è **identico** nei tre casi: un file JSON corrisponde a un documento, una cartella a una collezione. Per questo la migrazione allo stadio 3 è uno script di copia.

### 6.4 Repository e struttura dei dati

Repository privati dentro un'**organizzazione GitHub gratuita**:

| Repository | Contenuto | Chi accede |
|---|---|---|
| `bracketeer` | Codice dell'app | Privato durante lo sviluppo locale; **pubblico** da quando si pubblica su GitHub Pages (contiene solo codice, nessun dato né segreto) |
| `bracketeer-data` | Solo i dati del gruppo | Tu come admin, gli amici con permesso di scrittura |
| `bracketeer-data-test` | Dati di prova in modalità prova (§6.7) | Solo tu |

Separarli evita che chi gioca possa modificare il codice e rispecchia già la futura separazione app/database.

Struttura di `bracketeer-data`:

```
config/group.json                 nome del gruppo, parametri del motore (§3.9), formati (§3.10)
config/members.json               login GitHub → nome visualizzato, avatar, ruolo (admin | giocatore)
decks/<deckId>.json               dati del mazzo inseriti dal proprietario
decks/<deckId>/v<N>.json          versioni della lista
games/<AAAA>/<MM>/<gameId>.json   una partita per file
votes/<targetId>/<login>.json     un voto per file (riaperture e contestazioni)
requests/<requestId>.json         richieste di import da elaborare
engine/tier-engine.mjs            motore fasce compilato, pubblicato dal repository del codice
derived/                          SCRITTO SOLO DALLE ACTIONS
  snapshot.json                   tutto ciò che serve alla dashboard in una sola lettura
  decks/<deckId>.json             fascia, metriche, stato, badge
  events.json                     eventi di fascia con spiegazioni
  stats.json                      statistiche e classifiche
  errors.json                     file non validi o modifiche non autorizzate rilevate
  notifications/<login>.json      notifiche di ogni giocatore (generate dalle Actions)
users/<login>/notifications.json  stato personale: notifiche lette e risposte date (scritto solo da quel giocatore)
.github/workflows/                recalc.yml, import.yml
schemas/                          schema JSON di ogni tipo di file
```

**Un file per partita e un file per voto:** scritture contemporanee di persone diverse non si scontrano mai. Gli identificativi sono generati sul dispositivo (ULID), quindi unici anche offline.

I campi di ogni file sono quelli del modello dati in §6.6.

**Notifiche (§6.4b):** le notifiche sono eventi creati dalle Actions in `derived/notifications/<login>.json` (`{ items: [{ id, type, createdAt, params, actions? }] }`; `type` è estendibile: `tier-change`, `reopen`, `dispute`, `admin-replacement`, `info`). Lo stato personale sta in `users/<login>/notifications.json` (`{ readIds: [id], answers: { id: "yes"|"no" } }`), scritto solo dal giocatore stesso (e da lui "agendo come" in modalità prova). L'app unisce i due file; un file mancante vale "nessuna notifica / nessuna letta". L'Action `recalc` ignora `users/`. Chi ha una partita in `lobby` o `in_corso` non vede contatore né elenco finché non la chiude (regola 1).

### 6.5 Come funzionano letture e scritture (stadio 1)

**Lettura:** l'app scarica `derived/snapshot.json` con una sola richiesta all'API di GitHub. Le richieste successive sono condizionali: se il file non è cambiato, GitHub risponde "non modificato" senza consumare il limite di richieste.

**Scrittura:** l'app crea o aggiorna il file con l'API dei contenuti di GitHub; ogni salvataggio è un commit firmato dall'account dell'amico. Per i file condivisi (es. `config/group.json`) si passa la versione letta: se nel frattempo qualcuno l'ha cambiato, l'app rilegge, riapplica la modifica e riprova (massimo 3 volte).

**Calcolo ufficiale:** ogni push che tocca `games/`, `decks/`, `votes/` o `config/` avvia l'Action `recalc`, che:
1. valida ogni file con il suo schema;
2. verifica le autorizzazioni usando l'autore dei commit: una chiusura di partita fatta da chi non è il registratore, o una modifica a `config/` fatta da chi non è admin, viene ignorata e annotata in `derived/errors.json`;
3. ricalcola **da zero** tutto lo storico con il motore (deterministico, §3.7);
4. scrive `derived/` e fa commit.

Le esecuzioni sono messe in coda (mai due in parallelo). Il ricalcolo da zero rende i dati derivati sempre coerenti con lo storico, anche se qualcuno modificasse `derived/` a mano. Per un gruppo di amici il costo in minuti di Actions è trascurabile rispetto alla quota gratuita.

**Tempo di attesa:** l'Action impiega circa un minuto. Nel frattempo l'app calcola il risultato in locale con lo stesso motore e lo mostra subito con l'indicazione "in aggiornamento"; quando arriva il nuovo snapshot l'indicazione sparisce.

**Offline:** le scritture fatte senza rete vanno in una coda sul dispositivo e partono al ritorno della connessione.

### 6.6 Modello dati (identico in JSON e in Firestore)

```
config/group
  name, settings (parametri §3.9), formats[] (§3.10), variants[]

config/members
  { <githubLogin>: { displayName, avatarUrl, role: admin|giocatore, joinedAt } }

decks/{deckId}
  ownerLogin, name, commanders[], colorIdentity[]
  source{ type: archidekt|moxfield|text, url, importedAt }
  currentVersion, declaredTier, selfAssessment{ mld, extraTurns, notes }

decks/{deckId}/v{N}
  cards[{ name, qty, scryfallId, isGameChanger }]
  gameChangers[], combos[], flags{ mld, extraTurns }, floor, diff{ added[], removed[] }

games/{gameId}
  formatId, variants[], recorderLogin, createdBy
  status: lobby | in_corso | ufficiale | riaperta | annullata
  createdAt, startedAt, endedAt
  players[{ login, deckId, tierAtGame, seat, team?, role?, eliminatedTurn?, eliminatedBy? }]
  winners[{ login, deckId }], winningTeam?, winningRole?
  winTurn, turnSource: dado | stima, estimatedTurn, winType, notRepresentative, notes
  actingAs?                    (solo in modalità prova, §6.7)
  revision                     (numero di correzione; lo storico completo è nella storia Git)

votes/{targetId}/{login}
  kind: riapertura | contestazione, value: true|false, reason?, createdAt

derived/decks/{deckId}
  tier{ current, floor, speedTier, tmv, dominance, status, badges[], gamesSinceChange, lastChangeAt }
  stats{ games, wins, winTypes{...} }

derived/events
  [{ id, deckId, gameId, from, to, reasons[], metricsSnapshot, createdAt, cancelled? }]
```

### 6.7 Accesso e sicurezza (stadio 1)

- **Chi entra:** solo i membri dell'organizzazione GitHub che hai invitato e che compaiono in `config/members.json`.
- **Login:** al primo accesso ogni amico incolla nell'app un **token personale fine-grained** creato sul suo account GitHub (proprietario della risorsa: l'organizzazione; accesso: solo `bracketeer-data`; permesso: contenuti in lettura e scrittura; con scadenza). L'app verifica chi è e se è nell'elenco membri. Una guida passo passo con immagini è nella schermata di login.
- **Conservazione del token:** solo sul dispositivo (nel browser nello stadio 1, nell'archivio sicuro del sistema nelle app native). Non viene mai inviato a servizi diversi da GitHub.
- **Revoca:** togli l'amico dall'organizzazione o dal team e perde subito l'accesso.
- **Limite consapevole:** chi ha il permesso di scrittura può tecnicamente modificare file a mano. Le Actions validano tutto e ricalcolano da zero, e Git registra autore e data di ogni modifica: per un gruppo di amici è più che sufficiente. Nello stadio 3 le regole di Firestore renderanno il controllo rigido.
- L'app imposta una Content Security Policy restrittiva per ridurre il rischio che codice estraneo legga il token.

**Modalità prova (utenti di prova senza account GitHub aggiuntivi)**

I Termini di GitHub consentono un solo account gratuito per persona, quindi gli utenti di prova non sono account GitHub ma **membri finti** di un repository dati dedicato.
- Esiste un terzo repository privato, `bracketeer-data-test`, con la stessa struttura di `bracketeer-data` e in `config/group.json` il campo `testMode: true` più l'elenco `testOperators` (i login reali autorizzati a fare prove, cioè tu).
- `config/members.json` di prova contiene utenti con login fittizi preceduti da `test-` (es. `test-admin`, `test-giocatore1`, `test-giocatore2`, `test-giocatore3`), con i loro ruoli.
- Quando l'app è collegata a un repository in modalità prova, chi è in `testOperators` vede nell'header un selettore **"Agisci come"** per scegliere l'utente di prova. Ogni file scritto contiene il campo `actingAs` con l'utente scelto.
- L'Action di ricalcolo, **solo se `testMode` è attivo**, usa `actingAs` al posto dell'autore del commit per le verifiche (registratore, admin, voti), e lo accetta solo se il commit è stato fatto da un `testOperator`. Nel repository reale `testMode` è assente: `actingAs` viene ignorato e il selettore non compare. Non c'è modo di usare la modalità prova sui dati veri.
- Un banner fisso "MODALITÀ PROVA" rende impossibile confondere i due ambienti.
- Gli stessi utenti finti sono usati dalla finta API GitHub nei test automatici.

### 6.8 Servizi esterni senza backend

| Servizio | Come |
|---|---|
| Scryfall (dati carte, game changer) | Direttamente dal browser, con richieste a blocchi e cache locale |
| Import da testo | Interamente nel browser |
| Archidekt | Prima prova diretta dal browser; se il browser la blocca, l'app crea una richiesta in `requests/` e l'Action `import` scarica il mazzo dal server di GitHub (circa un minuto) |
| Moxfield | Tramite l'Action `import`; se Moxfield blocca anche quella, guida all'import da testo |
| Commander Spellbook (combo) | Dal browser se possibile, altrimenti nell'Action `recalc` |

Ogni servizio è isolato in un adattatore, così si può spostare dal browser all'Action (o a un backend futuro) senza toccare il resto.

### 6.9 Pronta per Android e iOS fin dal primo giorno

Regole di sviluppo obbligatorie, perché il passaggio a Capacitor sia solo una questione di build:
- routing hash e nessuna dipendenza da un server per le pagine;
- font, icone e immagini dell'interfaccia inclusi nel progetto (le immagini delle carte da Scryfall vanno bene, con cache);
- ogni funzione del dispositivo passa da un adattatore in `web/src/platform/` con versione web e versione Capacitor: archiviazione (normale e sicura per il token), condivisione, vibrazione, barra di stato, apertura link esterni, stato della rete;
- aree sicure, gesti touch, nessun hover (già previsti in §5.3);
- funzionamento offline con coda delle scritture (§6.5);
- nessun popup di sistema del browser (`alert`, `confirm`): solo componenti dell'app.

Per la pubblicazione sugli store servono, indicativamente: account sviluppatore Google Play (pagamento una tantum), Apple Developer Program (abbonamento annuale), un Mac con Xcode per compilare la versione iOS (o un servizio di build in cloud). Prima della pubblicazione vanno verificati anche: la **Fan Content Policy di Wizards of the Coast** (app gratuita, nessun logo ufficiale, avviso di non affiliazione), le linee guida di Scryfall sull'uso delle immagini, e le regole Apple sul login (se si offre il login con Google va offerto anche "Accedi con Apple"). Il login con token GitHub non è adatto a un'app pubblica: è uno dei motivi del passaggio allo stadio 3.

### 6.10 Passaggio allo stadio 3 (Firebase)

1. Implementare `FirebaseProvider` con la stessa interfaccia.
2. Script di migrazione: ogni file JSON diventa un documento Firestore nello stesso percorso.
3. La logica delle Actions (validazione, ricalcolo, import) si sposta in un backend (Render o Cloud Functions) usando lo stesso modulo del motore.
4. Login con Firebase Auth (email, Google, Apple), collegando ogni account al vecchio login GitHub.
5. Regole Firestore: fasce, metriche ed eventi scrivibili solo dal backend; chiusura partita solo dal registratore; riapertura solo all'unanimità.

L'interfaccia non cambia.

### 6.11 Versione locale e pubblicazione su GitHub Pages

**Versione locale (dal primo giorno).** Con un solo comando (`npm run dev`) l'app parte sul PC in **modalità demo**: usa `MockProvider` con i dati di prova (5 utenti, 15 mazzi, 60 partite), non chiede token e mostra il banner "DEMO LOCALE". Serve per vedere l'app crescere voce dopo voce.
- `npm run dev:lan` la rende raggiungibile dal **telefono sulla stessa rete Wi-Fi** (il terminale mostra l'indirizzo da aprire): è il modo più rapido per provare l'esperienza mobile reale.
- `npm run dev:fake-github` avvia l'app collegata alla finta API GitHub locale, per provare accesso, scritture e ricalcolo come se fosse online.
- `npm run preview` mostra la build di produzione in locale, con lo stesso percorso di base usato su GitHub Pages: ciò che vedi qui è ciò che verrà pubblicato.
- Facoltativo: dalla schermata Ambiente si può collegare la versione locale al repository dati reale con il proprio token.

**Pubblicazione su GitHub Pages (voce C-15).**
- Prima di rendere pubblico il repository del codice, un controllo automatico verifica che nella storia Git non ci siano token o file `.env` (scansione dei segreti). Il cambio di visibilità avviene solo con la tua conferma esplicita.
- Un workflow GitHub Actions, a ogni push su `main` con test verdi, compila l'app con il percorso di base `/<nome-repository>/` e la pubblica su Pages. L'indirizzo sarà `https://<organizzazione>.github.io/<nome-repository>/`.
- Chiunque può aprire l'indirizzo, ma senza il token di un membro autorizzato l'app mostra solo la schermata di accesso: i dati restano nel repository privato.
- Alternativa se in futuro si volesse il codice privato: Cloudflare Pages (gratuito con repository privati) oppure un piano GitHub a pagamento.

# Piano di test automatici

> Va in `docs/PIANO-Test.md`. Claude lo usa per scrivere ed eseguire i test di ogni funzionalità. Si legge solo la sezione che serve: §1–§6 una volta in fase B-03, poi solo i casi d'uso della funzionalità su cui si lavora.

---

## 1. Strategia a livelli

| Livello | Strumento | Cosa copre | Quando gira |
|---|---|---|---|
| Unitario | Vitest | Motore fasce, parser di import, stima del turno, normalizzazione formati, utilità | A ogni modifica del modulo |
| Livello dati | Vitest | `MockProvider`, `GitHubProvider` contro la finta API GitHub, schemi JSON, coda offline, conflitti | A ogni modifica di `web/src/data/` |
| Actions | Vitest sugli script delle Actions, eseguiti su una copia locale del repository dati | Validazione, autorizzazioni da autore commit, ricalcolo da zero, import | A ogni modifica degli script |
| End-to-end | Playwright + finta API GitHub + fixture API | Casi d'uso reali nel browser, su telefono e desktop | A fine funzionalità e in CI |
| Visivo | Playwright `toHaveScreenshot` + revisione screenshot | Layout, sovrapposizioni, testo tagliato, temi | A fine funzionalità e quando un test è dubbio |

**Regola:** nessun test chiama servizi reali esterni (GitHub, Scryfall, Archidekt, Moxfield, Commander Spellbook). Si usano risposte registrate in `tests/fixtures/` intercettate con `page.route`, e una **finta API GitHub** (`tests/fake-github/`): un piccolo server locale che implementa gli endpoint usati dall'app (utente, contenuti, richieste condizionali, conflitti di versione) leggendo e scrivendo una cartella temporanea con la stessa struttura di `bracketeer-data`. Dopo ogni scrittura la finta API può eseguire lo script di ricalcolo, simulando l'Action.

---

## 2. Profili Playwright (obbligatori per ogni test end-to-end marcato `@ui`)

| Progetto | Dispositivo | Motore |
|---|---|---|
| `mobile-small` | 320×568, touch | Chromium |
| `iphone` | iPhone 14 | WebKit |
| `android` | Pixel 7 | Chromium |
| `tablet` | iPad (gen 7) | WebKit |
| `desktop-chrome` | 1280×800 | Chromium |
| `desktop-wide` | 1920×1080 | Firefox |

I test di sola logica di rete o permessi possono girare su un solo profilo (tag `@api`).

---

## 3. Controlli automatici presenti in ogni test `@ui`

Un fixture Playwright comune (`tests/e2e/fixtures.js`) esegue questi controlli a ogni schermata visitata, così non vanno riscritti in ogni test:

1. **Nessuno scorrimento orizzontale:** `document.documentElement.scrollWidth <= window.innerWidth`.
2. **Target touch** (solo profili mobile): ogni elemento interattivo visibile misura almeno 44×44px.
3. **Testo minimo:** corpo del testo ≥ 16px sui profili mobile.
4. **Nessun errore in console** e nessuna richiesta di rete fallita non prevista.
5. **Accessibilità:** `@axe-core/playwright` senza violazioni gravi o critiche.
6. **Niente funzioni solo su hover:** le azioni sono raggiungibili con un tocco o con la tastiera.

Se un controllo fallisce, il test fallisce indicando l'elemento colpevole (selettore e dimensioni), non solo "errore".

---

## 4. Dati di prova (seed)

Lo script `npm run seed:test` genera nella cartella della finta API un repository dati con uno scenario fisso e riproducibile:
- 1 gruppo con i 4 utenti di prova della modalità prova (`test-admin`, `test-giocatore1…3`) più 1 utente `test-owner` che rappresenta te;
- 15 mazzi distribuiti su F1–F4, tra cui: uno con 4 game changer (pavimento F3), uno con 6 (pavimento F4), uno vicino alla soglia di promozione, uno "Dominante della fascia";
- 60 partite in vari formati (4, 3, 5 giocatori, 1v1, una parte con turno stimato, alcune non rappresentative);
- un evento di promozione e uno di declassamento già presenti.

Ogni test parte da uno stato noto: la cartella viene ricreata da una copia del seed prima di ogni file di test.

---

## 5. Revisione degli screenshot

Gli screenshot servono quando un controllo automatico non basta a dire se una schermata "va bene". Si usano così:

**Quando si fanno**
- sempre in caso di test fallito (`screenshot: 'only-on-failure'`, `trace: 'retain-on-failure'`);
- a fine funzionalità, per le schermate toccate, sui profili `iphone` e `desktop-chrome`, in tema chiaro e scuro (comando `npm run test:visual-review`, che salva le immagini in `test-results/review/`);
- quando un test passa ma c'è un dubbio (per esempio un testo lungo, un nome di carta molto lungo, una tabella con tante colonne).

**Chi li analizza**
- il subagent `ui-reviewer` (vedi prompt) apre le immagini e le confronta con la checklist qui sotto, e restituisce solo un elenco breve di problemi con schermata, profilo e descrizione. Le immagini non entrano nella conversazione principale.

**Checklist di revisione**
1. Elementi sovrapposti o tagliati, testo che esce dal contenitore.
2. Gerarchia visiva chiara: l'azione principale della schermata è evidente.
3. Spaziature coerenti col design system, allineamenti.
4. Contrasto sufficiente in entrambi i temi.
5. Su telefono: niente sotto il notch o sotto la barra home; bottom navigation non copre contenuti o pulsanti.
6. Su desktop: nessuna card stirata, larghezza massima del contenuto rispettata.
7. Stati vuoti, di caricamento e di errore presenti e comprensibili.

**Regressioni visive**
- Le schermate stabili (dashboard, scheda mazzo, lobby, chiusura) hanno un'immagine di riferimento con `toHaveScreenshot` su `iphone` e `desktop-chrome`. Le parti variabili (date, grafici animati) vanno mascherate.
- Le immagini di riferimento si aggiornano solo intenzionalmente, dopo una revisione, mai per "far passare" un test.

---

## 6. Ciclo di lavoro per ogni funzionalità

1. Rileggi i casi d'uso della funzionalità (sotto) e aggiungine se emergono casi non previsti.
2. Scrivi i test unitari della logica e poi il codice (per il motore fasce: prima i test).
3. Scrivi gli script Playwright dei casi d'uso, uno per file in `tests/e2e/<id-funzionalità>.spec.js`, con i tag `@core`/`@secondary` e `@ui`/`@api`.
4. Esegui tramite il subagent `test-runner`, che restituisce solo il riepilogo (passati/falliti e, per i falliti, il primo errore utile).
5. Correggi e riesegui solo i test falliti (`--last-failed`) fino a che sono tutti verdi.
6. Esegui la revisione screenshot (§5) delle schermate toccate.
7. Esegui l'intera suite `@core` una volta prima di dichiarare la funzionalità finita, per evitare regressioni.

---

## 7. Test unitari del motore fasce (UT-ENG)

| ID | Caso | Risultato atteso |
|---|---|---|
| UT-ENG-01 | Esempio §3.8 della spec, prime 4 vittorie | TMV ≈ 7,35, resta F2, stato "In osservazione" |
| UT-ENG-02 | Esempio §3.8 con la quinta vittoria al turno 6 | TMV ≈ 6,98, promosso F3, motivo "velocità" |
| UT-ENG-03 | Meno di 3 vittorie | Fv non valida, nessuna promozione per velocità |
| UT-ENG-04 | D ≥ 1,8 ma TMV 11 in F1 | Non sale oltre F2 se TMV > 10,5; badge "Dominante della fascia" |
| UT-ENG-05 | Declassamento che scenderebbe sotto il pavimento | Resta al pavimento, badge "Sovradimensionato in lista" |
| UT-ENG-06 | Cooldown non trascorso | Nessun cambio |
| UT-ENG-07 | Calcolo che porterebbe in F5 senza conferma | Resta F4, motivo "F5_richiede_conferma" |
| UT-ENG-08 | Partita a 3 al turno 6 | t_eff = 6,9 (fattore 1,15) |
| UT-ENG-09 | 1v1 | Peso velocità e dominio 0,5; atteso 1/2 |
| UT-ENG-10 | 2v2 vinto | Entrambi i mazzi della squadra ricevono il dato con peso 0,5; contendenti = 2 |
| UT-ENG-11 | Vittoria condivisa a 2 nello Star | Quota 0,5 ciascuno |
| UT-ENG-12 | Treachery | Nessun effetto sulle fasce |
| UT-ENG-13 | Turno stimato | Peso 0,75 rispetto al turno da dado |
| UT-ENG-14 | Partita non rappresentativa | Peso 0 |
| UT-ENG-15 | Eliminazione registrata | Dato di velocità a peso 0,5 |
| UT-ENG-16 | Determinismo | Stesso storico e parametri → risultato identico in due esecuzioni |
| UT-ENG-17 | Correzione di una partita passata | Il ricalcolo da quel punto produce lo stesso stato di un calcolo da zero sullo storico corretto |
| UT-ENG-18 | Pavimento: 0, 4, 6 game changer; terre distrutte; turni extra; combo rapida e tardiva | F1, F3, F4, F4, F4, F4, F3 |
| UT-ENG-19 | Modificatori per tipo di vittoria | Ogni tipo applica il valore dei parametri |
| UT-ENG-20 | Parametri personalizzati del gruppo | Il motore usa quelli, non i default |

Altri test unitari: **UT-DATA** (interfaccia `DataProvider` rispettata da tutte le implementazioni, validazione schemi, identificativi ULID); **UT-GH** (`GitHubProvider`: lettura condizionale, conflitto di versione con rilettura e nuovo tentativo, errore di token scaduto, coda offline svuotata al ritorno della rete); **UT-ACT** (Action `recalc`: con `testMode` accetta `actingAs` solo da un `testOperator`, senza `testMode` lo ignora; file non valido ignorato e annotato, chiusura da non registratore ignorata, modifica a `config/` da non admin ignorata, `derived/` manomesso riportato al valore corretto, risultato identico a un calcolo da zero); **UT-PARSE** (import da testo: quantità, comandanti, sezioni, nomi con virgole e doppia faccia, righe vuote, errori); **UT-EST** (stima del turno: usa solo partite da dado, valore di default senza storico).

---

## 8. Casi d'uso end-to-end — Core

Ogni caso indica i passi principali e il risultato atteso. Tutti `@core @ui` salvo diversa indicazione.

| ID | Caso d'uso | Passi | Risultato atteso |
|---|---|---|---|
| UC-01 | Accesso con token | Incolla un token valido di un membro → esci → rientra | Dashboard visibile, nome e avatar nell'header; il token non compare mai in chiaro nell'interfaccia |
| UC-02 | Accesso negato | Token non valido, scaduto, o di un utente non presente in `members.json` | Messaggio chiaro per ciascun caso con il passo da fare; nessun dato del gruppo mostrato |
| UC-03 | Gestione membri | Admin aggiunge un membro e cambia un ruolo; un giocatore prova a fare lo stesso | Admin riesce; per il giocatore la funzione non è visibile e una scrittura forzata viene ignorata dal ricalcolo |
| UC-04 | Import da testo | Incolla lista di 100 carte con comandante | Mazzo creato, carte riconosciute, carte non trovate elencate per la correzione |
| UC-05 | Import da Archidekt | Incolla URL (fixture) | Mazzo importato con comandante e carte corrette |
| UC-07 | Autovalutazione | Importa mazzo con 4 game changer → wizard | Pavimento F3 mostrato; impossibile dichiarare F2; stato Provvisorio |
| UC-09 | Lobby | Crea tavolo da 4, scegli mazzi, registratore, Inizia | Partita "In corso"; promemoria del dado mostrato al registratore |
| UC-10 | Chiusura con dado | Registratore: vincitore, turno 7, combo | Anteprima immediata con "in aggiornamento"; dopo il ricalcolo simulato la fascia ufficiale coincide con l'anteprima |
| UC-11 | Solo il registratore chiude | Un altro partecipante prova a chiudere (interfaccia e scrittura diretta del file) | Pulsante assente; la scrittura forzata viene ignorata dal ricalcolo e annotata in `errors.json` (`@api`) |
| UC-12 | Chiusura con stima | Registratore usa "Non ho contato, usa la stima" | Turno precompilato, origine "stima" salvata |
| UC-13 | Partita a 3 | Lobby con 3 giocatori, chiusura | Formato corretto; metriche normalizzate (verifica sul dettaglio del mazzo) |
| UC-14 | 1v1 | Lobby 1v1, chiusura | Partita registrata con pesi ridotti |
| UC-15 | Promozione | Dai dati seed, chiudi la partita che porta il mazzo vicino alla soglia oltre la soglia | Notifica e spiegazione con TMV e soglia |
| UC-16 | Pavimento | Mazzo con 6 game changer che perde molto | Resta F4 con badge "Sovradimensionato in lista" |
| UC-17 | Dashboard | Apri con i dati seed | KPI coerenti con i dati; grafici visibili e leggibili su telefono |
| UC-18 | Scheda mazzo | Apri un mazzo | Metriche, storico fasce, game changer, tipi di vittoria |
| UC-19 | Integrità dati | Scrittura manuale in `derived/`, file partita malformato, modifica a `config/` da non admin | Dopo il ricalcolo `derived/` è corretto, il file malformato è ignorato e segnalato, la modifica non autorizzata non ha effetto (`@api`) |
| UC-23 | Offline | Chiudi una partita senza rete, poi ripristina la rete | Partita in coda, inviata automaticamente, nessun duplicato |
| UC-25 | Modalità prova | Su repository con `testMode`, il testOperator agisce come `test-giocatore1`, apre una lobby con registratore `test-giocatore2`, poi chiude come `test-giocatore2` | Chiusura accettata; tentativo di chiudere come `test-giocatore1` ignorato; banner "MODALITÀ PROVA" sempre visibile |
| UC-26 | Modalità prova disattivata | Stesse azioni sul repository reale (senza `testMode`) | Selettore "Agisci come" assente; un `actingAs` scritto a mano viene ignorato dall'Action |
| UC-27 | Versione locale | `npm run dev` senza configurazione; `npm run preview` | App avviata in modalità demo con banner e dati di prova; la build in anteprima funziona con il percorso di GitHub Pages, compreso il ricaricamento di una pagina interna |
| UC-28 | Pubblicazione | Build di produzione servita sotto `/<repo>/` | Tutte le risorse caricate, nessun riferimento a dati o token nel bundle, schermata di accesso mostrata senza token |
| UC-24 | Conflitto | Due utenti modificano `config/group.json` quasi insieme | Entrambe le modifiche salvate grazie a rilettura e nuovo tentativo |
| UC-20 | Silenzio in partita | Genera una notifica mentre l'utente è in una partita in corso | Nessuna notifica mostrata finché la partita non è chiusa |
| UC-21 | Storico partite | Filtra per formato, mazzo, data | Risultati corretti; filtri usabili su telefono |
| UC-22 | Regolamento e parametri | Admin cambia un modificatore | Regolamento aggiornato; il ricalcolo dello storico viene proposto |
| UC-30 | Giro responsive | Visita tutte le pagine su tutti i 6 profili | Tutti i controlli di §3 verdi |
| UC-31 | Navigazione mobile | Bottom nav, menu a scomparsa, tasto indietro con modale aperta | Il tasto indietro chiude la modale prima di cambiare pagina |
| UC-32 | Temi | Cambia tema, ricarica | Tema mantenuto; contrasto valido in entrambi |

---

## 9. Casi d'uso end-to-end — Secondari

| ID | Caso d'uso | Risultato atteso |
|---|---|---|
| UC-06 | Moxfield bloccato (fixture 403) | Messaggio con istruzioni "Export → Copia testo" e passaggio diretto all'import da testo |
| UC-08 | Reimport con 12 carte cambiate | Nuova versione con diff; mazzo torna Provvisorio |
| UC-40 | Riapertura | Senza tutti i voti la partita non cambia; con l'unanimità il registratore corregge e lo storico si ricalcola |
| UC-41 | Contestazione cambio fascia | A maggioranza il cambio è annullato e il mazzo bloccato per 3 partite |
| UC-42 | 2v2, Emperor, Star | Squadre e vittorie condivise registrate e pesate correttamente |
| UC-43 | Treachery | Ogni giocatore vede solo il proprio ruolo in lobby; nessun effetto sulle fasce |
| UC-44 | Planechase e formato personalizzato | Moltiplicatori applicati |
| UC-45 | Tavolo bilanciato | Mazzi proposti nella stessa fascia o adiacenti |
| UC-46 | Statistiche avanzate | Classifiche e grafici corretti sui dati seed |
| UC-47 | Combo rilevate | Combo rapida porta il pavimento a F4 |
| UC-48 | PWA e offline | App installabile; chiusura partita offline sincronizzata al ritorno della rete |
| UC-49 | Simulatore | Anteprima coerente con il risultato reale dopo la stessa partita |
| UC-50 | Taratura fattori | Proposta mostrata solo dopo 20 partite nel formato; applicata solo con approvazione |
| UC-51 | Stagioni | Classifiche azzerate, fasce invariate |
| UC-52 | Export | CSV e JSON scaricabili e completi |
| UC-53 | Serate | Presenze registrate |
| UC-60 | App Capacitor | Build Android avviata su emulatore: accesso, lobby, chiusura; token nell'archivio sicuro |
| UC-61 | Migrazione Firebase | Lo script copia il seed in Firestore (emulatore) e l'app con `FirebaseProvider` mostra gli stessi dati |
| UC-62 | Backend stadio 3 | Stessi risultati delle Actions sullo stesso storico |
| UC-63 | Login pubblico | Email, Google, Apple; collegamento al vecchio account GitHub |

---

## 10. Integrazione continua

Il workflow GitHub Actions del repository del codice esegue, a ogni push e pull request: lint, test unitari, test delle Actions e la suite Playwright `@core` sui 6 profili con la finta API GitHub. Il deploy su GitHub Pages e la pubblicazione del motore compilato nel repository dati partono solo se tutto è verde. Per contenere i minuti di Actions del piano gratuito, sulle pull request si può eseguire solo il profilo `iphone` e `desktop-chrome`, e la suite completa sui 6 profili solo su `main`. Report HTML di Playwright e screenshot dei falliti vengono caricati come artefatti.

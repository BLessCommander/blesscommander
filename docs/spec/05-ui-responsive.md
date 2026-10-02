# Interfaccia, responsive e funzioni di contorno (SPEC §4.4–§4.7, §5)

### 4.4 Motore fasce e trasparenza
- Ricalcolo automatico alla chiusura di ogni partita e dopo ogni correzione.
- **Ogni cambio di fascia ha una spiegazione leggibile** (metriche, soglie, partite che l'hanno causato).
- **Contestazione di un cambio di fascia**: chiunque del gruppo può contestare una promozione o un declassamento; il gruppo vota (fuori dalle partite) e, a maggioranza, il cambio viene annullato e il mazzo resta bloccato per altre 3 partite. È diverso dalla riapertura di una partita (§4.3): qui i dati sono giusti ma il gruppo non è d'accordo con l'esito.
- **Simulatore "e se…"**: "se vinco la prossima al turno 6 con una combo, cosa succede?".
- Pagina **Regolamento** generata dai parametri attuali del gruppo (sempre allineata alla configurazione).

### 4.5 Organizzazione del tavolo (dentro la lobby)
- **Tavolo bilanciato**: selezioni chi è presente e il formato, l'app propone per ognuno il mazzo più adatto per avere tutti nella stessa fascia (o fasce adiacenti), con un indicatore di equilibrio del tavolo. Nei formati a squadre propone squadre equilibrate.
- **Randomizzatore** di ordine di turno e posti (nello Star mostra anche chi sono i due nemici di ciascuno; in Treachery può distribuire i ruoli in modo segreto, ognuno vede il proprio sul suo telefono prima di iniziare).
- **Serate**: pianificazione con presenze (fase 2).

### 4.6 Statistiche e classifiche
- Classifica per fascia (win rate pesato, D).
- Classifica giocatori (vittorie, partite, mazzo più usato), filtrabile per formato.
- Statistiche per formato: turno medio, durata media, minuti per giro (usati per la stima del turno), win rate per ruolo nei formati a ruoli.
- Percentuale di partite con turno contato con il dado: se scende troppo, la dashboard lo segnala al gruppo.
- Distribuzione dei turni di vittoria per fascia (istogramma): verifica che le fasce del gruppo siano davvero separate.
- Head-to-head tra giocatori e tra mazzi.
- Andamento nel tempo (linee), heatmap giorno/ora delle partite.
- **Stagioni**: reset morbido delle classifiche (le fasce restano).

### 4.7 Utilità
- Notifiche in-app (cambi fascia, richieste di riapertura, contestazioni), silenziate durante le partite in corso per chi sta giocando.
- Ricerca globale (mazzi, giocatori, carte).
- Export dati in CSV/JSON e backup del gruppo.
- **PWA** installabile su telefono, con funzionamento offline per registrare partite (sincronizzazione al ritorno della connessione).
- Tema chiaro/scuro.

---

## 5. Design e interfaccia

### 5.1 Ispirazione (da rifare da zero, nessun codice copiato)

**Da Nalika (material dark):**
- sfondo blu notte profondo, card leggermente più chiare con bordi sottili e ombre morbide;
- accenti ciano/neon sui valori chiave;
- **card KPI** in alto con titolo, valore grande e barra di progresso percentuale;
- sidebar con logo e avatar utente in testa, menu a sezioni espandibili;
- card "profilo" con statistiche in riga (nel nostro caso: partite, vittorie, mazzi).

**Da CoreUI:**
- sidebar comprimibile a sole icone (desktop) e header fisso con breadcrumb, notifiche e selettore tema;
- **widget colorati** con piccolo grafico sparkline integrato;
- grafico principale grande a tutta larghezza con selettore di periodo;
- tabelle con avatar, barre di progresso inline e badge di stato;
- doppio tema chiaro/scuro gestito con variabili CSS.

### 5.2 Identità visiva
- Colori fascia: F1 verde, F2 azzurro, F3 viola, F4 arancio, F5 rosso.
- Simboli di mana per l'identità di colore (font open source "Mana" di Andrew Gioia o simboli dall'API di Scryfall).
- Font: uno sans moderno per l'interfaccia (es. Inter) e uno con carattere per i titoli (es. Cinzel, richiamo fantasy discreto).
- Immagini delle carte da Scryfall, sempre con il credito richiesto.

### 5.3 Desktop e mobile: requisito obbligatorio

**L'app deve essere pienamente usabile sia da PC sia da telefono e tablet. Non è una preferenza: è un requisito bloccante.** Una funzionalità che non funziona bene su uno dei due non è considerata finita, e nessuna fase di sviluppo si chiude finché i criteri qui sotto non sono rispettati su tutte le schermate toccate.

Mobile non significa "versione ridotta": **ogni funzione disponibile su desktop è disponibile anche su mobile**, compresi import dei mazzi, impostazioni del gruppo, statistiche e grafici. Cambia la disposizione, non il contenuto.

**Punti di rottura (breakpoint)**

| Larghezza | Dispositivo tipo | Layout |
|---|---|---|
| < 576px | Telefono in verticale | Una colonna, bottom navigation, sidebar a scomparsa, tabelle come card |
| 576 – 767px | Telefono in orizzontale, phablet | Come sopra, card su due colonne dove ha senso |
| 768 – 1023px | Tablet | Sidebar a sole icone, header completo, griglie a 2 colonne |
| ≥ 1024px | PC | Sidebar estesa e comprimibile, griglie a 3–4 colonne, tabelle complete |
| ≥ 1440px | Schermi grandi | Contenuto con larghezza massima, nessuno stiramento eccessivo |

**Navigazione**
- Desktop: sidebar comprimibile con sezioni + header con breadcrumb, notifiche, tema e profilo.
- Mobile: **barra di navigazione in basso** (Dashboard, Mazzi, ➕ Nuovo tavolo / Chiudi partita, Statistiche, Profilo) con il pulsante centrale in evidenza; la sidebar completa resta raggiungibile da un menu a scomparsa per le voci secondarie.
- Il tasto "indietro" del telefono deve funzionare in modo naturale (chiude modali e menu prima di cambiare pagina).

**Criteri di accettazione (tutti obbligatori)**
1. Nessuno scorrimento orizzontale della pagina a nessuna larghezza da 320px in su. Solo componenti specifici (es. una tabella larga) possono scorrere al proprio interno, con indicazione visiva.
2. Elementi toccabili di almeno 44×44px con spazio sufficiente tra uno e l'altro; nessuna funzione raggiungibile solo con il passaggio del mouse (hover).
3. Testo leggibile senza zoom (minimo 16px per il corpo, che evita anche lo zoom automatico di iOS sui campi).
4. Campi con la tastiera giusta (`inputmode` numerico per i turni, email per l'email) e moduli che restano visibili quando si apre la tastiera.
5. Rispetto delle aree sicure (notch, barra home di iPhone, barre di sistema Android) con `env(safe-area-inset-*)`.
6. Modali a schermo intero sui telefoni (bottom sheet), centrate su desktop.
7. Grafici ridimensionabili e leggibili su telefono: legende sotto il grafico, tocco per vedere i valori al posto dell'hover.
8. Funziona in verticale e in orizzontale.
9. Prestazioni su rete mobile: Lighthouse mobile ≥ 90 in Prestazioni, Accessibilità, Best practice; caricamento iniziale leggero (pagine caricate a richiesta, immagini delle carte in formato ridotto e caricamento pigro).
10. Su desktop: tastiera completa (Tab, Invio, Esc), scorciatoie per le azioni frequenti, uso pieno dello spazio senza card stirate.
11. PWA installabile su Android e iOS, con icona, schermata di avvio e funzionamento a schermo intero.

**Dispositivi e browser di verifica**
- Larghezze di prova: 320, 375, 390, 414, 768, 1024, 1280, 1920px.
- Browser: Chrome e Safari su telefono (Safari iOS ha comportamenti propri, va provato davvero), Chrome, Firefox, Edge e Safari su desktop.
- Test automatici con Playwright su un profilo telefono (es. iPhone e Pixel) e uno desktop per i flussi principali: login, import mazzo, lobby, chiusura partita, scheda mazzo.
- Prima di chiudere ogni fase, prova manuale su almeno un telefono reale.

### 5.4 Pagine

| Pagina | Contenuto principale |
|---|---|
| Login / Registrazione | Form, login con Google, ingresso con codice invito |
| Dashboard | 4 KPI (partite, win rate, TMV personale, mazzi per fascia), grafico andamento, ultime partite, ultimi cambi fascia, partita in corso o da chiudere, richieste di riapertura da votare |
| Mazzi | Griglia card con comandante, fascia, stato, metriche; filtri |
| Dettaglio mazzo | Vedi §4.2 |
| Importa mazzo | URL o testo, poi wizard autovalutazione |
| Lobby (nuovo tavolo) | Formato, giocatori, mazzi bilanciati, squadre/ruoli, registratore, "Inizia" (§4.3, §4.5) |
| Chiusura partita | Vincitore, turno stimato, tipo di vittoria, dettagli opzionali (§4.3) |
| Partite | Storico con filtri, richieste di riapertura |
| Statistiche | Grafici e classifiche (§4.6) |
| Regolamento | Fasce e parametri attuali |
| Gruppo | Membri, ruoli, inviti, parametri motore, formati e varianti, stagioni (admin) |
| Profilo | Dati utente, preferenze, export |

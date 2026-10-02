# Bracketeer — Gestione fasce Commander per il nostro gruppo

> Documento di specifica funzionale. Descrive cosa fa l'app, come funziona il sistema di fasce e come è costruita tecnicamente. Va messo nel repository come `docs/SPEC.md` ed è la fonte di verità per lo sviluppo.

---

## 1. Obiettivo

Il nostro gruppo gioca a Commander e i bracket ufficiali non bastano: due mazzi "Bracket 3" possono essere lontanissimi come potenza reale. L'app risolve il problema in due passi:

1. **Autovalutazione al momento dell'import**: il mazzo viene analizzato (game changer, combo, terre distrutte di massa, turni extra) e riceve una **fascia minima di costruzione** più una fascia iniziale dichiarata dal proprietario.
2. **Correzione basata sui dati reali**: ogni partita registrata (pochi dati: chi ha vinto, a che turno, come) alimenta un motore che **promuove, declassa o conferma** la fascia del mazzo in modo automatico, spiegabile e resistente ai colpi di fortuna.

### Regola d'oro: zero interazioni durante la partita

**Requisito bloccante: l'app deve funzionare al 100% sia su PC sia su telefono e tablet (§5.3).**

Mentre si gioca ci si concentra sul gioco. **Ogni azione richiesta dall'app avviene prima della partita (lobby) o dopo (chiusura), mai durante.** Nessun contatore da toccare, nessuna notifica, nessuna conferma a metà partita. Questo vincolo ha la precedenza su qualunque altra funzionalità: se una funzione richiede di usare il telefono durante la partita, non si fa.

**Unica eccezione, fuori dall'app: il dado dei turni.** Il registratore della partita ha anche il compito di tenere il conto dei giri con un dado fisico (consigliato un d20) posato accanto al primo giocatore: lo gira di uno ogni volta che il primo giocatore inizia un nuovo turno. A fine partita il valore del dado è il turno da inserire in chiusura. È l'unica azione di gioco legata alle metriche e non coinvolge il telefono.

---

## 2. Le fasce (regole di costruzione)

Le fasce ricalcano i bracket ufficiali con le modifiche decise dal gruppo. I limiti sono configurabili dalla pagina Impostazioni del gruppo.

| Fascia | Nome | Turno di vittoria atteso | Game Changer | Terre distrutte di massa | Turni extra | Combo infinite a 2 carte |
|---|---|---|---|---|---|---|
| **F1** | Esibizione | 10 o più | 0 | No | No | No |
| **F2** | Base | 8 – 9 | 0 | No | Sì, ma non a catena | No |
| **F3** | Potenziata | 6 – 7 | **fino a 5** (modifica del gruppo, l'ufficiale è 3) | No | Non a catena | Solo "tardive" (vedi §3.2) |
| **F4** | Ottimizzata | 4 – 5 | Illimitati | Sì | Sì | Sì |
| **F5** | Competitiva (cEDH) | 3 o meno | Illimitati | Sì | Sì | Sì |

**Principio chiave:** le regole di costruzione sono un **pavimento**, non un tetto. Un mazzo con 4 game changer non può mai stare sotto F3, ma un mazzo con 0 game changer può salire in F3 o F4 se vince troppo velocemente. Il comportamento in partita conta più della lista.

F5 è solo su dichiarazione esplicita del proprietario (nessun mazzo ci finisce per promozione automatica senza conferma).

---

## 3. Il metodo di valutazione

### 3.1 Panoramica

Ogni mazzo ha quattro valori calcolati:

| Valore | Cosa misura | Da dove viene |
|---|---|---|
| **Pavimento (Fmin)** | La fascia minima permessa dalla lista | Analisi automatica della decklist |
| **TMV** – Turno Medio di Vittoria | Quanto velocemente vince il mazzo | Media pesata delle ultime vittorie |
| **D** – Indice di Dominio | Quanto spesso vince rispetto all'atteso | Vittorie reali / vittorie attese |
| **Fascia attuale** | Il risultato finale | Regole di decisione (§3.6) |

Dati richiesti per ogni partita:
- **prima** (lobby): formato, partecipanti con il mazzo usato, chi registra la partita;
- **dopo** (chiusura, solo il registratore): vincitore, turno della vittoria, tipo di vittoria. Facoltativi: eliminazioni intermedie, flag "partita non rappresentativa", note.

La chiusura deve richiedere al massimo 3 tocchi e meno di 20 secondi.

**Definizione di turno:** il turno è il numero del *giro di tavolo* in cui avviene la vittoria. Il primo giro (in cui ogni giocatore gioca la sua prima volta) è il turno 1. Il turno lo conta il **registratore con il dado** (vedi regola d'oro, §1) e lo inserisce in chiusura. In chiusura il campo turno ha due origini possibili, salvate nella partita:
- **dado** (normale): il registratore inserisce il valore letto sul dado;
- **stima** (ripiego, se ci si è dimenticati di girare il dado): l'app propone un valore calcolato dalla durata della partita (dal tocco su "Inizia" al tocco su "Chiudi") e dai minuti medi per giro del gruppo, appresi dallo storico per formato e numero di giocatori, solo dalle partite con turno da dado. Un turno stimato è meno affidabile, quindi pesa meno nel calcolo (`pesoTurnoStimato`, default 0,75).

### 3.2 Pavimento di costruzione (automatico)

Calcolato a ogni import o aggiornamento del mazzo:

```
Fmin = F1
se il mazzo ha 1–5 game changer        → Fmin = max(Fmin, F3)
se il mazzo ha 6+ game changer         → Fmin = max(Fmin, F4)
se contiene terre distrutte di massa   → Fmin = max(Fmin, F4)
se contiene turni extra concatenabili  → Fmin = max(Fmin, F4)
se contiene una combo infinita 2 carte:
    valore di mana totale pezzi ≥ 7    → Fmin = max(Fmin, F3)   ("tardiva")
    valore di mana totale pezzi ≤ 6    → Fmin = max(Fmin, F4)   ("rapida")
```

- I **game changer** si rilevano con Scryfall (ricerca `is:gamechanger`), così la lista è sempre aggiornata senza toccare il codice.
- Le **combo** si rilevano con l'API di Commander Spellbook passando la decklist.
- **Terre distrutte di massa e turni extra** non sono rilevabili in modo affidabile al 100%: l'app li propone tramite una lista di carte note più una ricerca per testo (es. "destroy all lands", "take an extra turn") e il proprietario conferma nel questionario.

Il proprietario dichiara poi una **fascia iniziale** (≥ Fmin). Il mazzo parte in stato **Provvisorio**.

### 3.3 Turno effettivo di una vittoria

Non tutte le vittorie al turno 7 pesano uguale. Una combo infinita al turno 7 è più "brusca" di un attacco di creature al turno 7, che gli avversari potevano vedere arrivare. Per questo ogni vittoria produce un **turno effettivo**:

```
t_eff = turno_vittoria × fattore_turno_formato + modificatore_tipo
```

Il `fattore_turno_formato` riporta ogni partita all'equivalente di una partita a 4 giocatori (vedi §3.10). Per la partita standard a 4 vale 1.

| Tipo di vittoria | Modificatore | Motivo |
|---|---|---|
| Danno da creature (combattimento) | 0 | Riferimento, vittoria visibile e interagibile |
| Danno da comandante | 0 | Come sopra |
| Danno passivo / drain (aristocratici, burn incrementale) | 0 | Graduale e telegrafata |
| Macinare il mazzo (mill) | 0 | Graduale |
| Veleno / infettare | −0,5 | Soglia effettiva più bassa (10) |
| Attacco esplosivo dal nulla (turni di combattimento extra, overrun) | −0,5 | Poco telegrafata |
| Lock / stax con resa degli avversari | −0,5 | Il gioco era deciso prima |
| Combo infinita | −1 | Improvvisa, spesso non interagibile |
| Vittoria alternativa ("vinci la partita") | −1 | Come sopra |
| Catena di turni extra | −1 | Come sopra |
| Ultimo superstite (gli altri si eliminano tra loro o concedono) | +1 | Vittoria poco indicativa della velocità del mazzo |

I modificatori sono parametri del gruppo, modificabili.

**Eliminazioni (facoltative):** se un mazzo perdente elimina un avversario al turno *t*, questo produce un dato di velocità a **peso dimezzato**. Serve a non ignorare mazzi forti che "rompono" il tavolo ma poi non chiudono la partita.

**Partita non rappresentativa:** il tavolo lo decide a voce a fine partita (mana screw grave, partita interrotta, regole sperimentali) e il registratore lo segna in chiusura. La partita resta nello storico ma ha peso 0 nel calcolo.

### 3.4 TMV — Turno Medio di Vittoria

Media pesata dei turni effettivi delle ultime **N = 8** vittorie (più eventuali eliminazioni a peso ½), con decadimento esponenziale per dare più importanza alle partite recenti (i mazzi cambiano, i giocatori migliorano):

```
peso_k = 0,85^k × peso_tavolo × peso_tipo_dato × peso_velocita_formato × peso_origine_turno
         (k = 0 per la vittoria più recente, 1 per la precedente, …)
         (peso_tipo_dato = 1 per vittoria, 0,5 per eliminazione)
         (peso_velocita_formato: vedi §3.10)
         (peso_origine_turno = 1 se contato con il dado, 0,75 se stimato)

TMV = Σ (t_eff_k × peso_k) / Σ peso_k
```

**Peso del tavolo:** vincere contro mazzi di fascia superiore è un indizio più forte di velocità.

```
peso_tavolo = clamp(1 + 0,5 × (fascia_media_avversari − fascia_mazzo), 0,5, 2)
```

Il TMV viene convertito in **fascia di velocità (Fv)** con queste soglie:

| TMV | Fv |
|---|---|
| ≤ 3,5 | F5 |
| 3,5 – 5,5 | F4 |
| 5,5 – 7,5 | F3 |
| 7,5 – 9,5 | F2 |
| > 9,5 | F1 |

Servono almeno **3 vittorie** nella finestra perché Fv sia considerata valida.

### 3.5 D — Indice di Dominio

Misura se il mazzo vince più o meno di quanto ci si aspetterebbe, sulle ultime **10 partite**:

```
per ogni partita g che conta per le fasce:
  atteso_g = 1 / n_contendenti     (giocatori nei formati tutti contro tutti, squadre nei formati a squadre)
  reale_g  = quota_vittoria        (1 se ha vinto da solo, 1/k se ha vinto insieme ad altri k−1, 0 se ha perso)

vittorie_attese = Σ atteso_g × peso_dominio_formato_g
vittorie_reali  = Σ reale_g  × peso_dominio_formato_g × peso_tavolo_g
D = vittorie_reali / vittorie_attese
```

In un tavolo da 4 si "dovrebbe" vincere 1 volta su 4, in un 1v1 una volta su 2, in un 2 contro 2 una volta su 2 (come squadra).

- D ≈ 1 → il mazzo è allineato al tavolo
- D ≥ 1,8 → domina la fascia
- D ≤ 0,35 → viene sistematicamente superato

Servono almeno **6 partite** perché D sia considerato valido.

### 3.6 Regole di decisione

Il motore si attiva alla chiusura di ogni partita che conta per le fasce, per ogni mazzo partecipante.

**Promozione (+1 fascia):**
- *per velocità:* Fv > fascia attuale **e** il TMV è dentro la nuova finestra con un margine di sicurezza di 0,25 turni (isteresi: evita che il mazzo rimbalzi su e giù al confine);
- *per dominio:* D ≥ 1,8 **e** TMV ≤ (limite superiore della fascia di destinazione + 1 turno).

La seconda regola implementa il vincolo del gruppo: **un mazzo che vince spesso ma al turno 10–12 non può salire in una fascia dove si vince al turno 6–7**. Al massimo sale di una fascia, e solo se la sua velocità è vicina a quella fascia. Se vince tanto ma lentamente viene marcato con il badge "Dominante della fascia", senza promozione.

**Declassamento (−1 fascia):**
- *per lentezza:* Fv < fascia attuale con margine 0,25 **e** almeno 3 vittorie in finestra;
- *per inefficacia:* D ≤ 0,35 su almeno 8 partite.

**Mai sotto il pavimento:** se il calcolo porterebbe sotto Fmin, il mazzo resta a Fmin e riceve il badge "Sovradimensionato in lista" (es. tanti game changer ma vince piano): è un suggerimento per il proprietario a togliere qualcosa.

**Limiti di stabilità:**
- massimo un cambio di fascia per valutazione;
- dopo un cambio, almeno **3 partite** prima del cambio successivo (cooldown);
- F5 richiede conferma del proprietario.

**Stati del mazzo:**

| Stato | Quando |
|---|---|
| Provvisorio | Meno di 5 partite giocate o mazzo modificato di recente |
| Stabile | Dati sufficienti, metriche dentro la fascia |
| In osservazione | Metriche vicino a una soglia ma non ancora oltre (isteresi) |
| Dominante della fascia | D alto ma velocità insufficiente per salire |

**Modifiche al mazzo:** quando si reimporta una versione che differisce per più di 10 carte o cambia i game changer, il pavimento si ricalcola, lo storico viene mantenuto ma i pesi delle partite precedenti si dimezzano e il mazzo torna Provvisorio.

### 3.7 Pseudocodice del motore

```js
function valutaMazzo(mazzo, partite, cfg) {
  const vittorie = datiVelocita(mazzo, partite, cfg)      // vittorie + eliminazioni (peso ½), ultime N
  const tmv = mediaPesata(vittorie, cfg.decadimento)       // §3.4
  const fv  = vittorie.length >= 3 ? fasciaDaTurno(tmv, cfg.soglie) : null
  const d   = indiceDominio(mazzo, partite.slice(-10), cfg) // §3.5, null se < 6 partite

  let nuova = mazzo.fasciaAttuale
  const motivi = []

  if (mazzo.partiteDaUltimoCambio >= cfg.cooldown) {
    if (fv && fv > nuova && dentroConMargine(tmv, nuova + 1, cfg.margine)) {
      nuova++; motivi.push('velocita')
    } else if (d !== null && d >= cfg.dominioAlto && tmv <= limiteSup(nuova + 1) + 1) {
      nuova++; motivi.push('dominio')
    } else if (fv && fv < nuova && fuoriConMargine(tmv, nuova, cfg.margine)) {
      nuova--; motivi.push('lentezza')
    } else if (d !== null && d <= cfg.dominioBasso && partite.length >= 8) {
      nuova--; motivi.push('inefficacia')
    }
  }

  if (nuova < mazzo.pavimento) { nuova = mazzo.pavimento; motivi.push('pavimento') }
  if (nuova === 5 && mazzo.fasciaAttuale < 5) { nuova = 4; motivi.push('F5_richiede_conferma') }

  return { nuova, tmv, fv, d, motivi, stato: calcolaStato(/* … */) }
}
```

Il motore è un **modulo JavaScript puro** (nessuna dipendenza da GitHub, Firebase o dal browser), testato con Vitest e usato sia dal calcolo ufficiale (GitHub Actions nello stadio 1, backend nello stadio 3) sia dal frontend (anteprima "cosa succederebbe se…").

**Determinismo e ricalcolo:** dato lo stesso storico e gli stessi parametri, il motore produce sempre lo stesso risultato. Questo permette di **rigiocare la storia**: quando una partita viene riaperta e corretta (§4.3) o cambiano i parametri del gruppo, il calcolo ufficiale ricalcola in ordine cronologico tutte le partite da quel punto in poi per i mazzi coinvolti. Gli eventi di fascia che non si verificano più vengono marcati "annullati dalla correzione" (restano visibili nello storico).

### 3.8 Esempio pratico

Mazzo "Krenko", fascia attuale **F2** (finestra 8–9), cooldown superato. Ultime vittorie dalla più recente, tutte contro tavoli della stessa fascia:

| # | Turno | Tipo | t_eff | Peso |
|---|---|---|---|---|
| 0 | 7 | Creature | 7 | 1,000 |
| 1 | 7 | Combo infinita | 6 | 0,850 |
| 2 | 8 | Creature | 8 | 0,723 |
| 3 | 9 | Drain | 9 | 0,614 |

TMV = (7 + 5,10 + 5,78 + 5,53) / 3,187 ≈ **7,35** → Fv = F3. Però per promuovere serve TMV ≤ 7,5 − 0,25 = 7,25: il mazzo passa **In osservazione** e resta F2.

Vince di nuovo, al turno 6 con le creature. Nuovo TMV ≈ **6,98** → dentro F3 con margine → **promosso a F3**. La notifica al gruppo dice: "Krenko sale in F3: vince in media al turno 7,0 nelle ultime 5 vittorie (soglia F3: 7,5)".

### 3.9 Parametri di default (configurabili)

```json
{
  "finestraVittorie": 8,
  "finestraPartiteDominio": 10,
  "decadimento": 0.85,
  "minVittorieVelocita": 3,
  "minPartiteDominio": 6,
  "minPartiteInefficacia": 8,
  "margineIsteresi": 0.25,
  "cooldownPartite": 3,
  "dominioAlto": 1.8,
  "dominioBasso": 0.35,
  "soglieTMV": { "F5": 3.5, "F4": 5.5, "F3": 7.5, "F2": 9.5 },
  "maxGameChangerF3": 5,
  "pesoEliminazione": 0.5,
  "modificatoriVittoria": {
    "creature": 0, "comandante": 0, "drain": 0, "mill": 0,
    "veleno": -0.5, "esplosivo": -0.5, "lock": -0.5,
    "combo": -1, "alternativa": -1, "turniExtra": -1,
    "superstite": 1
  },
  "minutiPerGiroDefault": 12,
  "pesoTurnoStimato": 0.75,
  "formati": "vedi tabella §3.10, stessi campi per ogni formato"
}
```

### 3.10 Formati di gioco

Il gruppo non gioca solo la classica partita a 4. Ogni partita ha un **formato**, e ogni formato ha parametri che dicono al motore quanto quella partita è indicativa della forza del mazzo.

**Perché servono i parametri.** In una partita a 3 ci sono meno punti vita da togliere (80 invece di 120) e meno avversari che interagiscono, quindi si vince prima. Senza correzione, un mazzo che gioca spesso in 3 sembrerebbe più veloce di quanto è. Il **fattore turno** riporta tutto all'equivalente di una partita a 4: una vittoria al turno 6 in tre giocatori, con fattore 1,15, conta come una vittoria al turno 6,9. Nei formati in cui la vittoria dipende molto dalla squadra o dal ruolo, il peso scende o la partita conta solo per le statistiche.

| Formato | Giocatori | Condizione di vittoria | Fattore turno | Peso velocità | Contendenti (per D) | Peso dominio | Conta per le fasce |
|---|---|---|---|---|---|---|---|
| Tutti contro tutti (standard) | 4 | Ultimo in piedi | 1,00 | 1 | 4 | 1 | Sì |
| Tutti contro tutti a 3 | 3 | Ultimo in piedi | 1,15 | 1 | 3 | 1 | Sì |
| Tutti contro tutti a 5–6 | 5–6 | Ultimo in piedi | 0,95 | 0,75 | n | 0,75 | Sì |
| 1v1 Commander (40 vita) | 2 | Eliminare l'avversario | 1,30 | 0,5 | 2 | 0,5 | Sì |
| Duel Commander (20 vita, regole duel) | 2 | Eliminare l'avversario | 1,50 | 0 | 2 | 0 | No, solo statistiche (lista ban e mazzi diversi) |
| Star / Pentagramma | 5 | Eliminare i due nemici non adiacenti | 1,00 | 0,75 | 5 | 0,75 | Sì |
| Two-Headed Giant / 2v2 | 4 in 2 squadre | Eliminare la squadra avversaria | 1,10 | 0,5 | 2 squadre | 0,5 | Sì |
| Emperor (3v3) | 6 in 2 squadre | Eliminare l'imperatore avversario | 1,00 | 0,25 | 2 squadre | 0,25 | No, solo statistiche |
| MTG Treachery | 4–8 | Obiettivo del proprio ruolo (Leader, Guardiano, Assassino, Traditore) | — | 0 | — | 0 | No, solo statistiche |
| Archenemy | 1 contro squadra | Arcinemico contro tutti | — | 0 | — | 0 | No, solo statistiche |
| Personalizzato | libero | libera | configurabile | configurabile | configurabile | configurabile | configurabile |

**Varianti combinabili** (si aggiungono a qualunque formato, scelte in lobby):
- **Planechase**: moltiplica peso velocità e peso dominio per 0,75 (più caos, partita meno indicativa);
- **Monarca / Iniziativa di partenza** o altre regole di casa: si possono creare come varianti personalizzate con un proprio moltiplicatore.

**Regole di calcolo per tipo di formato:**
- *Tutti contro tutti (3, 4, 5–6, Star):* vince un giocatore. Se il gruppo ammette vittorie condivise (succede nello Star), ogni vincitore riceve una quota 1/k di vittoria.
- *A squadre (2v2, Emperor):* ogni mazzo della squadra vincitrice riceve un dato di velocità con il peso del formato e una vittoria piena nel calcolo di D, con contendenti = numero di squadre.
- *A ruoli (Treachery, Archenemy):* in lobby si registrano anche i ruoli; le statistiche mostrano il win rate per ruolo e per mazzo, ma per default il motore fasce le ignora.
- *1v1:* conta, ma a peso ridotto perché il risultato dipende molto dall'accoppiamento tra i due mazzi.

**Taratura automatica dei fattori turno:** dopo almeno 20 partite in un formato, l'app confronta il turno medio di vittoria degli stessi mazzi in quel formato e nella partita standard a 4, e propone all'admin un nuovo fattore. Il cambio va approvato e comporta il ricalcolo dello storico (§3.7). Così i valori di partenza, che sono stime ragionevoli, si adattano al vostro gruppo.

Ogni formato è un oggetto di configurazione del gruppo con questi campi: `id`, `nome`, `giocatoriMin`, `giocatoriMax`, `tipo` (ffa, squadre, ruoli, duello), `fattoreTurno`, `pesoVelocita`, `pesoDominio`, `contaPerFasce`, `ruoli[]` (per i formati a ruoli). L'admin può modificarli e crearne di nuovi.

---

## 4. Funzionalità dell'app

### 4.1 Account e gruppi
- **Stadio privato:** accesso con l'account GitHub di ogni amico (token personale, vedi §6.7); solo i membri invitati nell'organizzazione e presenti nell'elenco membri possono entrare. Un solo gruppo di gioco.
- **Stadio pubblico:** registrazione e login con email, Google e Apple (Firebase Auth); **gruppi multipli** con codice invito, un utente può stare in più gruppi.
- Ruoli: **Admin** (gestisce membri, parametri del motore, stagioni) e **Giocatore**.
- Profilo con avatar, nickname, colori preferiti, statistiche personali.

### 4.2 Mazzi
- **Import da Archidekt** tramite URL (dal browser o tramite GitHub Action, §6.8).
- **Import da Moxfield** tramite URL con tentativo via GitHub Action (§6.8); se Moxfield blocca la richiesta, l'app guida l'utente a usare **"Export → Copia testo"** e incollare la lista. L'import da testo funziona sempre e per qualunque sito.
- Arricchimento automatico dei dati carta con Scryfall (immagini, costo, colori, tipo, flag game changer) usando l'endpoint di ricerca a blocchi per non superare i limiti di frequenza.
- **Wizard di autovalutazione**: mostra game changer trovati, combo rilevate, carte sospette (terre distrutte, turni extra), chiede conferme e la fascia iniziale dichiarata.
- **Versioni del mazzo**: ogni reimport crea una versione con diff (carte entrate/uscite).
- Scheda mazzo: comandante, identità di colore, curva di mana, distribuzione tipi, game changer, combo, storico fasce (grafico a gradini), metriche TMV e D con spiegazione, tipi di vittoria (grafico a ciambella), avversari più battuti/che lo battono.

### 4.3 Partite

Il ciclo di vita di una partita ha tre momenti, e l'app si usa solo nel primo e nell'ultimo.

**1. Lobby (prima della partita)**
- Chiunque del gruppo crea il tavolo: sceglie il **formato** (e le eventuali varianti), i giocatori presenti e i mazzi. L'app propone i mazzi per bilanciare il tavolo (§4.5).
- Nei formati a squadre si compongono le squadre; nei formati a ruoli si registrano i ruoli (si possono anche inserire a fine partita, quando sono stati rivelati).
- Si sceglie il **registratore**: l'unica persona che potrà chiudere la partita e che terrà il conto dei turni con il dado. Per default è chi ha creato il tavolo.
- Tocco su **"Inizia"**: salva l'orario di inizio e mostra al registratore un promemoria: "Metti il dado su 1 accanto a [nome del primo giocatore]". Da qui l'app non chiede più nulla.

**2. In corso**
- Nessuna interazione con l'app. L'unico compito è del registratore: girare il dado a ogni nuovo turno del primo giocatore. La partita appare come "In corso" e le notifiche dell'app sono silenziate per tutti i partecipanti.
- Se si dimentica la partita aperta, dopo 6 ore il registratore riceve un promemoria.

**3. Chiusura (dopo la partita, solo il registratore)**
- Schermata unica, pensata per 3 tocchi: **vincitore** (o squadra/ruolo vincente), **turno letto sul dado** (selettore numerico grande; il pulsante "Non ho contato, usa la stima" inserisce il valore calcolato dalla durata), **tipo di vittoria**.
- Sezione "Dettagli" chiusa per default: eliminazioni (chi, da chi, a che turno), partita non rappresentativa, note, foto del tavolo.
- Al salvataggio la partita è **subito ufficiale**: il calcolo ufficiale aggiorna le fasce e il gruppo riceve le notifiche.

**Riapertura (reclaim)**
- Qualunque partecipante può chiedere di riaprire una partita ufficiale, indicando il motivo (es. "il turno era 8, non 7").
- La riapertura avviene solo se **tutti i partecipanti** approvano. Finché manca anche un solo voto, la partita resta com'è.
- Approvata la riapertura, il registratore corregge i dati; al nuovo salvataggio il calcolo ufficiale ricalcola lo storico dei mazzi coinvolti (§3.7) e mostra cosa è cambiato.
- Se la richiesta non raccoglie tutti i voti entro 7 giorni, scade.

**Storico** con filtri per data, formato, giocatore, mazzo, fascia e tipo di vittoria.

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

---

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
.github/workflows/                recalc.yml, import.yml
schemas/                          schema JSON di ogni tipo di file
```

**Un file per partita e un file per voto:** scritture contemporanee di persone diverse non si scontrano mai. Gli identificativi sono generati sul dispositivo (ULID), quindi unici anche offline.

I campi di ogni file sono quelli del modello dati in §6.6.

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

---

## 7. Roadmap

Il dettaglio delle voci, con dipendenze e test, è in `PIANO-Funzionalita.md`. In sintesi: fondamenta → funzionalità core sul repository dati (stadio 1) → funzionalità secondarie → app Android e iOS (stadio 2) → migrazione a Firebase e pubblicazione (stadio 3).

---

## 8. Decisioni del gruppo

| # | Tema | Decisione |
|---|---|---|
| 1 | Modificatori per tipo di vittoria | Si parte con quelli di §3.3; si rivedono dopo le prime partite (sono parametri, si cambiano senza toccare il codice). |
| 2 | Partite a 3, a 5 e altri formati | Tutte registrabili. Le partite a 3 contano con fattore turno 1,15; 1v1, Star, 2v2 e gli altri formati sono gestiti come in §3.10, con pesi ridotti o solo statistiche dove il risultato dipende da squadra o ruolo. |
| 3 | Chi registra la partita | Un solo registratore scelto in lobby; solo lui chiude la partita. Per correggerla serve la riapertura approvata da tutti i partecipanti (§4.3). |
| 4 | Fascia F5 | Resta disponibile, solo su dichiarazione o conferma del proprietario. |
| 5 | Uso dell'app durante la partita | Vietato per design: tutto avviene in lobby o in chiusura (regola d'oro, §1). |
| 7 | Dati e hosting iniziali | Prima versione locale sul PC, poi JSON su repository Git privato in un'organizzazione GitHub, calcoli con GitHub Actions, app su GitHub Pages con repository del codice pubblico e dati privati. Firebase solo allo stadio pubblico (§6). |
| 8 | App native | Struttura pronta per Android e iOS con Capacitor fin dall'inizio (§6.9). |
| 6 | Conteggio dei turni | Lo fa il registratore con un dado fisico, unica azione durante la partita. La stima dalla durata è solo un ripiego e pesa meno. |

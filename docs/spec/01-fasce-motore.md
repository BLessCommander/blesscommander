# Fasce e motore di valutazione (SPEC §2–§3.9)

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

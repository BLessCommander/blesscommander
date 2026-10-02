# Partite (SPEC §4.3)

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

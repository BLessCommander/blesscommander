# Roadmap e decisioni (SPEC §7–§8)

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

# Bracketeer — Indice della specifica

> La specifica è divisa in moduli: si legge solo quello che serve alla voce di lavoro (vedi `docs/PIANO-Funzionalita.md`). Il contenuto è quello del vecchio `SPEC.md`, senza modifiche.

| Modulo | Contenuto | Sezioni originali |
|---|---|---|
| `00-indice.md` | Obiettivo, regola d'oro, account e gruppi | §1, §4.1 |
| `01-fasce-motore.md` | Fasce, metodo di valutazione, regole di decisione, parametri | §2–§3.9 |
| `02-formati.md` | Formati di gioco e relativi parametri | §3.10 |
| `03-partite.md` | Lobby, partita in corso, chiusura, riapertura | §4.3 |
| `04-mazzi-import.md` | Mazzi, import, wizard di autovalutazione, rilevamento automatico | §4.2 e parti di §3.2 |
| `05-ui-responsive.md` | Motore e trasparenza, tavolo, statistiche, utilità, design, responsive, pagine | §4.4–§4.7, §5 |
| `06-architettura-dati.md` | Stadi, stack, DataProvider, repository, sicurezza, locale e Pages | §6 |
| `07-roadmap-decisioni.md` | Roadmap e decisioni del gruppo | §7–§8 |

---

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

---

## 4. Funzionalità dell'app

### 4.1 Account e gruppi
- **Stadio privato:** accesso con l'account GitHub di ogni amico (token personale, vedi §6.7); solo i membri invitati nell'organizzazione e presenti nell'elenco membri possono entrare. Un solo gruppo di gioco.
- **Stadio pubblico:** registrazione e login con email, Google e Apple (Firebase Auth); **gruppi multipli** con codice invito, un utente può stare in più gruppi.
- Ruoli: **Admin** (gestisce membri, parametri del motore, stagioni) e **Giocatore**.
- Profilo con avatar, nickname, colori preferiti, statistiche personali.

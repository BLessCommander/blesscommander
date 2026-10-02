# Guida alle sessioni con Claude Code

> Da leggere dopo aver completato `/avvio`. Spiega come lavorare una voce del piano alla volta, come vedere l'app in locale e come tenere basso il consumo di token.

## Vedere l'app in locale

Dalla voce B-01 l'app si avvia sempre in locale, senza configurazione, in modalità demo con dati di prova:

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Avvia l'app sul PC; apri l'indirizzo mostrato nel terminale (di solito `http://localhost:5173`) |
| `npm run dev:lan` | Come sopra, ma raggiungibile dal telefono sulla stessa rete Wi-Fi: apri sul telefono l'indirizzo "Network" mostrato nel terminale |
| `npm run dev:fake-github` | Collega l'app alla finta API GitHub locale, per provare accesso e salvataggi come se fosse online |
| `npm run preview` | Mostra la versione di produzione, identica a quella che andrà su GitHub Pages |

I comandi `dev:lan`, `dev:fake-github` e `preview` completi arrivano con la voce B-08; `npm run dev` funziona da B-01. Per fermare l'app: `Ctrl + C` nel terminale.

Se Windows chiede il permesso al firewall per Node.js su `dev:lan`, consenti l'accesso solo alle reti private.

## Come risparmiamo token senza perdere qualità

Il problema: ogni messaggio in una sessione rimanda a Claude tutta la conversazione precedente, compresi file letti e output dei comandi. Una sessione lunga costa sempre di più e, quando si riempie, Claude riassume automaticamente perdendo dettagli. La soluzione è tenere le informazioni importanti **su file** e le conversazioni **corte**.

| Tecnica | Come funziona | Risparmio |
|---|---|---|
| **Una funzionalità = una sessione** | Si lavora su una voce del piano (es. C-05) e poi si chiude con `/clear` | Ogni sessione riparte leggera |
| **Memoria su file** | Lo stato del lavoro vive in `docs/PIANO-Funzionalita.md` (caselle + "Passaggio di consegne"), le regole fisse in `CLAUDE.md` | Niente da ripetere a mano |
| **CLAUDE.md snello** | Sotto 150 righe: solo regole sempre valide + indice dei documenti con "quando leggerli" | Viene caricato a ogni sessione, quindi deve costare poco |
| **Specifica a moduli** | `SPEC.md` viene divisa in `docs/spec/01-…md`, `02-…md` ecc.; si legge solo il modulo indicato nel piano | Si leggono 50–100 righe invece di 600 |
| **Subagent** | Test, lettura degli output lunghi e analisi degli screenshot avvengono in subagent con contesto separato, che restituiscono solo un riepilogo | Log e immagini non entrano nella conversazione principale |
| **Output compatti** | Test con reporter sintetico, riesecuzione solo dei falliti, lettura dei file per intervalli di righe, niente `node_modules`/`dist` | Gli output dei comandi sono la voce di consumo più grande |
| **Comandi personalizzati** | `/riprendi`, `/testa`, `/revisione-ui`, `/consegna` in `.claude/commands/` | Prompt di sessione di una riga |
| **`/compact` mirato** | Se una sessione si allunga prima di finire: `/compact mantieni solo stato di <ID>, file toccati, test rossi` | Riassunto guidato invece di quello automatico |

Comandi utili da ricordare: `/context` mostra quanto contesto è occupato; `/clear` azzera la conversazione (i file restano); `/compact <istruzioni>` riassume mantenendo ciò che indichi.

---

## Prompt di sessione (uno per voce del piano)

Dopo `/avvio`, ogni sessione è breve. Flusso tipico:

```
/clear
/riprendi B-03
```

Claude legge solo ciò che serve e propone il piano della voce. Approvi, lavora, poi:

```
/testa B-03
/revisione-ui B-03
/consegna
```

Fai il commit, poi `/clear` e passa alla voce successiva.

**Prompt pronti per i momenti tipici**

- Iniziare una voce specifica:
  `/riprendi C-05`
- Proseguire una voce rimasta a metà:
  `/riprendi` (legge il passaggio di consegne e riparte da lì)
- Sessione che si sta allungando:
  `/compact mantieni solo: voce in corso, file toccati, test ancora rossi, decisioni prese`
- Bug trovato a mano:
  `Su iPhone, nella chiusura partita, il selettore del turno è coperto dalla bottom nav. Riproducilo con un test Playwright sul profilo iphone, correggi, poi /testa C-10 e /revisione-ui C-10.`
- Dubbio su un risultato visivo:
  `/revisione-ui C-12`
- Controllo generale prima del deploy:
  `Esegui tramite test-runner l'intera suite @core su tutti i profili e riportami solo il riepilogo.`

**Ordine consigliato:** B-00 (con `/avvio`), B-01…B-06, B-08 (versione locale completa), poi C-01 (il motore si testa senza interfaccia), poi B-07 (repository dati e Action, che usa il motore), poi le altre voci C nell'ordine del piano, deploy (C-15), le voci S e infine le voci E (app native, Firebase, store).

---

## Consigli d'uso

- Fai un commit alla fine di ogni voce: se qualcosa si rompe torni indietro facilmente.
- Quando qualcosa non va, incolla l'errore esatto, non "non funziona". Se è un problema visivo, una foto dello schermo del telefono aiuta molto.
- Se cambiate un parametro del motore (modificatori, soglie), si cambia dalla pagina Gruppo dell'app: non serve una sessione di Claude.
- Ogni tanto controlla con `/context` quanto spazio è occupato. Se sei sopra metà e la voce non è finita, usa `/compact` con istruzioni; se la voce è finita, `/consegna` e `/clear`.

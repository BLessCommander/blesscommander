---
description: Inizio sessione - legge il passaggio di consegne e propone il piano della prossima voce
argument-hint: [ID voce, es. C-01]
---

Applica il protocollo di inizio sessione di CLAUDE.md.

1. Leggi CLAUDE.md. Poi, in `docs/PIANO-Funzionalita.md`, leggi SOLO la sezione "Passaggio di consegne" e la riga della voce di lavoro (non l'intero file).
2. La voce di lavoro è `$ARGUMENTS` se indicata; altrimenti è il "Prossimo passo consigliato" del passaggio di consegne. Controlla che le sue dipendenze (colonna "Dip.") siano spuntate `[x]`; se non lo sono, dillo e proponi la voce corretta da fare prima.
3. Leggi solo i moduli di specifica (`docs/spec/`) e i casi di test (`docs/PIANO-Test.md`) indicati nelle colonne "Spec" e "Test" di quella voce, per intervalli di righe. Se serve capire codice esistente in modo ampio, usa il subagent `code-explorer`.
4. Presenta un piano breve: cosa farai, quali file toccherai, quali test scriverai, cosa potrà vedere l'utente in locale a fine voce. Rispetta le regole non negoziabili di CLAUDE.md.
5. Aspetta l'approvazione dell'utente prima di scrivere codice. Lavora su UNA sola voce.

Parla in italiano, in modo semplice.

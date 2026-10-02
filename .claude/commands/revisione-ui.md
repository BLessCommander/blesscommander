---
description: Genera gli screenshot delle schermate toccate da una voce e li fa revisionare dal subagent ui-reviewer
argument-hint: <ID voce, es. C-08>
---

Esegui la revisione screenshot di `docs/PIANO-Test.md` §5 per la voce `$ARGUMENTS`. Se l'ID manca, chiedilo.

1. Individua le schermate toccate dalla voce (dalla riga in `docs/PIANO-Funzionalita.md` e dai file modificati, con `git status`/`git diff --stat`).
2. Genera gli screenshot di quelle schermate sui profili `iphone` e `desktop-chrome`, in tema chiaro e scuro, con `npm run test:visual-review` (salva in `review-screenshots/`). Lancia il comando tramite il subagent `test-runner` e fatti restituire solo l'elenco dei file creati.
3. Passa l'elenco dei percorsi al subagent `ui-reviewer`. NON aprire mai gli screenshot nella conversazione principale.
4. Riporta all'utente solo i problemi restituiti (schermata, profilo, tema, problema, gravità, suggerimento).
5. Correggi i problemi di gravità alta e media, rigenera gli screenshot interessati e ripassali a `ui-reviewer`, fino a "nessun problema".

Se lo script `test:visual-review` non esiste (voce B-03 non completata), dillo e fermati.

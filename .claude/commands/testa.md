---
description: Esegue il ciclo di test di docs/PIANO-Test.md §6 per una voce del piano
argument-hint: <ID voce, es. C-01>
---

Esegui il ciclo di lavoro di `docs/PIANO-Test.md` §6 per la voce `$ARGUMENTS`. Se l'ID manca, chiedilo.

1. Dalla riga della voce in `docs/PIANO-Funzionalita.md` ricava i casi di test (colonna "Test") e leggi solo quei casi in `docs/PIANO-Test.md` (§7–§9), non l'intero file.
2. Verifica che esistano i test (unitari in Vitest, `tests/e2e/<id>.spec.js` per Playwright). Se mancano, scrivili seguendo §6 punti 1–3 prima di eseguirli.
3. Esegui i test SEMPRE tramite il subagent `test-runner`, mai direttamente: prima Vitest, poi Playwright sui 6 profili per i test `@ui` (un solo profilo per i test `@api`).
4. Correggi i problemi e riesegui solo i falliti (`--last-failed`) tramite `test-runner`, fino a che sono tutti verdi. Non incollare mai log nella conversazione.
5. Quando sono verdi, esegui una volta la suite `@core` completa per verificare le regressioni (sempre tramite `test-runner`).
6. Riassumi all'utente in pochi righe: totali passati/falliti, cosa hai corretto, cosa resta aperto. Se la revisione screenshot non è stata fatta, ricorda `/revisione-ui $ARGUMENTS`.

Se l'infrastruttura di test non esiste ancora (voce B-03 non completata), dillo e fermati.

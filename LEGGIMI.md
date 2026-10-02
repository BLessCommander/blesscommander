# Bracketeer — Pacchetto di avvio

Questo pacchetto contiene tutto ciò che serve per far costruire l'app a Claude Code: la specifica, i piani di lavoro e di test, e un comando che ti guida passo passo nella configurazione di GitHub.

## Cosa ti serve prima di aprire il pacchetto

1. **VS Code** — code.visualstudio.com
2. **Estensione Claude Code** — dal pannello Estensioni di VS Code, cerca "Claude Code".
3. **Un account Claude** con un piano che includa Claude Code (verifica su claude.com/pricing) e l'accesso effettuato nell'estensione.

Git, Node.js, GitHub CLI, l'account GitHub e l'organizzazione li controlla e ti guida a configurarli il comando `/avvio`: non serve prepararli prima.

## Come iniziare

1. Estrai lo zip in una cartella stabile, per esempio `Documenti/bracketeer`. Evita cartelle sincronizzate (OneDrive, Dropbox): rallentano molto `node_modules`.
2. In VS Code: **File → Apri cartella** e scegli la cartella estratta.
3. Apri il pannello di Claude Code e scrivi:
   ```
   /avvio
   ```
4. Segui la guida. Ti chiederà una cosa alla volta e verificherà ogni passo. Puoi interrompere quando vuoi: rilanciando `/avvio` riparte da dove eri rimasto.

Alla fine della configurazione Claude inizia a sviluppare. Dalla prima voce del piano potrai vedere l'app in locale con `npm run dev`, anche dal telefono sulla stessa rete Wi-Fi.

## Contenuto del pacchetto

| File | A cosa serve |
|---|---|
| `LEGGIMI.md` | Questo file |
| `CLAUDE.md` | Istruzioni iniziali per Claude Code (verrà riscritto da Claude) |
| `.claude/commands/avvio.md` | Il comando `/avvio`: configurazione guidata e prompt di avvio dello sviluppo |
| `.claude/settings.json` | Impedisce a Claude di leggere file sensibili (`.env`) e cartelle inutili |
| `docs/SPEC.md` | Specifica completa dell'app (Claude la dividerà in moduli) |
| `docs/PIANO-Funzionalita.md` | Voci di lavoro (fondamenta, core, secondarie, evoluzione) e registro di avanzamento |
| `docs/PIANO-Test.md` | Strategia e casi di test automatici |
| `docs/SETUP-GitHub.md` | Manuale di riferimento su GitHub: organizzazione, repository, token, amici |
| `docs/GUIDA-Sessioni.md` | Come lavorare con Claude Code una sessione alla volta, risparmiando token |

## Dopo la configurazione

Leggi `docs/GUIDA-Sessioni.md`. In breve, ogni sessione è:
```
/clear
/riprendi
```
poi approvi il piano, Claude lavora, e chiudi con `/testa <voce>`, `/revisione-ui <voce>`, `/consegna`.

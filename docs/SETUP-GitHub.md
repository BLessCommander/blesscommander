# Manuale di riferimento: GitHub per Bracketeer

> Il comando `/avvio` esegue la configurazione iniziale passo passo con te. Questo manuale serve per capire cosa è stato fatto, per le fasi successive (prove, pubblicazione, amici) e in caso di problemi.

---

## 1. Riepilogo di cosa serve e quando

| Cosa | Dove | Quando |
|---|---|---|
| VS Code + estensione Claude Code + account Claude | code.visualstudio.com, claude.com/pricing | Prima di aprire il pacchetto |
| Git, Node.js LTS, GitHub CLI | git-scm.com, nodejs.org, cli.github.com | `/avvio`, passo 2 |
| Account GitHub personale (uno solo) | github.com/signup | `/avvio`, passo 3 |
| Organizzazione GitHub gratuita | github.com/account/organizations/new | `/avvio`, passo 6 |
| Tre repository | creati da Claude con la tua conferma | `/avvio`, passo 8 |
| Token personali e secret | GitHub → Settings → Developer settings | Voce B-07 |
| Utenti di prova | file di configurazione, nessun account | Voce C-04b |
| Pubblicazione su GitHub Pages | automatica via Actions | Voce C-15 |
| Android Studio / Mac con Xcode | developer.android.com / Mac App Store | Voce E-01 |

**Non creare account GitHub di prova.** I Termini di GitHub permettono un solo account gratuito per persona (più al massimo un account "macchina" per automazioni). Gli utenti di prova sono utenti finti dell'app (§5).

**Mai incollare token in chat**, né qui né in Claude Code.

---

## 2. Perché un'organizzazione e tre repository

- I **token personali fine-grained**, che permettono di dare a ogni amico accesso solo ai dati, funzionano sui repository di un'**organizzazione** di cui l'amico è membro. Non funzionano se l'amico è solo collaboratore di un repository del tuo account personale.
- L'organizzazione è gratuita e permette **team** con permessi diversi.

| Repository | Contenuto | Visibilità |
|---|---|---|
| `<app>` | Codice | Privato durante lo sviluppo locale, **pubblico** dalla pubblicazione su GitHub Pages |
| `<app>-data` | Dati reali del gruppo | Sempre privato |
| `<app>-data-test` | Dati di prova con utenti finti | Sempre privato, solo tu |

**Perché il codice diventa pubblico:** GitHub Pages gratuito pubblica solo da repository pubblici. Il repository del codice non contiene dati né segreti: i token stanno sui dispositivi e nei secret di GitHub, che restano protetti anche nei repository pubblici. Chiunque può aprire l'indirizzo dell'app, ma senza il token di un membro autorizzato vede solo la schermata di accesso. Se in futuro voleste il codice privato: Cloudflare Pages (gratuito con repository privati) o un piano GitHub a pagamento.

---

## 3. Cosa fa `/avvio` (in sintesi)

1. Verifica Git, Node.js, npm e GitHub CLI.
2. Ti guida a creare o verificare l'account GitHub, con autenticazione a due fattori ed email privata.
3. Imposta nome ed email di Git.
4. Collega il PC a GitHub con `gh auth login` (lo esegui tu nel terminale) e aggiunge i permessi per organizzazione e workflow.
5. Ti guida a creare l'organizzazione dal browser e la verifica.
6. Imposta l'organizzazione: membri senza accesso di base, nessuna creazione di repository da parte dei membri, token fine-grained consentiti e token classic limitati.
7. Crea i tre repository privati, carica il pacchetto nel repository del codice e abilita la scrittura per le Actions nei repository dati.
8. Salva le scelte (non segrete) in `docs/progetto.json`.

---

## 4. Token personali (voce B-07)

**Il tuo token per l'app**
1. GitHub → foto profilo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Resource owner:** la tua organizzazione.
3. **Expiration:** scadenza lunga (es. un anno).
4. **Repository access:** *Only select repositories* → `<app>-data` e `<app>-data-test`.
5. **Permissions → Repository permissions → Contents:** *Read and write*. Nient'altro.
6. Genera e incollalo subito nella schermata di accesso dell'app.

**Il secret `DATA_REPO_TOKEN`** (serve al repository del codice per pubblicare il motore aggiornato nei repository dati)
1. Crea un secondo token con le stesse impostazioni.
2. Repository del codice → **Settings → Secrets and variables → Actions → New repository secret**, nome `DATA_REPO_TOKEN`, valore il token.

---

## 5. Prove con utenti finti (voce C-04b)

- `<app>-data-test` ha in `config/group.json` `testMode: true` e `testOperators` con il tuo login.
- `config/members.json` di prova contiene 4 utenti finti: `test-admin` (admin), `test-giocatore1`, `test-giocatore2`, `test-giocatore3`.
- Nell'app scegli l'ambiente di prova: compare il banner **MODALITÀ PROVA** e il selettore **"Agisci come"**. Puoi provare da solo lobby, chiusura riservata al registratore, voti all'unanimità, parametri da admin.
- Sul repository dei dati reali la modalità prova non si attiva: lo controllano sia l'app sia l'Action.

---

## 6. Pubblicazione su GitHub Pages (voce C-15)

Claude esegue, chiedendo conferma a ogni passo:
1. una scansione della storia Git del codice per verificare che non contenga token o file `.env`;
2. il cambio di visibilità del repository del codice a **pubblico**;
3. l'attivazione di GitHub Pages con sorgente **GitHub Actions** (repository → Settings → Pages);
4. il workflow che, a ogni push su `main` con test verdi, pubblica l'app.

L'indirizzo sarà `https://<organizzazione>.github.io/<app>/`.

---

## 7. Amici veri (quando l'app è pronta)

1. Organizzazione → **Teams → New team**: `giocatori`, visibilità "Secret".
2. Nel team → **Repositories → Add repository** → `<app>-data`, ruolo **Write**. Non aggiungere il repository di prova.
3. **People → Invite member** per ogni amico, nel team `giocatori`, ruolo **Member** (tu resti **Owner**).
4. Aggiungi l'amico in `config/members.json` dalla pagina Gruppo dell'app.
5. L'amico crea il suo token come al §4 (solo `<app>-data`) e lo incolla nell'app.

Per togliere l'accesso: rimuovi la persona dall'organizzazione.

---

## 8. Costi

Gratuito: account, organizzazione, repository, GitHub Actions entro la quota mensile del piano gratuito, GitHub Pages. L'unico costo è il piano Claude che include Claude Code. Le spese per gli store arrivano solo con la pubblicazione delle app.

---

## 9. Problemi frequenti

| Problema | Soluzione |
|---|---|
| `gh` o `node` "non riconosciuto" dopo l'installazione | Chiudi e riapri VS Code |
| `gh api` risponde 403 su impostazioni dell'organizzazione | `gh auth refresh -h github.com -s admin:org,workflow` |
| Il push del workflow viene rifiutato | Manca il permesso `workflow`: stesso comando sopra |
| Il telefono non apre `dev:lan` | PC e telefono sulla stessa rete Wi-Fi; consenti Node.js nel firewall per le reti private |
| L'app dice "token non valido" | Token scaduto, resource owner sbagliato o repository non selezionato: rifallo come al §4 |

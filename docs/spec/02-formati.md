# Formati di gioco (SPEC §3.10)

### 3.10 Formati di gioco

Il gruppo non gioca solo la classica partita a 4. Ogni partita ha un **formato**, e ogni formato ha parametri che dicono al motore quanto quella partita è indicativa della forza del mazzo.

**Perché servono i parametri.** In una partita a 3 ci sono meno punti vita da togliere (80 invece di 120) e meno avversari che interagiscono, quindi si vince prima. Senza correzione, un mazzo che gioca spesso in 3 sembrerebbe più veloce di quanto è. Il **fattore turno** riporta tutto all'equivalente di una partita a 4: una vittoria al turno 6 in tre giocatori, con fattore 1,15, conta come una vittoria al turno 6,9. Nei formati in cui la vittoria dipende molto dalla squadra o dal ruolo, il peso scende o la partita conta solo per le statistiche.

| Formato | Giocatori | Condizione di vittoria | Fattore turno | Peso velocità | Contendenti (per D) | Peso dominio | Conta per le fasce |
|---|---|---|---|---|---|---|---|
| Tutti contro tutti (standard) | 4 | Ultimo in piedi | 1,00 | 1 | 4 | 1 | Sì |
| Tutti contro tutti a 3 | 3 | Ultimo in piedi | 1,15 | 1 | 3 | 1 | Sì |
| Tutti contro tutti a 5–6 | 5–6 | Ultimo in piedi | 0,95 | 0,75 | n | 0,75 | Sì |
| 1v1 Commander (40 vita) | 2 | Eliminare l'avversario | 1,30 | 0,5 | 2 | 0,5 | Sì |
| Duel Commander (20 vita, regole duel) | 2 | Eliminare l'avversario | 1,50 | 0 | 2 | 0 | No, solo statistiche (lista ban e mazzi diversi) |
| Star / Pentagramma | 5 | Eliminare i due nemici non adiacenti | 1,00 | 0,75 | 5 | 0,75 | Sì |
| Two-Headed Giant / 2v2 | 4 in 2 squadre | Eliminare la squadra avversaria | 1,10 | 0,5 | 2 squadre | 0,5 | Sì |
| Emperor (3v3) | 6 in 2 squadre | Eliminare l'imperatore avversario | 1,00 | 0,25 | 2 squadre | 0,25 | No, solo statistiche |
| MTG Treachery | 4–8 | Obiettivo del proprio ruolo (Leader, Guardiano, Assassino, Traditore) | — | 0 | — | 0 | No, solo statistiche |
| Archenemy | 1 contro squadra | Arcinemico contro tutti | — | 0 | — | 0 | No, solo statistiche |
| Personalizzato | libero | libera | configurabile | configurabile | configurabile | configurabile | configurabile |

**Varianti combinabili** (si aggiungono a qualunque formato, scelte in lobby):
- **Planechase**: moltiplica peso velocità e peso dominio per 0,75 (più caos, partita meno indicativa);
- **Monarca / Iniziativa di partenza** o altre regole di casa: si possono creare come varianti personalizzate con un proprio moltiplicatore.

**Regole di calcolo per tipo di formato:**
- *Tutti contro tutti (3, 4, 5–6, Star):* vince un giocatore. Se il gruppo ammette vittorie condivise (succede nello Star), ogni vincitore riceve una quota 1/k di vittoria.
- *A squadre (2v2, Emperor):* ogni mazzo della squadra vincitrice riceve un dato di velocità con il peso del formato e una vittoria piena nel calcolo di D, con contendenti = numero di squadre.
- *A ruoli (Treachery, Archenemy):* in lobby si registrano anche i ruoli; le statistiche mostrano il win rate per ruolo e per mazzo, ma per default il motore fasce le ignora.
- *1v1:* conta, ma a peso ridotto perché il risultato dipende molto dall'accoppiamento tra i due mazzi.

**Taratura automatica dei fattori turno:** dopo almeno 20 partite in un formato, l'app confronta il turno medio di vittoria degli stessi mazzi in quel formato e nella partita standard a 4, e propone all'admin un nuovo fattore. Il cambio va approvato e comporta il ricalcolo dello storico (§3.7). Così i valori di partenza, che sono stime ragionevoli, si adattano al vostro gruppo.

Ogni formato è un oggetto di configurazione del gruppo con questi campi: `id`, `nome`, `giocatoriMin`, `giocatoriMax`, `tipo` (ffa, squadre, ruoli, duello), `fattoreTurno`, `pesoVelocita`, `pesoDominio`, `contaPerFasce`, `ruoli[]` (per i formati a ruoli). L'admin può modificarli e crearne di nuovi.

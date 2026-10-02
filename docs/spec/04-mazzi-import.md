# Mazzi e import (SPEC §4.2 e parti di §3.2)

### 4.2 Mazzi
- **Import da Archidekt** tramite URL (dal browser o tramite GitHub Action, §6.8).
- **Import da Moxfield** tramite URL con tentativo via GitHub Action (§6.8); se Moxfield blocca la richiesta, l'app guida l'utente a usare **"Export → Copia testo"** e incollare la lista. L'import da testo funziona sempre e per qualunque sito.
- Arricchimento automatico dei dati carta con Scryfall (immagini, costo, colori, tipo, flag game changer) usando l'endpoint di ricerca a blocchi per non superare i limiti di frequenza.
- **Wizard di autovalutazione**: mostra game changer trovati, combo rilevate, carte sospette (terre distrutte, turni extra), chiede conferme e la fascia iniziale dichiarata.
- **Versioni del mazzo**: ogni reimport crea una versione con diff (carte entrate/uscite).
- Scheda mazzo: comandante, identità di colore, curva di mana, distribuzione tipi, game changer, combo, storico fasce (grafico a gradini), metriche TMV e D con spiegazione, tipi di vittoria (grafico a ciambella), avversari più battuti/che lo battono.

### Dal §3.2: rilevamento automatico delle caratteristiche del mazzo

> Estratto di §3.2 (il testo completo, con la formula del pavimento, è in `01-fasce-motore.md`).

- I **game changer** si rilevano con Scryfall (ricerca `is:gamechanger`), così la lista è sempre aggiornata senza toccare il codice.
- Le **combo** si rilevano con l'API di Commander Spellbook passando la decklist.
- **Terre distrutte di massa e turni extra** non sono rilevabili in modo affidabile al 100%: l'app li propone tramite una lista di carte note più una ricerca per testo (es. "destroy all lands", "take an extra turn") e il proprietario conferma nel questionario.

Il proprietario dichiara poi una **fascia iniziale** (≥ Fmin). Il mazzo parte in stato **Provvisorio**.

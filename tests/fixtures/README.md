# Fixture delle API esterne

Risposte registrate di Scryfall, Archidekt, Moxfield e Commander Spellbook.
Nessun test chiama i servizi veri: i test Playwright le servono con `page.route`
tramite `tests/fixtures/index.js`.

Ogni file è la risposta (JSON) a una richiesta precisa; il nome indica servizio e richiesta.

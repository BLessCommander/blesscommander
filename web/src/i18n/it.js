// Testi dell'interfaccia (CLAUDE.md: centralizzati, in italiano).
export const it = {
  nav: {
    main: 'Navigazione principale',
    quick: 'Navigazione rapida',
    breadcrumb: 'Percorso',
    groupMain: 'Gioco',
    groupMore: 'Gruppo e account',
    openMenu: 'Apri il menu',
    closeMenu: 'Chiudi il menu',
    menuTitle: 'Menu',
    collapseSidebar: 'Riduci il menu laterale',
    expandSidebar: 'Espandi il menu laterale',
  },
  pages: {
    dashboard: { title: 'Dashboard', nav: 'Dashboard' },
    decks: { title: 'Mazzi', nav: 'Mazzi' },
    importDeck: { title: 'Importa mazzo', nav: 'Importa' },
    lobby: { title: 'Nuovo tavolo', nav: 'Nuovo tavolo' },
    matches: { title: 'Partite', nav: 'Partite' },
    stats: { title: 'Statistiche', nav: 'Statistiche' },
    rules: { title: 'Regolamento', nav: 'Regolamento' },
    group: { title: 'Gruppo', nav: 'Gruppo' },
    profile: { title: 'Profilo', nav: 'Profilo' },
    environment: { title: 'Ambiente', nav: 'Ambiente' },
  },
  theme: {
    toLight: 'Passa al tema chiaro',
    toDark: 'Passa al tema scuro',
    title: 'Aspetto',
    legend: "Tema dell'interfaccia",
    system: 'Come il dispositivo',
    light: 'Chiaro',
    dark: 'Scuro',
  },
  placeholder: {
    soon: 'Questa pagina è in costruzione.',
    detail: 'I contenuti arrivano con le prossime voci del piano di lavoro.',
  },
  dashboard: {
    intro: 'Le fasce Commander del nostro gruppo, aggiornate dalle partite vere.',
    kpiMatches: 'Partite',
    kpiMatchesHint: 'chiuse in totale',
    kpiWinRate: 'Percentuale di vittorie',
    kpiWinRateHint: (wins, games) =>
      `${wins} ${wins === 1 ? 'vittoria' : 'vittorie'} su ${games} ${games === 1 ? 'partita tua' : 'partite tue'}`,
    kpiTmv: 'TMV personale',
    kpiTmvHint: 'media dei tuoi mazzi',
    kpiDecks: 'Mazzi per fascia',
    kpiDecksHint: (perTier) =>
      Object.entries(perTier)
        .map(([tier, n]) => `${tier}: ${n}`)
        .join(' · '),
    noData: 'Nessun dato ancora',
    recentTitle: 'Ultime partite',
    recentEmpty: 'Quando registrerete le prime partite le vedrete qui.',
    recentWon: 'Vince',
    loading: 'Caricamento dei dati…',
    loadFailed: 'Non riesco a leggere i dati.',
    rule: 'Zero interazioni durante la partita',
    ruleText:
      "L'app si usa solo prima (lobby) e dopo (chiusura in 3 tocchi). Mentre si gioca, l'unica cosa da fare è girare un dado fisico per contare i turni.",
  },
  decks: {
    intro: 'Tutti i mazzi del gruppo, dalla fascia più alta.',
    empty: 'Nessun mazzo ancora. Importane uno dalla pagina Importa.',
    owner: 'Di',
    tier: 'Fascia',
    declared: 'Dichiarata',
    games: 'Partite',
    wins: 'Vittorie',
    tmv: 'TMV',
    list: 'Elenco dei mazzi',
  },
  sync: {
    updating: 'In aggiornamento: sto ricalcolando le fasce con le ultime modifiche.',
    pending: (n) =>
      n === 1
        ? '1 modifica è in attesa di connessione e verrà inviata appena torna la rete.'
        : `${n} modifiche sono in attesa di connessione e verranno inviate appena torna la rete.`,
    retry: 'Riprova ora',
    dropped: (n) =>
      n === 1
        ? 'Una modifica salvata offline è stata rifiutata e non è stata inviata.'
        : `${n} modifiche salvate offline sono state rifiutate e non sono state inviate.`,
    dismiss: 'Ho capito',
  },
  actingAs: {
    label: 'Agisci come',
    self: 'Me stesso',
    help: 'Solo in prova: le modifiche vengono firmate dall’utente scelto.',
  },
  rules: { tiersTitle: 'Le cinque fasce', turn: 'Turno' },
  profile: {
    about: "Informazioni sull'app",
    aboutTitle: 'Informazioni',
    aboutEnvironment: 'Ambiente',
    close: 'Chiudi',
  },
  environment: {
    info: "Dove sta girando l'app",
    mode: 'Modalità',
    app: 'App',
    data: 'Dati',
    dataDemo: 'Dati di prova nel browser (nessuna connessione)',
    dataFake: 'finta API locale',
    basePath: 'Percorso di base',
    demoHelp: 'Nessun token richiesto: i dati sono finti e restano nel tuo browser.',
    fakeHelp:
      "L'app è collegata alla finta API GitHub sul tuo computer. Nessun servizio reale viene toccato.",
    connection: 'Connessione',
    checking: 'Controllo in corso…',
    connected: 'Connesso come',
    failed: 'Connessione non riuscita. Controlla che il comando sia ancora in esecuzione.',
    retry: 'Riprova',
    dataReal: 'repository reale',
    realHelp: "L'app legge e scrive i dati veri del gruppo sul repository GitHub.",
    realTitle: 'Repository reale',
    realIntro:
      'Facoltativo: incolla il token personale creato su GitHub per usare i dati veri del gruppo. Il token resta solo su questo dispositivo.',
    tokenLabel: 'Token personale',
    connect: 'Collega',
    connecting: 'Verifica in corso…',
    disconnect: 'Scollega',
    linked: 'Collegato al repository',
    realFailed: {
      auth: 'Token non valido o scaduto, oppure senza accesso al repository dei dati.',
      'not-member': 'Il tuo account non è nell’elenco dei membri del gruppo.',
      'test-mode': 'Questo repository è in modalità prova: non si può usare come repository reale.',
      network: 'Nessuna connessione a GitHub. Riprova tra poco.',
    },
    realLocked: 'Il collegamento al repository reale è bloccato mentre usi la finta API di prova.',
  },
  modal: { close: 'Chiudi la finestra' },
};

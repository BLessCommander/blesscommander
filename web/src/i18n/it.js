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
    access: { title: 'Accesso', nav: 'Accesso' },
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
    account: 'Il tuo account',
    roleAdmin: 'Amministratore',
    rolePlayer: 'Giocatore',
    demoUser:
      'Stai usando la demo: i dati sono finti. Per entrare con il tuo account GitHub accedi.',
    signIn: 'Accedi con GitHub',
    signOut: 'Esci',
    signedOut: 'Esci da questo dispositivo: il token viene cancellato da qui.',
  },
  access: {
    intro:
      'Per usare i dati veri del gruppo serve un token personale di GitHub. È una password speciale che crei tu, vale solo per il repository dei dati e scade da sola. Resta salvato solo su questo dispositivo.',
    guideTitle: 'Come creare il token',
    guideSteps: (org, repo) => [
      'Accedi a GitHub con il tuo account e apri la pagina per creare un token (pulsante qui sotto).',
      'In "Token name" scrivi un nome a piacere, per esempio "BLessCommander".',
      'In "Expiration" scegli una scadenza (per esempio 90 giorni): alla scadenza ne crei uno nuovo.',
      `In "Resource owner" scegli l’organizzazione ${org}.`,
      `In "Repository access" scegli "Only select repositories" e seleziona solo ${repo}.`,
      'In "Permissions" apri "Repository permissions", cerca "Contents" e imposta "Read and write".',
      'Premi "Generate token", copia il token e incollalo qui sotto.',
    ],
    openGithub: 'Crea il token su GitHub',
    notOrgMember:
      'Se non vedi l’organizzazione, controlla di aver accettato l’invito che ti è arrivato via email.',
    tokenLabel: 'Token personale',
    submit: 'Entra',
    checking: 'Verifica in corso…',
    failed: {
      auth: {
        title: 'Token non valido o scaduto',
        action:
          'Controlla di aver copiato tutto il token. Se è scaduto, creane uno nuovo con i passi qui sopra.',
      },
      'no-access': {
        title: 'Il token non vede i dati del gruppo',
        action:
          'Controlla "Resource owner", "Repository access" e il permesso "Contents" (lettura e scrittura). Se è tutto giusto, il repository dei dati potrebbe non essere ancora stato preparato: chiedi a chi gestisce il gruppo.',
      },
      'not-member': {
        title: 'Il tuo account non è nell’elenco dei membri',
        action: 'Chiedi a un amministratore del gruppo di aggiungerti, poi riprova.',
      },
      'test-mode': {
        title: 'Questo repository è in modalità prova',
        action: 'Non si può usare come repository reale.',
      },
      network: {
        title: 'Nessuna connessione a GitHub',
        action: 'Controlla la rete e riprova tra poco.',
      },
    },
    linked: 'Sei collegato al repository',
    signOut: 'Esci',
    fakeLocked: 'Con la finta API di prova l’accesso è automatico: non serve nessun token.',
    expired: 'Il tuo accesso non è più valido. Accedi di nuovo con un token nuovo.',
    expiredAction: 'Accedi di nuovo',
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
    realIntro: 'Facoltativo: accedi con il tuo token personale per usare i dati veri del gruppo.',
    goAccess: 'Vai alla pagina Accesso',
    disconnect: 'Esci',
    linked: 'Collegato al repository',
    realLocked: 'Il collegamento al repository reale è bloccato mentre usi la finta API di prova.',
  },
  modal: { close: 'Chiudi la finestra' },
};

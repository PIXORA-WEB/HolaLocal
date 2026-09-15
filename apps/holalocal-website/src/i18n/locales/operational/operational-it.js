import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Messaggi', 'Le tue conversazioni private appariranno qui quando inizierai a scrivere.', 'Conversazioni private', 'Parla direttamente con le attività locali dal tuo account HolaLocal.', 'Conversazioni',
      'Caricamento conversazioni…', 'Apertura conversazione…', 'Attività', 'Attività locale', 'Ancora nessun messaggio', 'Conversazione non letta con {{name}}', 'Conversazioni con messaggi non letti: {{count}}',
      'Non hai ancora conversazioni.', 'Torna alla home', 'I tuoi messaggi privati', 'Seleziona una conversazione per leggere e rispondere.', 'Conversazione non disponibile',
      'Torna ai messaggi e scegli un’altra conversazione.', 'Torna alle conversazioni', 'Profilo attivo', 'Rimuovi', 'Rimozione…', 'Rimuovere la conversazione?',
      'La conversazione verrà rimossa dalla tua casella. L’altra persona potrà ancora vederla e nessun messaggio sarà eliminato definitivamente.', 'La conversazione è stata rimossa dalla tua casella.',
      'Stai scrivendo in {{language}}. La traduzione automatica non è ancora attiva, quindi viene mostrato il testo originale.', 'Traduzione…', 'Traduzione completata', 'Traduzione non riuscita', 'Vedi originale', 'Vedi traduzione',
      'Inizia conversazione', 'Messaggio', 'Scrivi un messaggio…', 'Invio…', 'Invia', 'La tua lingua preferita', 'Lingua dell’attività',
      'Impossibile caricare le conversazioni.', 'Impossibile caricare i messaggi.', 'Impossibile aprire la conversazione.', 'Impossibile inviare il messaggio.', 'Impossibile rimuovere la conversazione.',
    ],
    reports: ['Fiducia e sicurezza', 'Segnala {{name}}', 'Chiudi il modulo di segnalazione', 'Segnalazione inviata', 'Grazie. La segnalazione è privata e sarà esaminata dal team HolaLocal.', 'Usa questo modulo per questioni di moderazione, fiducia o sicurezza. Le segnalazioni non appaiono mai come recensioni pubbliche.', 'Qual è il problema?', 'Profilo ingannevole', 'Servizio non qualificato', 'Comportamento pericoloso', 'Condotta scorretta', 'Spam o attività falsa', 'Altro', 'Dettagli', 'Fornisci informazioni che ci aiutino a esaminare il problema.', 'Per assistenza sulla piattaforma, feedback o un reclamo formale, scrivi a', 'Invio…', 'Invia segnalazione privata'],
    onboarding: ['Configura la tua esperienza', 'Per cosa userai HolaLocal?', 'Puoi usare un solo account per trovare servizi, offrirli o fare entrambe le cose.', 'Scegli come usare HolaLocal', 'Scegli come intendi usare HolaLocal.', 'Trovare servizi', 'Trova professionisti locali affidabili quando hai bisogno di aiuto.', 'Offrire servizi', 'Prepara un profilo attività e offri i tuoi servizi.', 'Entrambe le opzioni', 'Trova aiuto locale e offri servizi con lo stesso account.'],
    logoAlt: 'Logo HolaLocal',
    auth: ['Esiste già un account per questo indirizzo email.', 'L’indirizzo email o la password non sono corretti.', 'Inserisci un indirizzo email valido.', 'Connessione non riuscita. Controlla internet e riprova.', 'Troppi tentativi. Attendi prima di riprovare.', 'Questo account è stato disabilitato.', 'Scegli una password più sicura di almeno otto caratteri.', 'Impossibile caricare il profilo dell’account. Riprova.', 'Impossibile ripristinare la sessione di accesso. Aggiorna la pagina e riprova.', 'Si è verificato un errore. Riprova.', 'Mostra password', 'Nascondi password', 'Recupero account', 'Invieremo le istruzioni per reimpostare la password al tuo indirizzo email.', 'Se esiste un account per questa email, le istruzioni sono state inviate.', 'Invia link di reimpostazione'],
    services: ['Chiudi la richiesta di accesso', 'Messaggi privati', 'Accedi per segnalare questa attività', 'Accedi per inviare un messaggio a questa attività', 'Le segnalazioni sono invii privati alla moderazione. Accedi per continuare; non è stata creata alcuna segnalazione.', 'Per inviare messaggi è necessario un account HolaLocal. Non è stata creata alcuna conversazione.'],
    business: ['Invia per la revisione', 'Il profilo attività è stato inviato per la revisione.', 'Impossibile inviare l’attività per la revisione.'],
  },
{ customerFallback: 'Cliente', messageHistory: 'Cronologia dei messaggi', you: 'Tu', sentBy: 'Inviato da {{name}}' },
{
    profileUnavailable: 'Profilo attualmente non disponibile',
    profileUnavailableDescription: 'Questo profilo attività non è attualmente disponibile. La cronologia dei messaggi esistente resta accessibile.',
    messagingClosed: 'Al momento non è possibile inviare nuovi messaggi in questa conversazione.',
  },
{
    sessionExpired: 'La sessione è scaduta. Accedi di nuovo per continuare.',
    permissionDenied: 'Non puoi accedere a questa conversazione né modificarla.',
    networkUnavailable: 'I messaggi non sono disponibili al momento. Controlla la connessione e riprova.',
    notFound: 'Questa conversazione non è più disponibile.',
    invalid: 'Questo messaggio non può essere inviato così com’è. Controllalo e riprova.',
    conflict: 'Non è stato possibile completare il messaggio in sicurezza. Aggiorna la conversazione prima di riprovare.',
  },
'Scopri professionisti locali e consulta i loro profili pubblici.',
'La tua segnalazione è stata inviata in privato al team di HolaLocal.'
)

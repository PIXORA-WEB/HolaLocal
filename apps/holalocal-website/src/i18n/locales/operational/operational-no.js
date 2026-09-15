import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Meldinger', 'De private samtalene dine vises her når du begynner å sende meldinger.', 'Private samtaler', 'Snakk direkte med lokale bedrifter fra HolaLocal-kontoen din.', 'Samtaler',
      'Laster inn samtaler…', 'Åpner samtale…', 'Bedrift', 'Lokal bedrift', 'Ingen meldinger ennå', 'Ulest samtale med {{name}}', 'Samtaler med uleste meldinger: {{count}}',
      'Du har ingen samtaler ennå.', 'Tilbake til forsiden', 'Dine private meldinger', 'Velg en samtale for å lese og svare.', 'Samtalen er utilgjengelig',
      'Gå tilbake til meldinger og velg en annen samtale.', 'Tilbake til samtaler', 'Aktiv profil', 'Fjern', 'Fjerner…', 'Fjerne samtalen?',
      'Samtalen fjernes fra innboksen din. Den andre personen kan fortsatt se den, og ingen meldinger slettes permanent.', 'Samtalen er fjernet fra innboksen din.',
      'Du skriver på {{language}}. Automatisk oversettelse er ikke aktivert ennå, så originalteksten vises.', 'Oversetter…', 'Oversettelse fullført', 'Oversettelsen mislyktes', 'Vis original', 'Vis oversettelse',
      'Start samtale', 'Melding', 'Skriv en melding…', 'Sender…', 'Send', 'Ditt foretrukne språk', 'Bedriftens språk',
      'Samtalene kunne ikke lastes inn.', 'Meldingene kunne ikke lastes inn.', 'Samtalen kunne ikke åpnes.', 'Meldingen kunne ikke sendes.', 'Samtalen kunne ikke fjernes.',
    ],
    reports: ['Tillit og sikkerhet', 'Rapporter {{name}}', 'Lukk rapporteringsskjemaet', 'Rapport sendt', 'Takk. Rapporten din er privat og blir gjennomgått av HolaLocal-teamet.', 'Bruk skjemaet for saker om moderering, tillit eller sikkerhet. Rapporter vises aldri som offentlige anmeldelser.', 'Hva er problemet?', 'Villedende profil', 'Ukvalifisert tjeneste', 'Utrygg atferd', 'Upassende opptreden', 'Søppelinnhold eller falsk bedrift', 'Annet', 'Detaljer', 'Del informasjon som hjelper oss med å gjennomgå saken.', 'Send e-post for hjelp med plattformen, tilbakemeldinger eller en formell klage til', 'Sender…', 'Send privat rapport'],
    onboarding: ['Tilpass opplevelsen din', 'Hva skal du bruke HolaLocal til?', 'Du kan bruke én konto til å finne tjenester, tilby tjenester eller begge deler.', 'Velg hvordan du skal bruke HolaLocal', 'Velg hvordan du planlegger å bruke HolaLocal.', 'Finne tjenester', 'Finn pålitelige lokale fagfolk når du trenger hjelp.', 'Tilby tjenester', 'Opprett en bedriftsprofil og tilby tjenestene dine.', 'Begge deler', 'Finn lokal hjelp og tilby tjenester med samme konto.'],
    logoAlt: 'HolaLocal-logo',
    auth: ['Det finnes allerede en konto med denne e-postadressen.', 'E-postadressen eller passordet er feil.', 'Skriv inn en gyldig e-postadresse.', 'Kunne ikke koble til. Sjekk internettforbindelsen og prøv igjen.', 'For mange forsøk. Vent før du prøver igjen.', 'Denne kontoen er deaktivert.', 'Velg et sterkere passord med minst åtte tegn.', 'Kontoprofilen kunne ikke lastes inn. Prøv igjen.', 'Påloggingsøkten kunne ikke gjenopprettes. Oppdater siden og prøv igjen.', 'Det oppstod en feil. Prøv igjen.', 'Vis passord', 'Skjul passord', 'Gjenopprett konto', 'Vi sender instruksjoner for tilbakestilling av passordet til e-postadressen din.', 'Hvis det finnes en konto for denne e-postadressen, er instruksjonene sendt.', 'Send tilbakestillingslenke'],
    services: ['Lukk påloggingsforespørselen', 'Private meldinger', 'Logg inn for å rapportere denne bedriften', 'Logg inn for å sende en melding til denne bedriften', 'Rapporter sendes privat til moderering. Logg inn for å fortsette; ingen rapport er opprettet.', 'Du trenger en HolaLocal-konto for å sende meldinger. Ingen samtale er opprettet.'],
    business: ['Send til gjennomgang', 'Bedriftsprofilen er sendt til gjennomgang.', 'Bedriften kunne ikke sendes til gjennomgang.'],
  },
{ customerFallback: 'Kunde', messageHistory: 'Meldingshistorikk', you: 'Du', sentBy: 'Sendt av {{name}}' },
{
    profileUnavailable: 'Profilen er ikke tilgjengelig akkurat nå',
    profileUnavailableDescription: 'Bedriftsprofilen er ikke tilgjengelig akkurat nå. Den eksisterende meldingshistorikken er fortsatt tilgjengelig.',
    messagingClosed: 'Det kan ikke sendes nye meldinger i denne samtalen akkurat nå.',
  },
{
    sessionExpired: 'Økten din har utløpt. Logg inn på nytt for å fortsette.',
    permissionDenied: 'Du kan ikke åpne eller endre denne samtalen.',
    networkUnavailable: 'Meldinger er midlertidig utilgjengelige. Kontroller tilkoblingen og prøv igjen.',
    notFound: 'Denne samtalen er ikke lenger tilgjengelig.',
    invalid: 'Meldingen kan ikke sendes slik den er skrevet. Kontroller den og prøv igjen.',
    conflict: 'Meldingen kunne ikke behandles på en trygg måte. Oppdater samtalen før du prøver igjen.',
  },
'Finn lokale fagfolk og se de offentlige bedriftsprofilene deres.',
'Rapporten din er sendt privat til HolaLocal-teamet.'
)

import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Beskeder', 'Dine private samtaler vises her, når du begynder at sende beskeder.', 'Private samtaler', 'Tal direkte med lokale virksomheder fra din HolaLocal-konto.', 'Samtaler',
      'Indlæser samtaler…', 'Åbner samtale…', 'Virksomhed', 'Lokal virksomhed', 'Ingen beskeder endnu', 'Ulæst samtale med {{name}}', 'Samtaler med ulæste beskeder: {{count}}',
      'Du har ingen samtaler endnu.', 'Tilbage til forsiden', 'Dine private beskeder', 'Vælg en samtale for at læse og svare.', 'Samtalen er ikke tilgængelig',
      'Gå tilbage til beskeder, og vælg en anden samtale.', 'Tilbage til samtaler', 'Aktiv profil', 'Fjern', 'Fjerner…', 'Fjern samtalen?',
      'Samtalen fjernes fra din indbakke. Den anden person kan stadig se den, og ingen beskeder slettes permanent.', 'Samtalen er fjernet fra din indbakke.',
      'De oprindelige beskeder er altid tilgængelige.', 'Oversætter…', 'Maskinoversættelse', 'Oversættelsen mislykkedes', 'Vis original', 'Vis oversættelse',
      'Start samtale', 'Besked', 'Skriv en besked…', 'Sender…', 'Send', 'Dit foretrukne sprog', 'Virksomhedens sprog',
      'Samtalerne kunne ikke indlæses.', 'Beskederne kunne ikke indlæses.', 'Samtalen kunne ikke åbnes.', 'Beskeden kunne ikke sendes.', 'Samtalen kunne ikke fjernes.',
    ],
    reports: ['Tillid og sikkerhed', 'Anmeld {{name}}', 'Luk anmeldelsesformularen', 'Anmeldelse sendt', 'Tak. Din anmeldelse er privat og gennemgås af HolaLocal-teamet.', 'Brug formularen til spørgsmål om moderation, tillid eller sikkerhed. Anmeldelser vises aldrig som offentlige bedømmelser.', 'Hvad er problemet?', 'Vildledende profil', 'Ukvalificeret tjeneste', 'Farlig adfærd', 'Upassende opførsel', 'Spam eller falsk virksomhed', 'Andet', 'Detaljer', 'Del oplysninger, der hjælper os med at gennemgå sagen.', 'Send en e-mail for hjælp til platformen, feedback eller en formel klage til', 'Sender…', 'Send privat anmeldelse'],
    onboarding: ['Indstil din oplevelse', 'Hvad vil du bruge HolaLocal til?', 'Du kan bruge én konto til at finde tjenester, tilbyde tjenester eller begge dele.', 'Vælg, hvordan du vil bruge HolaLocal', 'Vælg, hvordan du planlægger at bruge HolaLocal.', 'Find tjenester', 'Find pålidelige lokale fagfolk, når du har brug for hjælp.', 'Tilbyd tjenester', 'Opret en virksomhedsprofil, og tilbyd dine tjenester.', 'Begge dele', 'Find lokal hjælp, og tilbyd tjenester med samme konto.'],
    logoAlt: 'HolaLocal-logo',
    auth: ['Der findes allerede en konto med denne e-mailadresse.', 'E-mailadressen eller adgangskoden er forkert.', 'Indtast en gyldig e-mailadresse.', 'Forbindelsen mislykkedes. Kontrollér internettet, og prøv igen.', 'For mange forsøg. Vent, før du prøver igen.', 'Denne konto er blevet deaktiveret.', 'Vælg en stærkere adgangskode med mindst otte tegn.', 'Kontoprofilen kunne ikke indlæses. Prøv igen.', 'Login-sessionen kunne ikke gendannes. Opdater siden, og prøv igen.', 'Der opstod en fejl. Prøv igen.', 'Vis adgangskode', 'Skjul adgangskode', 'Gendan konto', 'Vi sender vejledning til nulstilling af adgangskoden til din e-mailadresse.', 'Hvis der findes en konto til denne e-mail, er vejledningen sendt.', 'Send nulstillingslink'],
    services: ['Luk loginanmodningen', 'Private beskeder', 'Log ind for at anmelde denne virksomhed', 'Log ind for at sende en besked til denne virksomhed', 'Anmeldelser sendes privat til moderation. Log ind for at fortsætte; der er ikke oprettet en anmeldelse.', 'Der kræves en HolaLocal-konto for at sende beskeder. Der er ikke oprettet en samtale.'],
    business: ['Send til gennemgang', 'Virksomhedsprofilen er sendt til gennemgang.', 'Virksomheden kunne ikke sendes til gennemgang.'],
  },
{ customerFallback: 'Kunde', messageHistory: 'Beskedhistorik', you: 'Du', sentBy: 'Sendt af {{name}}' },
{
    profileUnavailable: 'Profilen er ikke tilgængelig i øjeblikket',
    profileUnavailableDescription: 'Virksomhedsprofilen er ikke tilgængelig i øjeblikket. Din eksisterende beskedhistorik er stadig tilgængelig.',
    messagingClosed: 'Der kan ikke sendes nye beskeder i denne samtale i øjeblikket.',
  },
{
    sessionExpired: 'Din session er udløbet. Log ind igen for at fortsætte.',
    permissionDenied: 'Du kan ikke åbne eller ændre denne samtale.',
    networkUnavailable: 'Beskeder er midlertidigt utilgængelige. Kontrollér forbindelsen, og prøv igen.',
    notFound: 'Denne samtale er ikke længere tilgængelig.',
    invalid: 'Beskeden kan ikke sendes i sin nuværende form. Kontrollér den, og prøv igen.',
    conflict: 'Beskeden kunne ikke behandles sikkert. Opdater samtalen, før du prøver igen.',
  },
'Find lokale fagfolk, og se deres offentlige virksomhedsprofiler.',
'Din anmeldelse er sendt privat til HolaLocal-teamet.'
)

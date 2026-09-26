import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Meddelanden', 'Dina privata konversationer visas här när du börjar skicka meddelanden.', 'Privata konversationer', 'Prata direkt med lokala företag från ditt HolaLocal-konto.', 'Konversationer',
      'Läser in konversationer…', 'Öppnar konversation…', 'Företag', 'Lokalt företag', 'Inga meddelanden ännu', 'Oläst konversation med {{name}}', 'Konversationer med olästa meddelanden: {{count}}',
      'Du har inga konversationer ännu.', 'Tillbaka till startsidan', 'Dina privata meddelanden', 'Välj en konversation för att läsa och svara.', 'Konversationen är inte tillgänglig',
      'Gå tillbaka till meddelanden och välj en annan konversation.', 'Tillbaka till konversationer', 'Aktiv profil', 'Ta bort', 'Tar bort…', 'Ta bort konversationen?',
      'Konversationen tas bort från din inkorg. Den andra personen kan fortfarande se den och inga meddelanden raderas permanent.', 'Konversationen har tagits bort från din inkorg.',
      'Originalmeddelandena är alltid tillgängliga.', 'Översätter…', 'Maskinöversättning', 'Översättningen misslyckades', 'Visa original', 'Visa översättning',
      'Starta konversation', 'Meddelande', 'Skriv ett meddelande…', 'Skickar…', 'Skicka', 'Ditt föredragna språk', 'Företagets språk',
      'Det gick inte att läsa in konversationerna.', 'Det gick inte att läsa in meddelandena.', 'Det gick inte att öppna konversationen.', 'Det gick inte att skicka meddelandet.', 'Det gick inte att ta bort konversationen.',
    ],
    reports: ['Förtroende och säkerhet', 'Anmäl {{name}}', 'Stäng anmälningsformuläret', 'Anmälan skickad', 'Tack. Din anmälan är privat och granskas av HolaLocal-teamet.', 'Använd formuläret för frågor om moderering, förtroende eller säkerhet. Anmälningar visas aldrig som offentliga recensioner.', 'Vad är problemet?', 'Vilseledande profil', 'Okvalificerad tjänst', 'Farligt beteende', 'Olämpligt uppförande', 'Skräppost eller falskt företag', 'Annat', 'Detaljer', 'Dela information som hjälper oss att granska ärendet.', 'För hjälp med plattformen, återkoppling eller ett formellt klagomål, mejla', 'Skickar…', 'Skicka privat anmälan'],
    onboarding: ['Anpassa din upplevelse', 'Vad ska du använda HolaLocal till?', 'Du kan använda ett konto för att hitta tjänster, erbjuda tjänster eller göra båda.', 'Välj hur du ska använda HolaLocal', 'Välj hur du planerar att använda HolaLocal.', 'Hitta tjänster', 'Hitta betrodda lokala yrkespersoner när du behöver hjälp.', 'Erbjuda tjänster', 'Skapa en företagsprofil och erbjud dina tjänster.', 'Båda', 'Hitta lokal hjälp och erbjud tjänster med samma konto.'],
    logoAlt: 'HolaLocal-logotyp',
    auth: ['Det finns redan ett konto med den här e-postadressen.', 'E-postadressen eller lösenordet är felaktigt.', 'Ange en giltig e-postadress.', 'Det gick inte att ansluta. Kontrollera internetanslutningen och försök igen.', 'För många försök. Vänta innan du försöker igen.', 'Kontot har inaktiverats.', 'Välj ett starkare lösenord med minst åtta tecken.', 'Det gick inte att läsa in kontoprofilen. Försök igen.', 'Det gick inte att återställa inloggningssessionen. Uppdatera sidan och försök igen.', 'Ett fel uppstod. Försök igen.', 'Visa lösenord', 'Dölj lösenord', 'Återställ konto', 'Vi skickar anvisningar för att återställa lösenordet till din e-postadress.', 'Om det finns ett konto för e-postadressen har anvisningarna skickats.', 'Skicka återställningslänk'],
    services: ['Stäng inloggningsbegäran', 'Privata meddelanden', 'Logga in för att anmäla företaget', 'Logga in för att skicka ett meddelande till företaget', 'Anmälningar skickas privat till moderatorerna. Logga in för att fortsätta; ingen anmälan har skapats.', 'Ett HolaLocal-konto krävs för meddelanden. Ingen konversation har skapats.'],
    business: ['Skicka för granskning', 'Företagsprofilen har skickats för granskning.', 'Det gick inte att skicka företaget för granskning.'],
  },
{ customerFallback: 'Kund', messageHistory: 'Meddelandehistorik', you: 'Du', sentBy: 'Skickat av {{name}}' },
{
    profileUnavailable: 'Profilen är inte tillgänglig just nu',
    profileUnavailableDescription: 'Företagsprofilen är inte tillgänglig just nu. Din befintliga meddelandehistorik är fortfarande tillgänglig.',
    messagingClosed: 'Det går inte att skicka nya meddelanden i den här konversationen just nu.',
  },
{
    sessionExpired: 'Din session har gått ut. Logga in igen för att fortsätta.',
    permissionDenied: 'Du kan inte öppna eller ändra den här konversationen.',
    networkUnavailable: 'Meddelanden är tillfälligt otillgängliga. Kontrollera anslutningen och försök igen.',
    notFound: 'Den här konversationen är inte längre tillgänglig.',
    invalid: 'Meddelandet kan inte skickas i nuvarande form. Kontrollera det och försök igen.',
    conflict: 'Meddelandet kunde inte hanteras på ett säkert sätt. Uppdatera konversationen innan du försöker igen.',
  },
'Hitta lokala yrkespersoner och se deras offentliga företagsprofiler.',
'Din anmälan har skickats privat till HolaLocal-teamet.'
)

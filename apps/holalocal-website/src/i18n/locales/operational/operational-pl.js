import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Wiadomości', 'Twoje prywatne rozmowy pojawią się tutaj, gdy zaczniesz pisać.', 'Prywatne rozmowy', 'Rozmawiaj bezpośrednio z lokalnymi firmami przez konto HolaLocal.', 'Rozmowy',
      'Ładowanie rozmów…', 'Otwieranie rozmowy…', 'Firma', 'Lokalna firma', 'Brak wiadomości',
      'Nieprzeczytana rozmowa z {{name}}', 'Rozmowy z nieprzeczytanymi wiadomościami: {{count}}', 'Nie masz jeszcze żadnych rozmów.', 'Wróć na stronę główną',
      'Twoje prywatne wiadomości', 'Wybierz rozmowę, aby ją przeczytać i odpowiedzieć.', 'Rozmowa niedostępna', 'Wróć do wiadomości i wybierz inną rozmowę.', 'Wróć do rozmów',
      'Aktywny profil', 'Usuń', 'Usuwanie…', 'Usunąć rozmowę?', 'Rozmowa zniknie z Twojej skrzynki. Druga osoba nadal będzie ją widzieć, a wiadomości nie zostaną trwale usunięte.',
      'Rozmowa została usunięta ze skrzynki.', 'Oryginalne wiadomości są zawsze dostępne.',
      'Tłumaczenie…', 'Tłumaczenie maszynowe', 'Tłumaczenie nie powiodło się', 'Pokaż oryginał', 'Pokaż tłumaczenie', 'Rozpocznij rozmowę',
      'Wiadomość', 'Napisz wiadomość…', 'Wysyłanie…', 'Wyślij', 'Twój preferowany język', 'Język firmy',
      'Nie udało się załadować rozmów.', 'Nie udało się załadować wiadomości.', 'Nie udało się otworzyć rozmowy.', 'Nie udało się wysłać wiadomości.', 'Nie udało się usunąć rozmowy.',
    ],
    reports: [
      'Zaufanie i bezpieczeństwo', 'Zgłoś {{name}}', 'Zamknij formularz zgłoszenia', 'Zgłoszenie wysłane', 'Dziękujemy. Zgłoszenie jest prywatne i zostanie sprawdzone przez zespół HolaLocal.',
      'Użyj tego formularza w sprawach moderacji, zaufania lub bezpieczeństwa. Zgłoszenia nigdy nie są publikowane jako opinie.', 'Na czym polega problem?',
      'Profil wprowadza w błąd', 'Usługa bez kwalifikacji', 'Niebezpieczne zachowanie', 'Niewłaściwe postępowanie', 'Spam lub fałszywa firma', 'Inny powód', 'Szczegóły',
      'Podaj informacje, które pomogą nam sprawdzić sprawę.', 'Aby uzyskać pomoc z platformą, przekazać opinię lub formalną skargę, napisz na adres', 'Wysyłanie…', 'Wyślij prywatne zgłoszenie',
    ],
    onboarding: [
      'Skonfiguruj swoje konto', 'Do czego użyjesz HolaLocal?', 'Jedno konto pozwala szukać usług, oferować je lub robić obie rzeczy.', 'Wybierz sposób korzystania z HolaLocal',
      'Wybierz, jak chcesz korzystać z HolaLocal.', 'Szukanie usług', 'Znajdź zaufanych lokalnych specjalistów, gdy potrzebujesz pomocy.', 'Oferowanie usług',
      'Przygotuj profil firmy i oferuj swoje usługi.', 'Obie możliwości', 'Znajduj lokalną pomoc i oferuj usługi z jednego konta.',
    ],
    logoAlt: 'Logo HolaLocal',
    auth: [
      'Konto z tym adresem e-mail już istnieje.', 'Adres e-mail lub hasło są nieprawidłowe.', 'Wprowadź prawidłowy adres e-mail.', 'Nie udało się połączyć. Sprawdź internet i spróbuj ponownie.',
      'Zbyt wiele prób. Odczekaj przed ponowną próbą.', 'To konto zostało wyłączone.', 'Wybierz silniejsze hasło zawierające co najmniej osiem znaków.',
      'Nie udało się załadować profilu konta. Spróbuj ponownie.', 'Nie udało się przywrócić sesji logowania. Odśwież stronę i spróbuj ponownie.', 'Wystąpił błąd. Spróbuj ponownie.',
      'Pokaż hasło', 'Ukryj hasło', 'Odzyskiwanie konta', 'Wyślemy instrukcje resetowania hasła na Twój adres e-mail.',
      'Jeśli konto z tym adresem istnieje, instrukcje zostały wysłane.', 'Wyślij link resetujący',
    ],
    services: ['Zamknij prośbę o logowanie', 'Prywatne wiadomości', 'Zaloguj się, aby zgłosić tę firmę', 'Zaloguj się, aby wysłać wiadomość do tej firmy', 'Zgłoszenia są prywatnie przekazywane moderacji. Zaloguj się, aby kontynuować; zgłoszenie nie zostało utworzone.', 'Do wysyłania wiadomości potrzebne jest konto HolaLocal. Rozmowa nie została utworzona.'],
    business: ['Wyślij do sprawdzenia', 'Profil firmy został wysłany do sprawdzenia.', 'Nie udało się wysłać firmy do sprawdzenia.'],
  },
{ customerFallback: 'Klient', messageHistory: 'Historia wiadomości', you: 'Ty', sentBy: 'Wysłano przez {{name}}' },
{
    profileUnavailable: 'Profil jest obecnie niedostępny',
    profileUnavailableDescription: 'Ten profil firmy jest obecnie niedostępny. Dotychczasowa historia wiadomości pozostaje dostępna.',
    messagingClosed: 'Obecnie nie można wysyłać nowych wiadomości w tej rozmowie.',
  },
{
    sessionExpired: 'Twoja sesja wygasła. Zaloguj się ponownie, aby kontynuować.',
    permissionDenied: 'Nie możesz uzyskać dostępu do tej rozmowy ani jej zmieniać.',
    networkUnavailable: 'Wiadomości są tymczasowo niedostępne. Sprawdź połączenie i spróbuj ponownie.',
    notFound: 'Ta rozmowa nie jest już dostępna.',
    invalid: 'Nie można wysłać tej wiadomości w obecnej formie. Sprawdź ją i spróbuj ponownie.',
    conflict: 'Nie udało się bezpiecznie ukończyć wysyłania wiadomości. Odśwież rozmowę przed ponowną próbą.',
  },
'Znajdź lokalnych specjalistów i przejrzyj ich publiczne profile firmowe.',
'Twoje zgłoszenie zostało prywatnie wysłane do zespołu HolaLocal.'
)

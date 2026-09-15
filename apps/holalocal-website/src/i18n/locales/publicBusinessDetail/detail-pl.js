import { translation } from './createPublicBusinessDetail.js'

const detail = translation([
    'Wróć do wyników', 'Nie podano kategorii', 'Nie podano obszaru usług', 'Profil publiczny',
    'Weryfikacja już wkrótce', 'Plan {{plan}}', '{{count}} opinia', '{{count}} opinii',
    'Brak opinii', 'Sekcje szczegółów firmy', 'Przegląd', 'Usługi', 'Zdjęcia', 'Opinie',
    'O firmie', 'Otwieranie rozmowy…', 'Napisz do firmy',
    'Zgłoś firmę', 'O tej firmie', 'Ta firma nie dodała jeszcze publicznego opisu.',
    'Obszar usług', 'Języki', 'Nie podano', 'Oferowane usługi',
    'Nie dodano jeszcze szczegółowych usług.', 'Galeria realizacji', 'Przykład realizacji {{index}} firmy {{name}}',
    'Nie dodano jeszcze zdjęć realizacji.', 'Opinie klientów',
    'Pojedyncze opinie nie są dostępne w tej pierwszej wersji.',
    'Ta firma nie otrzymała jeszcze żadnych opinii.', 'Dane kontaktowe', 'Telefon', 'E-mail',
    'Strona internetowa', 'Otwórz WhatsApp', 'Oddzwonienie',
    'Prośby o oddzwonienie są dostępne przez wiadomości HolaLocal.',
    'Nie dodano publicznych danych kontaktowych.', 'Nie udało się otworzyć tej rozmowy. Spróbuj ponownie.',
    'Nie udało się wysłać zgłoszenia. Spróbuj ponownie.', 'Firma niedostępna',
    'Nie znaleziono tego profilu firmy lub nie jest już aktywny.',
  ])
detail.profileInformationProvided = 'Informacje w profilu są podawane przez firmę.'
Object.assign(detail, {
  reviewCount_few: '{{count}} opinie',
  reviewCount_many: '{{count}} opinii',
})
export default detail

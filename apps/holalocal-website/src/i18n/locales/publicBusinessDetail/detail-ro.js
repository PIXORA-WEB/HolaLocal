import { translation } from './createPublicBusinessDetail.js'

const detail = translation([
    'Înapoi la rezultate', 'Categorie nespecificată', 'Zonă de servicii nespecificată', 'Profil public',
    'Verificarea va fi disponibilă în curând', 'Plan {{plan}}', '{{count}} recenzie', '{{count}} recenzii',
    'Încă nu există recenzii', 'Secțiunile detaliilor firmei', 'Prezentare generală', 'Servicii', 'Fotografii', 'Recenzii',
    'Despre', 'Se deschide conversația…', 'Trimite mesaj firmei',
    'Raportează firma', 'Despre această firmă', 'Această firmă nu a adăugat încă o descriere publică.',
    'Zonă de servicii', 'Limbi', 'Nespecificat', 'Servicii oferite',
    'Nu au fost adăugate încă servicii detaliate.', 'Galerie de lucrări', 'Exemplul de lucrare {{index}} al firmei {{name}}',
    'Nu au fost adăugate încă fotografii ale lucrărilor.', 'Opiniile clienților',
    'Recenziile individuale nu sunt disponibile în această primă versiune.',
    'Această firmă nu a primit încă recenzii.', 'Informații de contact', 'Telefon', 'E-mail',
    'Site web', 'Deschide WhatsApp', 'Apel înapoi',
    'Solicitările de apel înapoi sunt disponibile prin mesageria HolaLocal.',
    'Nu au fost adăugate date publice de contact.', 'Această conversație nu a putut fi deschisă. Încercați din nou.',
    'Raportul nu a putut fi trimis. Încercați din nou.', 'Firmă indisponibilă',
    'Acest profil de firmă nu a fost găsit sau nu mai este activ.',
  ])
detail.profileInformationProvided = 'Informațiile din profil sunt furnizate de firmă.'
Object.assign(detail, {
  reviewCount_few: '{{count}} recenzii',
})
export default detail

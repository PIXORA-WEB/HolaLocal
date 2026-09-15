import { translation } from './createPublicBusinessDetail.js'

const detail = translation([
    'Späť na výsledky', 'Kategória nie je uvedená', 'Oblasť služieb nie je uvedená', 'Verejný profil',
    'Overenie bude čoskoro k dispozícii', 'Program {{plan}}', '{{count}} recenzia', '{{count}} recenzií',
    'Zatiaľ žiadne recenzie', 'Časti detailu firmy', 'Prehľad', 'Služby', 'Fotografie', 'Recenzie',
    'O firme', 'Otvára sa konverzácia…', 'Napísať firme',
    'Nahlásiť firmu', 'O tejto firme', 'Táto firma zatiaľ nepridala verejný opis.',
    'Oblasť služieb', 'Jazyky', 'Neuvedené', 'Ponúkané služby',
    'Zatiaľ neboli pridané podrobné služby.', 'Galéria prác', 'Ukážka práce {{index}} firmy {{name}}',
    'Zatiaľ neboli pridané fotografie prác.', 'Hodnotenia zákazníkov',
    'Jednotlivé recenzie nie sú v tejto prvej verzii dostupné.',
    'Táto firma zatiaľ nedostala žiadne recenzie.', 'Kontaktné údaje', 'Telefón', 'E-mail',
    'Web', 'Otvoriť WhatsApp', 'Spätné volanie',
    'Žiadosti o spätné volanie sú dostupné prostredníctvom správ HolaLocal.',
    'Neboli pridané verejné kontaktné údaje.', 'Túto konverzáciu sa nepodarilo otvoriť. Skúste to znova.',
    'Hlásenie sa nepodarilo odoslať. Skúste to znova.', 'Firma nie je dostupná',
    'Tento firemný profil sa nenašiel alebo už nie je aktívny.',
  ])
detail.profileInformationProvided = 'Informácie v profile poskytuje firma.'
Object.assign(detail, {
  reviewCount_few: '{{count}} recenzie',
})
export default detail

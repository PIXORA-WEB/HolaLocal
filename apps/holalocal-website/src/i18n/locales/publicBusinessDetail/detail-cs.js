import { translation } from './createPublicBusinessDetail.js'

const detail = translation([
    'Zpět na výsledky', 'Kategorie není uvedena', 'Oblast služeb není uvedena', 'Veřejný profil',
    'Ověření bude brzy k dispozici', 'Tarif {{plan}}', '{{count}} recenze', '{{count}} recenzí',
    'Zatím žádné recenze', 'Části detailu firmy', 'Přehled', 'Služby', 'Fotografie', 'Recenze',
    'O firmě', 'Otevírání konverzace…', 'Napsat firmě',
    'Nahlásit firmu', 'O této firmě', 'Tato firma zatím nepřidala veřejný popis.',
    'Oblast služeb', 'Jazyky', 'Neuvedeno', 'Nabízené služby',
    'Zatím nebyly přidány podrobné služby.', 'Galerie prací', 'Ukázka práce {{index}} firmy {{name}}',
    'Zatím nebyly přidány fotografie prací.', 'Hodnocení zákazníků',
    'Jednotlivé recenze nejsou v této první verzi dostupné.',
    'Tato firma zatím neobdržela žádné recenze.', 'Kontaktní údaje', 'Telefon', 'E-mail',
    'Web', 'Otevřít WhatsApp', 'Zpětné volání',
    'Žádosti o zpětné volání jsou dostupné prostřednictvím zpráv HolaLocal.',
    'Nebyly přidány veřejné kontaktní údaje.', 'Tuto konverzaci se nepodařilo otevřít. Zkuste to znovu.',
    'Hlášení se nepodařilo odeslat. Zkuste to znovu.', 'Firma není dostupná',
    'Tento firemní profil nebyl nalezen nebo již není aktivní.',
  ])
detail.profileInformationProvided = 'Informace v profilu poskytuje firma.'
Object.assign(detail, {
  reviewCount_few: '{{count}} recenze',
})
export default detail

import { footerNavigationEnglishTranslations } from '../footerNavigationEnglishTranslations.js'

const footerNavigation = ({ explore, exploreLabel, helpLegal, helpLegalLabel }) => Object.freeze({
  footer: Object.freeze({ explore, exploreLabel, helpLegal, helpLegalLabel }),
})

export const footerNavigationTranslations = Object.freeze({
  en: footerNavigationEnglishTranslations,
  es: footerNavigation({ explore: 'Explorar', exploreLabel: 'Explorar HolaLocal', helpLegal: 'Ayuda y legal', helpLegalLabel: 'Ayuda e información legal' }),
  fr: footerNavigation({ explore: 'Explorer', exploreLabel: 'Explorer HolaLocal', helpLegal: 'Aide et mentions légales', helpLegalLabel: 'Aide et informations juridiques' }),
  de: footerNavigation({ explore: 'Entdecken', exploreLabel: 'HolaLocal entdecken', helpLegal: 'Hilfe & Rechtliches', helpLegalLabel: 'Hilfe und rechtliche Informationen' }),
  nl: footerNavigation({ explore: 'Ontdekken', exploreLabel: 'HolaLocal ontdekken', helpLegal: 'Hulp & juridisch', helpLegalLabel: 'Hulp en juridische informatie' }),
  pt: footerNavigation({ explore: 'Explorar', exploreLabel: 'Explorar a HolaLocal', helpLegal: 'Ajuda e informações legais', helpLegalLabel: 'Ajuda e informações jurídicas' }),
  pl: footerNavigation({ explore: 'Odkrywaj', exploreLabel: 'Odkrywaj HolaLocal', helpLegal: 'Pomoc i kwestie prawne', helpLegalLabel: 'Pomoc i informacje prawne' }),
  ro: footerNavigation({ explore: 'Explorează', exploreLabel: 'Explorează HolaLocal', helpLegal: 'Ajutor și aspecte juridice', helpLegalLabel: 'Ajutor și informații juridice' }),
  cs: footerNavigation({ explore: 'Prozkoumat', exploreLabel: 'Prozkoumat HolaLocal', helpLegal: 'Nápověda a právní informace', helpLegalLabel: 'Nápověda a právní informace' }),
  sk: footerNavigation({ explore: 'Preskúmať', exploreLabel: 'Preskúmať HolaLocal', helpLegal: 'Pomoc a právne informácie', helpLegalLabel: 'Pomoc a právne informácie' }),
  hu: footerNavigation({ explore: 'Felfedezés', exploreLabel: 'A HolaLocal felfedezése', helpLegal: 'Súgó és jogi információk', helpLegalLabel: 'Súgó és jogi információk' }),
  uk: footerNavigation({ explore: 'Огляд', exploreLabel: 'Огляд HolaLocal', helpLegal: 'Допомога та правова інформація', helpLegalLabel: 'Допомога та правова інформація' }),
  it: footerNavigation({ explore: 'Esplora', exploreLabel: 'Esplora HolaLocal', helpLegal: 'Assistenza e note legali', helpLegalLabel: 'Assistenza e informazioni legali' }),
  sv: footerNavigation({ explore: 'Utforska', exploreLabel: 'Utforska HolaLocal', helpLegal: 'Hjälp och juridik', helpLegalLabel: 'Hjälp och juridisk information' }),
  da: footerNavigation({ explore: 'Udforsk', exploreLabel: 'Udforsk HolaLocal', helpLegal: 'Hjælp og jura', helpLegalLabel: 'Hjælp og juridisk information' }),
  fi: footerNavigation({ explore: 'Tutustu', exploreLabel: 'Tutustu HolaLocaliin', helpLegal: 'Ohjeet ja lakitiedot', helpLegalLabel: 'Ohjeet ja oikeudelliset tiedot' }),
  no: footerNavigation({ explore: 'Utforsk', exploreLabel: 'Utforsk HolaLocal', helpLegal: 'Hjelp og juridisk', helpLegalLabel: 'Hjelp og juridisk informasjon' }),
})

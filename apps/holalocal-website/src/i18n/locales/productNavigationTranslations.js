import { productNavigationEnglishTranslations } from '../productNavigationEnglishTranslations.js'

const productNavigation = ({ services, events, community }) => Object.freeze({
  nav: Object.freeze({ services, events, community }),
})

export const productNavigationTranslations = Object.freeze({
  en: productNavigationEnglishTranslations,
  es: productNavigation({ services: 'Servicios', events: 'Eventos', community: 'Comunidad' }),
  fr: productNavigation({ services: 'Services', events: 'Événements', community: 'Communauté' }),
  de: productNavigation({ services: 'Dienstleistungen', events: 'Veranstaltungen', community: 'Gemeinschaft' }),
  nl: productNavigation({ services: 'Diensten', events: 'Evenementen', community: 'Community' }),
  pt: productNavigation({ services: 'Serviços', events: 'Eventos', community: 'Comunidade' }),
  pl: productNavigation({ services: 'Usługi', events: 'Wydarzenia', community: 'Społeczność' }),
  ro: productNavigation({ services: 'Servicii', events: 'Evenimente', community: 'Comunitate' }),
  cs: productNavigation({ services: 'Služby', events: 'Události', community: 'Komunita' }),
  sk: productNavigation({ services: 'Služby', events: 'Podujatia', community: 'Komunita' }),
  hu: productNavigation({ services: 'Szolgáltatások', events: 'Események', community: 'Közösség' }),
  uk: productNavigation({ services: 'Послуги', events: 'Події', community: 'Спільнота' }),
  it: productNavigation({ services: 'Servizi', events: 'Eventi', community: 'Comunità' }),
  sv: productNavigation({ services: 'Tjänster', events: 'Evenemang', community: 'Gemenskap' }),
  da: productNavigation({ services: 'Tjenester', events: 'Begivenheder', community: 'Fællesskab' }),
  fi: productNavigation({ services: 'Palvelut', events: 'Tapahtumat', community: 'Yhteisö' }),
  no: productNavigation({ services: 'Tjenester', events: 'Arrangementer', community: 'Fellesskap' }),
})

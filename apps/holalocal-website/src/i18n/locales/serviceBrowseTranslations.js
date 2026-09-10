import { serviceBrowseEnglishTranslations } from '../serviceBrowseEnglishTranslations.js'

const browse = (browseTitle, browseDescription, viewBusiness, additionalLanguages, contactThisBusiness) => ({
  services: { browseTitle, browseDescription, viewBusiness, additionalLanguages },
  publicBusinessDetail: { contactThisBusiness },
})

export const serviceBrowseTranslations = Object.freeze({
  en: serviceBrowseEnglishTranslations,
  es: browse('Buscar por servicio', 'Elige un grupo y después el servicio que necesitas.', "Ver negocio", "Idiomas adicionales: {{number}}", "Contacta con este negocio"),
  fr: browse('Parcourir par service', 'Choisissez un groupe, puis le service dont vous avez besoin.', "Voir le professionnel", "Langues supplémentaires : {{number}}", "Contacter ce professionnel"),
  de: browse('Nach Dienstleistung suchen', 'Wählen Sie eine Gruppe und dann die gewünschte Dienstleistung.', "Unternehmen ansehen", "Weitere Sprachen: {{number}}", "Dieses Unternehmen kontaktieren"),
  nl: browse('Zoeken op dienst', 'Kies een groep en daarna de dienst die je nodig hebt.', "Bedrijf bekijken", "Extra talen: {{number}}", "Neem contact op met dit bedrijf"),
  pt: browse('Procurar por serviço', 'Escolha um grupo e depois o serviço de que precisa.', "Ver negócio", "Idiomas adicionais: {{number}}", "Contactar este negócio"),
  pl: browse('Przeglądaj według usługi', 'Wybierz grupę, a następnie potrzebną usługę.', "Zobacz firmę", "Dodatkowe języki: {{number}}", "Skontaktuj się z tą firmą"),
  ro: browse('Caută după serviciu', 'Alegeți un grup, apoi serviciul de care aveți nevoie.', "Vezi afacerea", "Limbi suplimentare: {{number}}", "Contactează această afacere"),
  cs: browse('Procházet podle služby', 'Vyberte skupinu a poté službu, kterou potřebujete.', "Zobrazit firmu", "Další jazyky: {{number}}", "Kontaktovat tuto firmu"),
  sk: browse('Prehľadávať podľa služby', 'Vyberte skupinu a potom službu, ktorú potrebujete.', "Zobraziť firmu", "Ďalšie jazyky: {{number}}", "Kontaktovať túto firmu"),
  hu: browse('Böngészés szolgáltatás szerint', 'Válasszon egy csoportot, majd a kívánt szolgáltatást.', "Vállalkozás megtekintése", "További nyelvek: {{number}}", "Kapcsolatfelvétel a vállalkozással"),
  uk: browse('Перегляд за послугою', 'Виберіть групу, а потім потрібну послугу.', "Переглянути компанію", "Додаткові мови: {{number}}", "Зв’язатися з цією компанією"),
  it: browse('Sfoglia per servizio', 'Scegli un gruppo e poi il servizio di cui hai bisogno.', "Visualizza attività", "Altre lingue: {{number}}", "Contatta questa attività"),
  sv: browse('Bläddra efter tjänst', 'Välj en grupp och sedan tjänsten du behöver.', "Visa företag", "Ytterligare språk: {{number}}", "Kontakta företaget"),
  da: browse('Gennemse efter tjeneste', 'Vælg en gruppe og derefter den tjeneste, du har brug for.', "Se virksomhed", "Yderligere sprog: {{number}}", "Kontakt denne virksomhed"),
  fi: browse('Selaa palvelun mukaan', 'Valitse ryhmä ja sitten tarvitsemasi palvelu.', "Näytä yritys", "Muita kieliä: {{number}}", "Ota yhteyttä yritykseen"),
  no: browse('Bla gjennom etter tjeneste', 'Velg en gruppe og deretter tjenesten du trenger.', "Se bedrift", "Flere språk: {{number}}", "Kontakt denne bedriften"),
})

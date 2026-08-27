const browse = (browseTitle, browseDescription) => ({
  services: { browseTitle, browseDescription },
})

export const serviceBrowseTranslations = Object.freeze({
  en: browse('Browse by service', 'Choose a group, then select the service you need.'),
  es: browse('Buscar por servicio', 'Elige un grupo y después el servicio que necesitas.'),
  fr: browse('Parcourir par service', 'Choisissez un groupe, puis le service dont vous avez besoin.'),
  de: browse('Nach Dienstleistung suchen', 'Wählen Sie eine Gruppe und dann die gewünschte Dienstleistung.'),
  nl: browse('Zoeken op dienst', 'Kies een groep en daarna de dienst die je nodig hebt.'),
  pt: browse('Procurar por serviço', 'Escolha um grupo e depois o serviço de que precisa.'),
  pl: browse('Przeglądaj według usługi', 'Wybierz grupę, a następnie potrzebną usługę.'),
  ro: browse('Caută după serviciu', 'Alegeți un grup, apoi serviciul de care aveți nevoie.'),
  cs: browse('Procházet podle služby', 'Vyberte skupinu a poté službu, kterou potřebujete.'),
  sk: browse('Prehľadávať podľa služby', 'Vyberte skupinu a potom službu, ktorú potrebujete.'),
  hu: browse('Böngészés szolgáltatás szerint', 'Válasszon egy csoportot, majd a kívánt szolgáltatást.'),
  uk: browse('Перегляд за послугою', 'Виберіть групу, а потім потрібну послугу.'),
  it: browse('Sfoglia per servizio', 'Scegli un gruppo e poi il servizio di cui hai bisogno.'),
  sv: browse('Bläddra efter tjänst', 'Välj en grupp och sedan tjänsten du behöver.'),
  da: browse('Gennemse efter tjeneste', 'Vælg en gruppe og derefter den tjeneste, du har brug for.'),
  fi: browse('Selaa palvelun mukaan', 'Valitse ryhmä ja sitten tarvitsemasi palvelu.'),
  no: browse('Bla gjennom etter tjeneste', 'Velg en gruppe og deretter tjenesten du trenger.'),
})

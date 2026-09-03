import { productLandingEnglishTranslations } from '../productLandingEnglishTranslations.js'

const productLanding = ({ comingSoon, events, community }) => ({
  productLanding: {
    comingSoon,
    events,
    community,
  },
})

export const productLandingTranslations = Object.freeze({
  en: productLandingEnglishTranslations,
  es: productLanding({
    comingSoon: 'Próximamente',
    events: {
      eyebrow: 'Eventos',
      title: 'Descubre qué ocurre cerca de ti.',
      description: 'Una forma sencilla de descubrir eventos, actividades y todo lo que ocurre en tu zona.',
      supportingMessage: 'HolaLocal Eventos se está creando para ayudar a los organizadores locales a compartir eventos y facilitar que las personas cercanas los descubran.',
    },
    community: {
      eyebrow: 'Comunidad',
      title: 'Conecta con tu entorno local.',
      description: 'Un futuro espacio para que las personas descubran, compartan y sigan conectadas con lo que importa cerca de ellas.',
      supportingMessage: 'HolaLocal Comunidad está prevista como un espacio local sencillo basado en conexiones útiles e información local.',
    },
  }),

  fr: productLanding({
    comingSoon: 'Bientôt disponible',
    events: {
      eyebrow: 'Événements',
      title: 'Découvrez ce qui se passe près de chez vous.',
      description: 'Une façon simple de découvrir les événements, les activités et tout ce qui se passe dans votre région.',
      supportingMessage: 'HolaLocal Événements est en cours de création pour aider les organisateurs locaux à partager leurs événements et permettre aux habitants de les découvrir plus facilement.',
    },
    community: {
      eyebrow: 'Communauté',
      title: 'Créez des liens dans votre région.',
      description: 'Un futur espace où les habitants pourront découvrir, partager et rester connectés à ce qui compte près de chez eux.',
      supportingMessage: 'HolaLocal Communauté est conçu comme un espace local simple, axé sur les liens utiles et les informations locales.',
    },
  }),

  de: productLanding({
    comingSoon: 'Demnächst',
    events: {
      eyebrow: 'Veranstaltungen',
      title: 'Entdecken Sie, was vor Ort passiert.',
      description: 'Eine einfache Möglichkeit, lokale Veranstaltungen, Aktivitäten und Angebote in Ihrer Umgebung zu entdecken.',
      supportingMessage: 'HolaLocal Veranstaltungen wird entwickelt, damit lokale Veranstalter ihre Events teilen können und Menschen in der Nähe sie leichter finden.',
    },
    community: {
      eyebrow: 'Gemeinschaft',
      title: 'Vernetzen Sie sich mit Ihrer Umgebung.',
      description: 'Ein zukünftiger Ort, an dem Menschen entdecken, teilen und mit wichtigen Themen aus ihrer Umgebung verbunden bleiben können.',
      supportingMessage: 'HolaLocal Gemeinschaft ist als einfacher lokaler Raum für nützliche Kontakte und Informationen aus der Umgebung geplant.',
    },
  }),

  nl: productLanding({
    comingSoon: 'Binnenkort',
    events: {
      eyebrow: 'Evenementen',
      title: 'Ontdek wat er bij jou in de buurt gebeurt.',
      description: 'Een eenvoudige manier om lokale evenementen, activiteiten en andere gebeurtenissen in jouw omgeving te ontdekken.',
      supportingMessage: 'HolaLocal Evenementen wordt gebouwd om lokale organisatoren te helpen evenementen te delen en ze makkelijker vindbaar te maken voor mensen in de buurt.',
    },
    community: {
      eyebrow: 'Community',
      title: 'Maak verbinding met jouw omgeving.',
      description: 'Een toekomstige plek waar mensen kunnen ontdekken, delen en verbonden blijven met wat er in de buurt toe doet.',
      supportingMessage: 'HolaLocal Community is gepland als een eenvoudige lokale plek voor nuttige contacten en lokale informatie.',
    },
  }),

  pt: productLanding({
    comingSoon: 'Em breve',
    events: {
      eyebrow: 'Eventos',
      title: 'Descubra o que acontece perto de si.',
      description: 'Uma forma simples de descobrir eventos, atividades e tudo o que acontece na sua zona.',
      supportingMessage: 'O HolaLocal Eventos está a ser desenvolvido para ajudar organizadores locais a partilhar eventos e facilitar a sua descoberta por pessoas próximas.',
    },
    community: {
      eyebrow: 'Comunidade',
      title: 'Ligue-se à sua área local.',
      description: 'Um futuro espaço onde as pessoas poderão descobrir, partilhar e manter-se ligadas ao que importa perto de si.',
      supportingMessage: 'O HolaLocal Comunidade está planeado como um espaço local simples, centrado em ligações úteis e informação local.',
    },
  }),

  pl: productLanding({
    comingSoon: 'Wkrótce',
    events: {
      eyebrow: 'Wydarzenia',
      title: 'Odkrywaj, co dzieje się w Twojej okolicy.',
      description: 'Prosty sposób na odkrywanie lokalnych wydarzeń, aktywności i tego, co dzieje się w pobliżu.',
      supportingMessage: 'HolaLocal Wydarzenia powstaje, aby pomóc lokalnym organizatorom udostępniać wydarzenia i ułatwić mieszkańcom ich odkrywanie.',
    },
    community: {
      eyebrow: 'Społeczność',
      title: 'Nawiąż kontakt ze swoją okolicą.',
      description: 'Przyszła przestrzeń, w której mieszkańcy będą mogli odkrywać, udostępniać i pozostawać w kontakcie z tym, co ważne w pobliżu.',
      supportingMessage: 'HolaLocal Społeczność jest planowana jako prosta lokalna przestrzeń oparta na przydatnych kontaktach i lokalnych informacjach.',
    },
  }),

  ro: productLanding({
    comingSoon: 'În curând',
    events: {
      eyebrow: 'Evenimente',
      title: 'Descoperă ce se întâmplă în apropiere.',
      description: 'O modalitate simplă de a descoperi evenimente, activități și lucruri care se întâmplă în zona ta.',
      supportingMessage: 'HolaLocal Evenimente este în curs de dezvoltare pentru a ajuta organizatorii locali să distribuie evenimente și pentru ca oamenii din apropiere să le descopere mai ușor.',
    },
    community: {
      eyebrow: 'Comunitate',
      title: 'Conectează-te cu zona ta.',
      description: 'Un viitor spațiu în care oamenii pot descoperi, distribui și rămâne conectați la ceea ce contează în apropiere.',
      supportingMessage: 'HolaLocal Comunitate este planificat ca un spațiu local simplu, construit în jurul conexiunilor utile și informațiilor locale.',
    },
  }),

  cs: productLanding({
    comingSoon: 'Již brzy',
    events: {
      eyebrow: 'Události',
      title: 'Objevte, co se děje ve vašem okolí.',
      description: 'Jednoduchý způsob, jak objevovat místní události, aktivity a dění ve vašem okolí.',
      supportingMessage: 'HolaLocal Události vznikají, aby místním pořadatelům pomohly sdílet události a lidem v okolí usnadnily jejich objevování.',
    },
    community: {
      eyebrow: 'Komunita',
      title: 'Propojte se se svým okolím.',
      description: 'Budoucí prostor, kde mohou místní lidé objevovat, sdílet a zůstat ve spojení s tím, co je v jejich okolí důležité.',
      supportingMessage: 'HolaLocal Komunita je plánována jako jednoduchý místní prostor založený na užitečných kontaktech a místních informacích.',
    },
  }),

  sk: productLanding({
    comingSoon: 'Už čoskoro',
    events: {
      eyebrow: 'Podujatia',
      title: 'Objavte, čo sa deje vo vašom okolí.',
      description: 'Jednoduchý spôsob, ako objavovať miestne podujatia, aktivity a dianie vo vašom okolí.',
      supportingMessage: 'HolaLocal Podujatia vznikajú, aby miestnym organizátorom pomohli zdieľať podujatia a ľuďom v okolí uľahčili ich objavovanie.',
    },
    community: {
      eyebrow: 'Komunita',
      title: 'Spojte sa so svojím okolím.',
      description: 'Budúci priestor, kde môžu miestni ľudia objavovať, zdieľať a zostať v spojení s tým, čo je v ich okolí dôležité.',
      supportingMessage: 'HolaLocal Komunita je plánovaná ako jednoduchý miestny priestor založený na užitočných spojeniach a miestnych informáciách.',
    },
  }),

  hu: productLanding({
    comingSoon: 'Hamarosan',
    events: {
      eyebrow: 'Események',
      title: 'Fedezze fel, mi történik a környéken.',
      description: 'Egyszerű módja a helyi események, programok és környékbeli történések felfedezésének.',
      supportingMessage: 'A HolaLocal Események azért készül, hogy segítse a helyi szervezőket eseményeik megosztásában, és megkönnyítse azok felfedezését a közelben élők számára.',
    },
    community: {
      eyebrow: 'Közösség',
      title: 'Kapcsolódjon helyi környezetéhez.',
      description: 'Egy jövőbeli tér, ahol a helyiek felfedezhetik és megoszthatják a közelükben fontos dolgokat, és kapcsolatban maradhatnak velük.',
      supportingMessage: 'A HolaLocal Közösség egy egyszerű helyi térként készül, amely hasznos kapcsolatokra és helyi információkra épül.',
    },
  }),

  uk: productLanding({
    comingSoon: 'Незабаром',
    events: {
      eyebrow: 'Події',
      title: 'Дізнавайтеся, що відбувається поруч.',
      description: 'Простий спосіб знаходити місцеві події, заходи та все, що відбувається у вашому районі.',
      supportingMessage: 'HolaLocal Події створюється, щоб допомогти місцевим організаторам ділитися подіями, а людям поблизу — легше їх знаходити.',
    },
    community: {
      eyebrow: 'Спільнота',
      title: 'Будьте на зв’язку зі своєю місцевою спільнотою.',
      description: 'Майбутній простір, де місцеві жителі зможуть знаходити, ділитися й залишатися на зв’язку з тим, що важливо поруч.',
      supportingMessage: 'HolaLocal Спільнота планується як простий місцевий простір для корисних зв’язків і місцевої інформації.',
    },
  }),

  it: productLanding({
    comingSoon: 'Prossimamente',
    events: {
      eyebrow: 'Eventi',
      title: 'Scopri cosa succede vicino a te.',
      description: 'Un modo semplice per scoprire eventi, attività e tutto ciò che accade nella tua zona.',
      supportingMessage: 'HolaLocal Eventi è in fase di sviluppo per aiutare gli organizzatori locali a condividere gli eventi e renderli più facili da scoprire per le persone nelle vicinanze.',
    },
    community: {
      eyebrow: 'Comunità',
      title: 'Connettiti con la tua zona.',
      description: 'Uno spazio futuro dove le persone potranno scoprire, condividere e restare connesse a ciò che conta nelle vicinanze.',
      supportingMessage: 'HolaLocal Comunità è pensata come uno spazio locale semplice, costruito intorno a connessioni utili e informazioni locali.',
    },
  }),

  sv: productLanding({
    comingSoon: 'Kommer snart',
    events: {
      eyebrow: 'Evenemang',
      title: 'Upptäck vad som händer lokalt.',
      description: 'Ett enkelt sätt att upptäcka lokala evenemang, aktiviteter och sådant som händer i ditt område.',
      supportingMessage: 'HolaLocal Evenemang utvecklas för att hjälpa lokala arrangörer att dela evenemang och göra dem enklare för människor i närheten att upptäcka.',
    },
    community: {
      eyebrow: 'Gemenskap',
      title: 'Kom närmare ditt närområde.',
      description: 'En framtida plats där lokalbefolkningen kan upptäcka, dela och hålla kontakten med det som är viktigt i närheten.',
      supportingMessage: 'HolaLocal Gemenskap planeras som en enkel lokal plats byggd kring användbara kontakter och lokal information.',
    },
  }),

  da: productLanding({
    comingSoon: 'Kommer snart',
    events: {
      eyebrow: 'Begivenheder',
      title: 'Opdag, hvad der sker lokalt.',
      description: 'En enkel måde at opdage lokale begivenheder, aktiviteter og det, der sker i dit område.',
      supportingMessage: 'HolaLocal Begivenheder udvikles for at hjælpe lokale arrangører med at dele begivenheder og gøre dem lettere at opdage for folk i nærheden.',
    },
    community: {
      eyebrow: 'Fællesskab',
      title: 'Kom tættere på dit lokalområde.',
      description: 'Et fremtidigt sted, hvor lokale kan opdage, dele og holde forbindelsen til det, der betyder noget i nærheden.',
      supportingMessage: 'HolaLocal Fællesskab er planlagt som et enkelt lokalt sted bygget op omkring nyttige forbindelser og lokal information.',
    },
  }),

  fi: productLanding({
    comingSoon: 'Tulossa pian',
    events: {
      eyebrow: 'Tapahtumat',
      title: 'Tutustu lähialueesi tapahtumiin.',
      description: 'Helppo tapa löytää paikallisia tapahtumia, aktiviteetteja ja muuta lähialueesi toimintaa.',
      supportingMessage: 'HolaLocal Tapahtumat auttaa paikallisia järjestäjiä jakamaan tapahtumia ja tekee niiden löytämisestä helpompaa lähialueen ihmisille.',
    },
    community: {
      eyebrow: 'Yhteisö',
      title: 'Löydä yhteys omaan lähialueeseesi.',
      description: 'Tuleva tila, jossa paikalliset voivat löytää ja jakaa lähellä tärkeitä asioita sekä pysyä niihin yhteydessä.',
      supportingMessage: 'HolaLocal Yhteisö on suunniteltu yksinkertaiseksi paikalliseksi tilaksi, joka rakentuu hyödyllisten yhteyksien ja paikallisen tiedon ympärille.',
    },
  }),

  no: productLanding({
    comingSoon: 'Kommer snart',
    events: {
      eyebrow: 'Arrangementer',
      title: 'Oppdag hva som skjer lokalt.',
      description: 'En enkel måte å oppdage lokale arrangementer, aktiviteter og ting som skjer i området ditt.',
      supportingMessage: 'HolaLocal Arrangementer utvikles for å hjelpe lokale arrangører med å dele arrangementer og gjøre dem lettere å oppdage for folk i nærheten.',
    },
    community: {
      eyebrow: 'Fellesskap',
      title: 'Knytt kontakt med nærmiljøet ditt.',
      description: 'Et fremtidig sted der lokalbefolkningen kan oppdage, dele og holde kontakten med det som betyr noe i nærheten.',
      supportingMessage: 'HolaLocal Fellesskap er planlagt som et enkelt lokalt sted bygget rundt nyttige forbindelser og lokal informasjon.',
    },
  }),
})

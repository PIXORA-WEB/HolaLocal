import { subscriptionProductEnglishTranslations } from '../subscriptionProductEnglishTranslations.js'

const subscriptionProducts = ({
  title,
  description,
  businessTitle,
  businessStatus,
  businessDescription,
  eventsTitle,
  eventsStatus,
  eventsDescription,
}) => Object.freeze({
  subscriptionProducts: Object.freeze({
    title,
    description,
    business: Object.freeze({
      title: businessTitle,
      status: businessStatus,
      description: businessDescription,
    }),
    events: Object.freeze({
      title: eventsTitle,
      status: eventsStatus,
      description: eventsDescription,
    }),
  }),
})

export const subscriptionProductTranslations = Object.freeze({
  en: subscriptionProductEnglishTranslations,
  es: subscriptionProducts({ title: 'Tus suscripciones', description: 'Consulta lo que se incluye hoy y lo que llegará próximamente.', businessTitle: 'Empresa', businessStatus: 'Gratis durante el acceso anticipado', businessDescription: 'Crea y gestiona gratis tu perfil de empresa mientras HolaLocal esté en acceso anticipado.', eventsTitle: 'Eventos', eventsStatus: 'Próximamente', eventsDescription: 'Las opciones de suscripción para Eventos se presentarán cuando HolaLocal Eventos esté listo.' }),
  fr: subscriptionProducts({ title: 'Vos abonnements', description: 'Découvrez ce qui est inclus aujourd’hui et ce qui arrive prochainement.', businessTitle: 'Entreprise', businessStatus: 'Gratuit pendant l’accès anticipé', businessDescription: 'Créez et gérez gratuitement votre profil professionnel pendant l’accès anticipé de HolaLocal.', eventsTitle: 'Événements', eventsStatus: 'Bientôt disponible', eventsDescription: 'Les options d’abonnement aux Événements seront proposées lorsque HolaLocal Événements sera prêt.' }),
  de: subscriptionProducts({ title: 'Ihre Abonnements', description: 'Sehen Sie, was heute enthalten ist und was als Nächstes kommt.', businessTitle: 'Unternehmen', businessStatus: 'Kostenlos während des Early Access', businessDescription: 'Erstellen und verwalten Sie Ihr Unternehmensprofil kostenlos, solange sich HolaLocal im Early Access befindet.', eventsTitle: 'Veranstaltungen', eventsStatus: 'Demnächst', eventsDescription: 'Abonnementoptionen für Veranstaltungen werden eingeführt, sobald HolaLocal Veranstaltungen bereit ist.' }),
  nl: subscriptionProducts({ title: 'Je abonnementen', description: 'Bekijk wat nu is inbegrepen en wat er binnenkort aankomt.', businessTitle: 'Bedrijf', businessStatus: 'Gratis tijdens Early Access', businessDescription: 'Maak en beheer je bedrijfsprofiel gratis zolang HolaLocal in Early Access is.', eventsTitle: 'Evenementen', eventsStatus: 'Binnenkort beschikbaar', eventsDescription: 'Abonnementsopties voor Evenementen worden geïntroduceerd zodra HolaLocal Evenementen klaar is.' }),
  pt: subscriptionProducts({ title: 'As suas subscrições', description: 'Veja o que está incluído hoje e o que chegará em breve.', businessTitle: 'Empresa', businessStatus: 'Gratuito durante o Acesso Antecipado', businessDescription: 'Crie e gira gratuitamente o perfil da sua empresa enquanto a HolaLocal estiver em Acesso Antecipado.', eventsTitle: 'Eventos', eventsStatus: 'Brevemente', eventsDescription: 'As opções de subscrição para Eventos serão apresentadas quando o HolaLocal Eventos estiver pronto.' }),
  pl: subscriptionProducts({ title: 'Twoje subskrypcje', description: 'Sprawdź, co jest dostępne teraz i co pojawi się wkrótce.', businessTitle: 'Firma', businessStatus: 'Bezpłatnie w okresie Early Access', businessDescription: 'Utwórz profil firmy i zarządzaj nim bezpłatnie, dopóki HolaLocal jest w okresie Early Access.', eventsTitle: 'Wydarzenia', eventsStatus: 'Wkrótce', eventsDescription: 'Opcje subskrypcji Wydarzeń zostaną wprowadzone, gdy HolaLocal Wydarzenia będzie gotowe.' }),
  ro: subscriptionProducts({ title: 'Abonamentele tale', description: 'Vezi ce este inclus acum și ce urmează.', businessTitle: 'Afacere', businessStatus: 'Gratuit în perioada de acces anticipat', businessDescription: 'Creează și gestionează gratuit profilul afacerii tale cât timp HolaLocal este în acces anticipat.', eventsTitle: 'Evenimente', eventsStatus: 'În curând', eventsDescription: 'Opțiunile de abonament pentru Evenimente vor fi introduse când HolaLocal Evenimente va fi pregătit.' }),
  cs: subscriptionProducts({ title: 'Vaše předplatné', description: 'Podívejte se, co je zahrnuto dnes a co se chystá.', businessTitle: 'Firma', businessStatus: 'Zdarma během předběžného přístupu', businessDescription: 'Vytvořte a spravujte firemní profil zdarma, dokud je HolaLocal v předběžném přístupu.', eventsTitle: 'Události', eventsStatus: 'Již brzy', eventsDescription: 'Možnosti předplatného pro Události budou zavedeny, až bude HolaLocal Události připraveno.' }),
  sk: subscriptionProducts({ title: 'Vaše predplatné', description: 'Pozrite si, čo je zahrnuté dnes a čo príde neskôr.', businessTitle: 'Firma', businessStatus: 'Zadarmo počas predbežného prístupu', businessDescription: 'Vytvorte a spravujte firemný profil zadarmo, kým je HolaLocal v predbežnom prístupe.', eventsTitle: 'Podujatia', eventsStatus: 'Už čoskoro', eventsDescription: 'Možnosti predplatného pre Podujatia budú zavedené, keď bude HolaLocal Podujatia pripravené.' }),
  hu: subscriptionProducts({ title: 'Előfizetéseid', description: 'Nézd meg, mi érhető el most, és mi érkezik később.', businessTitle: 'Vállalkozás', businessStatus: 'Ingyenes a korai hozzáférés alatt', businessDescription: 'Hozd létre és kezeld ingyenesen vállalkozási profilodat, amíg a HolaLocal korai hozzáférésben van.', eventsTitle: 'Események', eventsStatus: 'Hamarosan', eventsDescription: 'Az Események előfizetési lehetőségei akkor jelennek meg, amikor a HolaLocal Események elkészül.' }),
  uk: subscriptionProducts({ title: 'Ваші підписки', description: 'Дізнайтеся, що доступно вже зараз і що з’явиться згодом.', businessTitle: 'Бізнес', businessStatus: 'Безкоштовно під час раннього доступу', businessDescription: 'Створюйте та керуйте профілем бізнесу безкоштовно, поки HolaLocal перебуває в ранньому доступі.', eventsTitle: 'Події', eventsStatus: 'Незабаром', eventsDescription: 'Варіанти підписки для Подій з’являться, коли HolaLocal Події буде готовий.' }),
  it: subscriptionProducts({ title: 'I tuoi abbonamenti', description: 'Scopri cosa è incluso oggi e cosa arriverà prossimamente.', businessTitle: 'Attività', businessStatus: 'Gratis durante l’accesso anticipato', businessDescription: 'Crea e gestisci gratuitamente il profilo della tua attività mentre HolaLocal è in accesso anticipato.', eventsTitle: 'Eventi', eventsStatus: 'Prossimamente', eventsDescription: 'Le opzioni di abbonamento per Eventi saranno introdotte quando HolaLocal Eventi sarà pronto.' }),
  sv: subscriptionProducts({ title: 'Dina abonnemang', description: 'Se vad som ingår i dag och vad som kommer härnäst.', businessTitle: 'Företag', businessStatus: 'Kostnadsfritt under tidig åtkomst', businessDescription: 'Skapa och hantera din företagsprofil kostnadsfritt medan HolaLocal är i tidig åtkomst.', eventsTitle: 'Evenemang', eventsStatus: 'Kommer snart', eventsDescription: 'Abonnemangsalternativ för Evenemang lanseras när HolaLocal Evenemang är redo.' }),
  da: subscriptionProducts({ title: 'Dine abonnementer', description: 'Se, hvad der er inkluderet i dag, og hvad der kommer senere.', businessTitle: 'Virksomhed', businessStatus: 'Gratis under tidlig adgang', businessDescription: 'Opret og administrer din virksomhedsprofil gratis, mens HolaLocal er i tidlig adgang.', eventsTitle: 'Begivenheder', eventsStatus: 'Kommer snart', eventsDescription: 'Abonnementsmuligheder for Begivenheder introduceres, når HolaLocal Begivenheder er klar.' }),
  fi: subscriptionProducts({ title: 'Tilauksesi', description: 'Katso, mitä saat nyt ja mitä on tulossa seuraavaksi.', businessTitle: 'Yritys', businessStatus: 'Maksuton ennakkokäytön ajan', businessDescription: 'Luo ja hallinnoi yritysprofiiliasi maksutta niin kauan kuin HolaLocal on ennakkokäytössä.', eventsTitle: 'Tapahtumat', eventsStatus: 'Tulossa pian', eventsDescription: 'Tapahtumien tilausvaihtoehdot otetaan käyttöön, kun HolaLocal Tapahtumat on valmis.' }),
  no: subscriptionProducts({ title: 'Abonnementene dine', description: 'Se hva som er inkludert i dag, og hva som kommer senere.', businessTitle: 'Bedrift', businessStatus: 'Gratis under tidlig tilgang', businessDescription: 'Opprett og administrer bedriftsprofilen din gratis mens HolaLocal er i tidlig tilgang.', eventsTitle: 'Arrangementer', eventsStatus: 'Kommer snart', eventsDescription: 'Abonnementsalternativer for Arrangementer blir introdusert når HolaLocal Arrangementer er klart.' }),
})

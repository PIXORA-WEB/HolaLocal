const reasonLabels = {
  en: ['Incomplete profile', 'Unclear service information', 'Location or service-area issue', 'Contact-information issue', 'Logo or gallery issue', 'Unsupported or inappropriate content', 'Other'],
  es: ['Perfil incompleto', 'Información de servicios poco clara', 'Problema de ubicación o zona de servicio', 'Problema con la información de contacto', 'Problema con el logotipo o la galería', 'Contenido no compatible o inapropiado', 'Otro'],
  fr: ['Profil incomplet', 'Informations de service peu claires', 'Problème de localisation ou de zone de service', 'Problème de coordonnées', 'Problème de logo ou de galerie', 'Contenu non pris en charge ou inapproprié', 'Autre'],
  de: ['Unvollständiges Profil', 'Unklare Serviceinformationen', 'Problem mit Standort oder Servicegebiet', 'Problem mit Kontaktinformationen', 'Problem mit Logo oder Galerie', 'Nicht unterstützte oder unangemessene Inhalte', 'Sonstiges'],
  nl: ['Onvolledig profiel', 'Onduidelijke service-informatie', 'Probleem met locatie of servicegebied', 'Probleem met contactgegevens', 'Probleem met logo of galerij', 'Niet-ondersteunde of ongepaste inhoud', 'Anders'],
  pt: ['Perfil incompleto', 'Informações de serviço pouco claras', 'Problema de localização ou área de serviço', 'Problema com informações de contacto', 'Problema com logótipo ou galeria', 'Conteúdo não suportado ou inadequado', 'Outro'],
  pl: ['Niekompletny profil', 'Niejasne informacje o usługach', 'Problem z lokalizacją lub obszarem usług', 'Problem z danymi kontaktowymi', 'Problem z logo lub galerią', 'Nieobsługiwana lub nieodpowiednia treść', 'Inne'],
  ro: ['Profil incomplet', 'Informații neclare despre servicii', 'Problemă de locație sau zonă de servicii', 'Problemă cu datele de contact', 'Problemă cu sigla sau galeria', 'Conținut neacceptat sau neadecvat', 'Altul'],
  cs: ['Neúplný profil', 'Nejasné informace o službách', 'Problém s lokalitou nebo oblastí služeb', 'Problém s kontaktními údaji', 'Problém s logem nebo galerií', 'Nepodporovaný nebo nevhodný obsah', 'Jiné'],
  sk: ['Neúplný profil', 'Nejasné informácie o službách', 'Problém s lokalitou alebo oblasťou služieb', 'Problém s kontaktnými údajmi', 'Problém s logom alebo galériou', 'Nepodporovaný alebo nevhodný obsah', 'Iné'],
  hu: ['Hiányos profil', 'Nem egyértelmű szolgáltatási információk', 'Helyszínnel vagy szolgáltatási területtel kapcsolatos probléma', 'Kapcsolattartási adatokkal kapcsolatos probléma', 'Logóval vagy galériával kapcsolatos probléma', 'Nem támogatott vagy nem megfelelő tartalom', 'Egyéb'],
  uk: ['Неповний профіль', 'Нечітка інформація про послуги', 'Проблема з місцем або зоною обслуговування', 'Проблема з контактною інформацією', 'Проблема з логотипом або галереєю', 'Непідтримуваний або неприйнятний вміст', 'Інше'],
  it: ['Profilo incompleto', 'Informazioni sui servizi poco chiare', 'Problema di località o area di servizio', 'Problema con le informazioni di contatto', 'Problema con logo o galleria', 'Contenuti non supportati o inappropriati', 'Altro'],
  sv: ['Ofullständig profil', 'Otydlig tjänsteinformation', 'Problem med plats eller serviceområde', 'Problem med kontaktinformation', 'Problem med logotyp eller galleri', 'Innehåll som inte stöds eller är olämpligt', 'Annat'],
  da: ['Ufuldstændig profil', 'Uklare serviceoplysninger', 'Problem med placering eller serviceområde', 'Problem med kontaktoplysninger', 'Problem med logo eller galleri', 'Ikke-understøttet eller upassende indhold', 'Andet'],
  fi: ['Puutteellinen profiili', 'Epäselvät palvelutiedot', 'Sijaintiin tai palvelualueeseen liittyvä ongelma', 'Yhteystietoihin liittyvä ongelma', 'Logoon tai galleriaan liittyvä ongelma', 'Ei-tuettu tai sopimaton sisältö', 'Muu'],
  no: ['Ufullstendig profil', 'Uklar tjenesteinformasjon', 'Problem med sted eller tjenesteområde', 'Problem med kontaktinformasjon', 'Problem med logo eller galleri', 'Ikke-støttet eller upassende innhold', 'Annet'],
}

const ownerMessages = {
  en: ['Review feedback', 'Your business needs changes', 'Category', 'Read the guidance below, update your profile, then submit it for review again.', 'Edit business'],
  es: ['Comentarios de revisión', 'Tu negocio necesita cambios', 'Categoría', 'Lee las indicaciones, actualiza tu perfil y vuelve a enviarlo a revisión.', 'Editar negocio'],
  fr: ['Commentaires de vérification', 'Votre entreprise doit être modifiée', 'Catégorie', 'Lisez les conseils, mettez votre profil à jour, puis renvoyez-le pour vérification.', 'Modifier l’entreprise'],
  de: ['Prüfhinweise', 'Ihr Unternehmen muss geändert werden', 'Kategorie', 'Lesen Sie die Hinweise, aktualisieren Sie Ihr Profil und reichen Sie es erneut ein.', 'Unternehmen bearbeiten'],
  nl: ['Beoordelingsfeedback', 'Je bedrijf moet worden aangepast', 'Categorie', 'Lees de aanwijzingen, werk je profiel bij en dien het daarna opnieuw ter beoordeling in.', 'Bedrijf bewerken'],
  pt: ['Comentários da revisão', 'A sua empresa precisa de alterações', 'Categoria', 'Leia as orientações, atualize o perfil e volte a enviá-lo para revisão.', 'Editar empresa'],
  pl: ['Uwagi z weryfikacji', 'Profil firmy wymaga zmian', 'Kategoria', 'Przeczytaj wskazówki, zaktualizuj profil, a następnie prześlij go ponownie do weryfikacji.', 'Edytuj firmę'],
  ro: ['Observații de la verificare', 'Compania necesită modificări', 'Categorie', 'Citește îndrumările, actualizează profilul, apoi trimite-l din nou spre verificare.', 'Editează compania'],
  cs: ['Zpětná vazba z kontroly', 'Profil firmy vyžaduje úpravy', 'Kategorie', 'Přečtěte si pokyny, upravte profil a poté jej znovu odešlete ke kontrole.', 'Upravit firmu'],
  sk: ['Spätná väzba z kontroly', 'Profil firmy vyžaduje úpravy', 'Kategória', 'Prečítajte si pokyny, upravte profil a potom ho znova odošlite na kontrolu.', 'Upraviť firmu'],
  hu: ['Ellenőrzési visszajelzés', 'A vállalkozás adatlapját módosítani kell', 'Kategória', 'Olvasd el az útmutatást, frissítsd a profilt, majd küldd be újra ellenőrzésre.', 'Vállalkozás szerkesztése'],
  uk: ['Відгук за результатами перевірки', 'Профіль компанії потребує змін', 'Категорія', 'Прочитайте рекомендації, оновіть профіль і знову надішліть його на перевірку.', 'Редагувати компанію'],
  it: ['Feedback della revisione', 'La tua attività richiede modifiche', 'Categoria', 'Leggi le indicazioni, aggiorna il profilo e invialo nuovamente per la revisione.', 'Modifica attività'],
  sv: ['Granskningsfeedback', 'Företagsprofilen behöver ändras', 'Kategori', 'Läs vägledningen, uppdatera profilen och skicka sedan in den för granskning igen.', 'Redigera företag'],
  da: ['Feedback fra gennemgangen', 'Virksomhedsprofilen skal ændres', 'Kategori', 'Læs vejledningen, opdater profilen, og indsend den derefter til gennemgang igen.', 'Rediger virksomhed'],
  fi: ['Tarkistuspalaute', 'Yritysprofiilia on muutettava', 'Luokka', 'Lue ohjeet, päivitä profiili ja lähetä se sitten uudelleen tarkistettavaksi.', 'Muokkaa yritystä'],
  no: ['Tilbakemelding fra gjennomgangen', 'Bedriftsprofilen må endres', 'Kategori', 'Les veiledningen, oppdater profilen og send den deretter inn til ny gjennomgang.', 'Rediger bedrift'],
}

const reasonKeys = ['incomplete_profile', 'unclear_service_information', 'location_or_service_area', 'contact_information', 'logo_or_gallery', 'unsupported_or_inappropriate_content', 'other']

export const ownerRejectionTranslations = Object.fromEntries(Object.entries(reasonLabels).map(([locale, labels]) => {
  const owner = ownerMessages[locale]
  return [locale, {
    rejection: {
      reason: Object.fromEntries(reasonKeys.map((key, index) => [key, labels[index]])),
      owner: { eyebrow: owner[0], title: owner[1], category: owner[2], nextStep: owner[3], edit: owner[4] },
    },
  }]
}))

export const adminEnglishTranslations = {
  admin: {
    navigation: { label: 'Admin navigation', overview: 'Overview', businesses: 'Businesses' },
    access: {
      checking: 'Checking administrator access…', deniedTitle: 'Administrator access required',
      denied: 'Your account is signed in but does not have an administrator or moderator claim.',
      expiredTitle: 'Your session has expired', expired: 'Refresh your session and try again.',
      failedTitle: 'Unable to verify access', failed: 'We could not refresh your administrator permissions.',
    },
    overview: {
      eyebrow: 'Administration', title: 'Overview', description: 'A bounded snapshot of business moderation states.',
      loading: 'Loading business totals…', viewStatus: 'View {{status}} businesses',
    },
    businesses: {
      eyebrow: 'Moderation', title: 'Businesses', statusFilter: 'Status', pageSearch: 'Filter this page by business name',
      loading: 'Loading businesses…', empty: 'There are no businesses in this status.',
      caption: 'Businesses in the selected moderation status', name: 'Business', category: 'Primary category',
      location: 'Primary location', submitted: 'Submission or update date', status: 'Status',
      actions: 'Actions', review: 'Review', reviewNamed: 'Review {{name}}', loadMore: 'Load more',
    },
    review: {
      title: 'Business review', loading: 'Loading business review…', notFoundTitle: 'Business not found',
      notFound: 'This business could not be found.', loadErrorTitle: 'Unable to load business review',
      back: 'Back to moderation queue', eyebrow: 'Business review', alreadyReviewed: 'This business is no longer awaiting review. Actions have been disabled.',
      publicProfile: 'Public profile information', moderation: 'Private moderation information',
      tagline: 'Tagline', description: 'Description', category: 'Primary category', services: 'Services',
      location: 'Primary location', serviceAreas: 'Service areas', languages: 'Languages',
      contact: 'Public contact choices', platformOnly: 'HolaLocal messaging only', published: 'Published',
      logoAlt: '{{name}} logo', galleryAlt: '{{name}} gallery image {{index}}',
      businessId: 'Business ID', ownerUid: 'Owner UID', ownerName: 'Owner name',
      ownerEmail: 'Owner email', ownerLocale: 'Owner locale', submitted: 'Submitted',
      previousGuidance: 'Previous rejection guidance', history: 'Recent moderation history',
      noHistory: 'No moderation events yet.', approve: 'Approve and publish', reject: 'Reject',
      processing: 'Processing…', approved: 'Business approved and published.', rejected: 'Business rejected and guidance saved.',
    },
    approve: { title: 'Approve and publish?', description: 'Publish {{name}} after the backend eligibility check succeeds.' },
    reject: {
      title: 'Reject business', description: 'Give the owner clear, actionable guidance.',
      reason: 'Reason category', selectReason: 'Select a reason', reasonRequired: 'Choose a reason category.',
      guidance: 'Owner-facing guidance', guidanceHelp: 'Enter {{min}}–{{max}} characters. This is shown as plain text.',
      guidanceLength: 'Guidance must contain between {{min}} and {{max}} characters.',
    },
    errors: {
      permission: 'You do not have permission to access this administrator resource.',
      session: 'Your session is no longer valid. Sign in again and retry.',
      load: 'Administrator data could not be loaded. Please retry.',
      decision: 'The moderation decision could not be completed. No confirmed change is shown.',
      ineligible: 'This business does not meet the publication requirements. Its status was not changed.',
      stale: 'Another moderator has already reviewed this business. The latest record has been loaded.',
    },
    status: { pending_review: 'Pending review', active: 'Active', rejected: 'Rejected', suspended: 'Suspended' },
    actions: { publish: 'Approved and published', reject: 'Rejected' },
  },
}

import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Viestit', 'Yksityiset keskustelusi näkyvät täällä, kun aloitat viestittelyn.', 'Yksityiset keskustelut', 'Keskustele suoraan paikallisten yritysten kanssa HolaLocal-tililtäsi.', 'Keskustelut',
      'Ladataan keskusteluja…', 'Avataan keskustelua…', 'Yritys', 'Paikallinen yritys', 'Ei vielä viestejä', 'Lukematon keskustelu käyttäjän {{name}} kanssa', 'Keskustelut, joissa on lukemattomia viestejä: {{count}}',
      'Sinulla ei ole vielä keskusteluja.', 'Palaa etusivulle', 'Yksityiset viestisi', 'Valitse keskustelu lukeaksesi ja vastataksesi.', 'Keskustelu ei ole saatavilla',
      'Palaa viesteihin ja valitse toinen keskustelu.', 'Takaisin keskusteluihin', 'Aktiivinen profiili', 'Poista', 'Poistetaan…', 'Poistetaanko keskustelu?',
      'Keskustelu poistetaan postilaatikostasi. Toinen henkilö näkee sen edelleen, eikä viestejä poisteta pysyvästi.', 'Keskustelu poistettiin postilaatikostasi.',
      'Kirjoitat kielellä {{language}}. Automaattinen käännös ei ole vielä käytössä, joten alkuperäinen teksti näytetään.', 'Käännetään…', 'Käännös valmis', 'Käännös epäonnistui', 'Näytä alkuperäinen', 'Näytä käännös',
      'Aloita keskustelu', 'Viesti', 'Kirjoita viesti…', 'Lähetetään…', 'Lähetä', 'Haluamasi kieli', 'Yrityksen kieli',
      'Keskusteluja ei voitu ladata.', 'Viestejä ei voitu ladata.', 'Keskustelua ei voitu avata.', 'Viestiä ei voitu lähettää.', 'Keskustelua ei voitu poistaa.',
    ],
    reports: ['Luottamus ja turvallisuus', 'Ilmoita yrityksestä {{name}}', 'Sulje ilmoituslomake', 'Ilmoitus lähetetty', 'Kiitos. Ilmoituksesi on yksityinen, ja HolaLocal-tiimi tarkistaa sen.', 'Käytä lomaketta moderointiin, luottamukseen tai turvallisuuteen liittyvissä asioissa. Ilmoituksia ei koskaan näytetä julkisina arvosteluina.', 'Mikä on ongelma?', 'Harhaanjohtava profiili', 'Epäpätevä palvelu', 'Vaarallinen toiminta', 'Sopimaton käytös', 'Roskaposti tai valeyritys', 'Muu', 'Lisätiedot', 'Kerro tietoja, jotka auttavat meitä tarkistamaan asian.', 'Jos tarvitset apua alustan käytössä tai haluat antaa palautetta tai virallisen valituksen, lähetä sähköpostia osoitteeseen', 'Lähetetään…', 'Lähetä yksityinen ilmoitus'],
    onboarding: ['Määritä käyttökokemuksesi', 'Mihin käytät HolaLocalia?', 'Voit käyttää yhtä tiliä palvelujen etsimiseen, tarjoamiseen tai molempiin.', 'Valitse, miten käytät HolaLocalia', 'Valitse, miten aiot käyttää HolaLocalia.', 'Palvelujen etsiminen', 'Löydä luotettavia paikallisia ammattilaisia, kun tarvitset apua.', 'Palvelujen tarjoaminen', 'Luo yritysprofiili ja tarjoa palvelujasi.', 'Molemmat', 'Löydä paikallista apua ja tarjoa palveluja samalla tilillä.'],
    logoAlt: 'HolaLocal-logo',
    auth: ['Tällä sähköpostiosoitteella on jo tili.', 'Sähköpostiosoite tai salasana on virheellinen.', 'Anna kelvollinen sähköpostiosoite.', 'Yhteyttä ei voitu muodostaa. Tarkista internetyhteys ja yritä uudelleen.', 'Liian monta yritystä. Odota ennen kuin yrität uudelleen.', 'Tämä tili on poistettu käytöstä.', 'Valitse vahvempi, vähintään kahdeksan merkin salasana.', 'Tiliprofiilia ei voitu ladata. Yritä uudelleen.', 'Kirjautumisistuntoa ei voitu palauttaa. Päivitä sivu ja yritä uudelleen.', 'Tapahtui virhe. Yritä uudelleen.', 'Näytä salasana', 'Piilota salasana', 'Tilin palautus', 'Lähetämme salasanan palautusohjeet sähköpostiosoitteeseesi.', 'Jos sähköpostiosoitteella on tili, ohjeet on lähetetty.', 'Lähetä palautuslinkki'],
    services: ['Sulje kirjautumispyyntö', 'Yksityiset viestit', 'Kirjaudu sisään ilmoittaaksesi tästä yrityksestä', 'Kirjaudu sisään lähettääksesi viestin tälle yritykselle', 'Ilmoitukset lähetetään yksityisesti moderoitaviksi. Kirjaudu sisään jatkaaksesi; ilmoitusta ei luotu.', 'Viestien lähettäminen edellyttää HolaLocal-tiliä. Keskustelua ei luotu.'],
    business: ['Lähetä tarkistettavaksi', 'Yritysprofiili lähetettiin tarkistettavaksi.', 'Yritystä ei voitu lähettää tarkistettavaksi.'],
  },
{ customerFallback: 'Asiakas', messageHistory: 'Viestihistoria', you: 'Sinä', sentBy: 'Lähettäjä: {{name}}' },
{
    profileUnavailable: 'Profiili ei ole tällä hetkellä saatavilla',
    profileUnavailableDescription: 'Yritysprofiili ei ole tällä hetkellä saatavilla. Aiempi viestihistoria on edelleen käytettävissä.',
    messagingClosed: 'Tähän keskusteluun ei voi tällä hetkellä lähettää uusia viestejä.',
  },
{
    sessionExpired: 'Istuntosi on vanhentunut. Jatka kirjautumalla uudelleen.',
    permissionDenied: 'Et voi avata tai muuttaa tätä keskustelua.',
    networkUnavailable: 'Viestit eivät ole tilapäisesti käytettävissä. Tarkista yhteys ja yritä uudelleen.',
    notFound: 'Tämä keskustelu ei ole enää käytettävissä.',
    invalid: 'Viestiä ei voi lähettää tässä muodossa. Tarkista se ja yritä uudelleen.',
    conflict: 'Viestiä ei voitu käsitellä turvallisesti. Päivitä keskustelu ennen uutta yritystä.',
  },
'Löydä paikallisia ammattilaisia ja tutustu heidän julkisiin yritysprofiileihinsa.',
'Ilmoituksesi on lähetetty yksityisesti HolaLocal-tiimille.'
)

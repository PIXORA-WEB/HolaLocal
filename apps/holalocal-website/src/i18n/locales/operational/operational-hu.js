import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Üzenetek', 'A privát beszélgetéseid itt jelennek meg, miután üzenetet küldesz.', 'Privát beszélgetések', 'Beszélj közvetlenül helyi vállalkozásokkal a HolaLocal-fiókodból.', 'Beszélgetések',
      'Beszélgetések betöltése…', 'Beszélgetés megnyitása…', 'Vállalkozás', 'Helyi vállalkozás', 'Még nincsenek üzenetek', 'Olvasatlan beszélgetés vele: {{name}}',
      'Olvasatlan üzenetet tartalmazó beszélgetések: {{count}}', 'Még nincsenek beszélgetéseid.', 'Vissza a kezdőlapra', 'Privát üzeneteid', 'Válassz beszélgetést az olvasáshoz és válaszadáshoz.',
      'A beszélgetés nem érhető el', 'Térj vissza az üzenetekhez, és válassz másik beszélgetést.', 'Vissza a beszélgetésekhez', 'Aktív profil', 'Eltávolítás', 'Eltávolítás…', 'Eltávolítod a beszélgetést?',
      'A beszélgetés eltűnik a postaládádból. A másik fél továbbra is látja, és egyetlen üzenet sem törlődik véglegesen.', 'A beszélgetést eltávolítottuk a postaládádból.',
      '{{language}} nyelven ír. Az automatikus fordítás még nincs bekapcsolva, ezért az eredeti szöveg jelenik meg.', 'Fordítás…', 'Fordítás kész', 'A fordítás sikertelen', 'Eredeti megtekintése', 'Fordítás megtekintése',
      'Beszélgetés indítása', 'Üzenet', 'Írj üzenetet…', 'Küldés…', 'Küldés', 'A választott nyelved', 'A vállalkozás nyelve',
      'Nem sikerült betölteni a beszélgetéseket.', 'Nem sikerült betölteni az üzeneteket.', 'Nem sikerült megnyitni a beszélgetést.', 'Nem sikerült elküldeni az üzenetet.', 'Nem sikerült eltávolítani a beszélgetést.',
    ],
    reports: ['Bizalom és biztonság', '{{name}} bejelentése', 'Bejelentési űrlap bezárása', 'Bejelentés elküldve', 'Köszönjük. A bejelentésed privát, és a HolaLocal csapata megvizsgálja.', 'Ezt az űrlapot moderálási, bizalmi vagy biztonsági ügyekhez használd. A bejelentések soha nem jelennek meg nyilvános értékelésként.', 'Mi a probléma?', 'Félrevezető profil', 'Szakképzettség nélküli szolgáltatás', 'Veszélyes viselkedés', 'Helytelen magatartás', 'Spam vagy hamis vállalkozás', 'Egyéb', 'Részletek', 'Ossz meg információt, amely segít kivizsgálni az ügyet.', 'A platformmal kapcsolatos segítségért, visszajelzésért vagy hivatalos panaszért írj ide:', 'Küldés…', 'Privát bejelentés küldése'],
    onboarding: ['Állítsd be a felhasználói élményt', 'Mire használod a HolaLocalt?', 'Egyetlen fiókkal kereshetsz és kínálhatsz is szolgáltatásokat.', 'Válaszd ki, hogyan használod a HolaLocalt', 'Válaszd ki a HolaLocal tervezett használatát.', 'Szolgáltatások keresése', 'Találj megbízható helyi szakembereket, amikor segítségre van szükséged.', 'Szolgáltatások kínálása', 'Készíts vállalkozási profilt, és kínáld szolgáltatásaidat.', 'Mindkettő', 'Keress helyi segítséget és kínálj szolgáltatásokat ugyanazzal a fiókkal.'],
    logoAlt: 'HolaLocal embléma',
    auth: ['Már létezik fiók ezzel az e-mail-címmel.', 'Az e-mail-cím vagy a jelszó helytelen.', 'Adj meg érvényes e-mail-címet.', 'Nem sikerült kapcsolódni. Ellenőrizd az internetkapcsolatot, majd próbáld újra.', 'Túl sok próbálkozás. Várj, mielőtt újra próbálkozol.', 'Ezt a fiókot letiltották.', 'Válassz erősebb, legalább nyolc karakteres jelszót.', 'Nem sikerült betölteni a fiókprofilodat. Próbáld újra.', 'Nem sikerült visszaállítani a bejelentkezési munkamenetet. Frissítsd az oldalt, majd próbáld újra.', 'Hiba történt. Próbáld újra.', 'Jelszó megjelenítése', 'Jelszó elrejtése', 'Fiók helyreállítása', 'A jelszó-visszaállítási utasításokat elküldjük az e-mail-címedre.', 'Ha létezik fiók ehhez az e-mailhez, az utasításokat elküldtük.', 'Visszaállítási hivatkozás küldése'],
    services: ['Bejelentkezési kérés bezárása', 'Privát üzenetek', 'Jelentkezz be a vállalkozás bejelentéséhez', 'Jelentkezz be, hogy üzenetet küldhess ennek a vállalkozásnak', 'A bejelentések privát moderációs beküldések. A folytatáshoz jelentkezz be; nem jött létre bejelentés.', 'Üzenetküldéshez HolaLocal-fiók szükséges. Nem jött létre beszélgetés.'],
    business: ['Beküldés ellenőrzésre', 'A vállalkozási profilt beküldtük ellenőrzésre.', 'Nem sikerült ellenőrzésre beküldeni a vállalkozást.'],
  },
{ customerFallback: 'Ügyfél', messageHistory: 'Üzenetelőzmények', you: 'Ön', sentBy: 'Küldte: {{name}}' },
{
    profileUnavailable: 'A profil jelenleg nem érhető el',
    profileUnavailableDescription: 'Ez a vállalkozási profil jelenleg nem érhető el. A korábbi üzenetelőzmények továbbra is elérhetők.',
    messagingClosed: 'Ebben a beszélgetésben jelenleg nem küldhetők új üzenetek.',
  },
{
    sessionExpired: 'A munkameneted lejárt. A folytatáshoz jelentkezz be újra.',
    permissionDenied: 'Nem férsz hozzá ehhez a beszélgetéshez, és nem módosíthatod.',
    networkUnavailable: 'Az üzenetek átmenetileg nem érhetők el. Ellenőrizd a kapcsolatot, majd próbáld újra.',
    notFound: 'Ez a beszélgetés már nem érhető el.',
    invalid: 'Ez az üzenet ebben a formában nem küldhető el. Ellenőrizd, majd próbáld újra.',
    conflict: 'Az üzenetet nem sikerült biztonságosan feldolgozni. Újabb próbálkozás előtt frissítsd a beszélgetést.',
  },
'Fedezz fel helyi szakembereket, és tekintsd meg nyilvános vállalkozási profiljukat.',
'A bejelentésedet privát módon elküldtük a HolaLocal csapatának.'
)

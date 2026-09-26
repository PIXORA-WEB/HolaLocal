import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Správy', 'Vaše súkromné konverzácie sa zobrazia tu, keď začnete písať.', 'Súkromné konverzácie', 'Komunikujte priamo s miestnymi firmami zo svojho účtu HolaLocal.', 'Konverzácie',
      'Načítavajú sa konverzácie…', 'Otvára sa konverzácia…', 'Firma', 'Miestna firma', 'Zatiaľ žiadne správy', 'Neprečítaná konverzácia s {{name}}', 'Konverzácie s neprečítanými správami: {{count}}',
      'Zatiaľ nemáte žiadne konverzácie.', 'Späť na domovskú stránku', 'Vaše súkromné správy', 'Vyberte konverzáciu, ktorú chcete čítať a odpovedať.', 'Konverzácia nie je dostupná',
      'Vráťte sa k správam a vyberte inú konverzáciu.', 'Späť ku konverzáciám', 'Aktívny profil', 'Odstrániť', 'Odstraňuje sa…', 'Odstrániť konverzáciu?',
      'Konverzácia sa odstráni z vašej schránky. Druhá osoba ju bude naďalej vidieť a žiadne správy sa natrvalo nevymažú.', 'Konverzácia bola odstránená z vašej schránky.',
      'Pôvodné správy sú vždy dostupné.', 'Prekladá sa…', 'Strojový preklad', 'Preklad zlyhal', 'Zobraziť originál', 'Zobraziť preklad',
      'Začať konverzáciu', 'Správa', 'Napíšte správu…', 'Odosiela sa…', 'Odoslať', 'Váš preferovaný jazyk', 'Jazyk firmy',
      'Konverzácie sa nepodarilo načítať.', 'Správy sa nepodarilo načítať.', 'Konverzáciu sa nepodarilo otvoriť.', 'Správu sa nepodarilo odoslať.', 'Konverzáciu sa nepodarilo odstrániť.',
    ],
    reports: ['Dôvera a bezpečnosť', 'Nahlásiť {{name}}', 'Zavrieť formulár hlásenia', 'Hlásenie odoslané', 'Ďakujeme. Vaše hlásenie je súkromné a tím HolaLocal ho preverí.', 'Tento formulár použite na otázky moderovania, dôvery alebo bezpečnosti. Hlásenia sa nikdy nezobrazujú ako verejné recenzie.', 'V čom je problém?', 'Zavádzajúci profil', 'Nekvalifikovaná služba', 'Nebezpečné správanie', 'Nevhodné konanie', 'Spam alebo falošná firma', 'Iné', 'Podrobnosti', 'Uveďte informácie, ktoré nám pomôžu záležitosť preveriť.', 'Pre pomoc s platformou, spätnú väzbu alebo formálnu sťažnosť napíšte na', 'Odosiela sa…', 'Odoslať súkromné hlásenie'],
    onboarding: ['Nastavte si prostredie', 'Na čo budete HolaLocal používať?', 'Jeden účet môžete použiť na hľadanie služieb, ich ponúkanie alebo na oboje.', 'Vyberte spôsob používania HolaLocal', 'Vyberte, ako chcete HolaLocal používať.', 'Hľadanie služieb', 'Nájdite dôveryhodných miestnych odborníkov, keď potrebujete pomoc.', 'Ponúkanie služieb', 'Pripravte firemný profil a ponúkajte svoje služby.', 'Oboje', 'Hľadajte miestnu pomoc a ponúkajte služby z rovnakého účtu.'],
    logoAlt: 'Logo HolaLocal',
    auth: ['Účet s touto e-mailovou adresou už existuje.', 'E-mailová adresa alebo heslo nie sú správne.', 'Zadajte platnú e-mailovú adresu.', 'Pripojenie zlyhalo. Skontrolujte internet a skúste to znova.', 'Príliš veľa pokusov. Pred ďalším pokusom chvíľu počkajte.', 'Tento účet bol deaktivovaný.', 'Vyberte silnejšie heslo s aspoň ôsmimi znakmi.', 'Profil účtu sa nepodarilo načítať. Skúste to znova.', 'Prihlasovaciu reláciu sa nepodarilo obnoviť. Obnovte stránku a skúste to znova.', 'Vyskytla sa chyba. Skúste to znova.', 'Zobraziť heslo', 'Skryť heslo', 'Obnovenie účtu', 'Pokyny na obnovenie hesla pošleme na vašu e-mailovú adresu.', 'Ak účet pre tento e-mail existuje, pokyny boli odoslané.', 'Odoslať odkaz na obnovenie'],
    services: ['Zavrieť výzvu na prihlásenie', 'Súkromné správy', 'Na nahlásenie tejto firmy sa prihláste', 'Na odoslanie správy tejto firme sa prihláste', 'Hlásenia sú súkromné podania moderátorom. Prihláste sa a pokračujte; žiadne hlásenie nebolo vytvorené.', 'Na odosielanie správ je potrebný účet HolaLocal. Žiadna konverzácia nebola vytvorená.'],
    business: ['Odoslať na kontrolu', 'Firemný profil bol odoslaný na kontrolu.', 'Firmu sa nepodarilo odoslať na kontrolu.'],
  },
{ customerFallback: 'Zákazník', messageHistory: 'História správ', you: 'Vy', sentBy: 'Odoslal(a) {{name}}' },
{
    profileUnavailable: 'Profil je momentálne nedostupný',
    profileUnavailableDescription: 'Tento firemný profil je momentálne nedostupný. Doterajšia história správ zostáva dostupná.',
    messagingClosed: 'V tejto konverzácii momentálne nemožno posielať nové správy.',
  },
{
    sessionExpired: 'Platnosť vašej relácie vypršala. Ak chcete pokračovať, znova sa prihláste.',
    permissionDenied: 'K tejto konverzácii nemáte prístup a nemôžete ju meniť.',
    networkUnavailable: 'Správy sú dočasne nedostupné. Skontrolujte pripojenie a skúste to znova.',
    notFound: 'Táto konverzácia už nie je dostupná.',
    invalid: 'Túto správu nemožno v tejto podobe odoslať. Skontrolujte ju a skúste to znova.',
    conflict: 'Správu nebolo možné bezpečne spracovať. Pred ďalším pokusom konverzáciu obnovte.',
  },
'Nájdite miestnych odborníkov a prezrite si ich verejné firemné profily.',
'Vaše hlásenie bolo súkromne odoslané tímu HolaLocal.'
)

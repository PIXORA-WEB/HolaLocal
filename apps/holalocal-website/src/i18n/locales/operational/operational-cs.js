import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Zprávy', 'Vaše soukromé konverzace se zobrazí zde, až začnete psát.', 'Soukromé konverzace', 'Komunikujte přímo s místními firmami ze svého účtu HolaLocal.', 'Konverzace',
      'Načítání konverzací…', 'Otevírání konverzace…', 'Firma', 'Místní firma', 'Zatím žádné zprávy', 'Nepřečtená konverzace s {{name}}', 'Konverzace s nepřečtenými zprávami: {{count}}',
      'Zatím nemáte žádné konverzace.', 'Zpět na domovskou stránku', 'Vaše soukromé zprávy', 'Vyberte konverzaci, kterou chcete číst a odpovědět.', 'Konverzace není dostupná',
      'Vraťte se ke zprávám a vyberte jinou konverzaci.', 'Zpět ke konverzacím', 'Aktivní profil', 'Odstranit', 'Odstraňování…', 'Odstranit konverzaci?',
      'Konverzace se odstraní z vaší schránky. Druhá osoba ji stále uvidí a žádné zprávy nebudou trvale smazány.', 'Konverzace byla odstraněna z vaší schránky.',
      'Původní zprávy jsou vždy dostupné.', 'Překládání…', 'Strojový překlad', 'Překlad se nezdařil', 'Zobrazit originál', 'Zobrazit překlad',
      'Zahájit konverzaci', 'Zpráva', 'Napište zprávu…', 'Odesílání…', 'Odeslat', 'Váš preferovaný jazyk', 'Jazyk firmy',
      'Konverzace se nepodařilo načíst.', 'Zprávy se nepodařilo načíst.', 'Konverzaci se nepodařilo otevřít.', 'Zprávu se nepodařilo odeslat.', 'Konverzaci se nepodařilo odstranit.',
    ],
    reports: ['Důvěra a bezpečnost', 'Nahlásit {{name}}', 'Zavřít formulář hlášení', 'Hlášení odesláno', 'Děkujeme. Vaše hlášení je soukromé a tým HolaLocal je prověří.', 'Tento formulář použijte pro otázky moderování, důvěry nebo bezpečnosti. Hlášení se nikdy nezobrazují jako veřejné recenze.', 'V čem je problém?', 'Zavádějící profil', 'Nekvalifikovaná služba', 'Nebezpečné chování', 'Nevhodné jednání', 'Spam nebo falešná firma', 'Jiné', 'Podrobnosti', 'Sdělte informace, které nám pomohou záležitost prověřit.', 'S pomocí s platformou, zpětnou vazbou nebo formální stížností napište na', 'Odesílání…', 'Odeslat soukromé hlášení'],
    onboarding: ['Nastavte si prostředí', 'K čemu budete HolaLocal používat?', 'Jeden účet můžete použít k hledání služeb, jejich nabízení nebo k obojímu.', 'Vyberte způsob používání HolaLocal', 'Vyberte, jak chcete HolaLocal používat.', 'Hledání služeb', 'Najděte důvěryhodné místní odborníky, když potřebujete pomoc.', 'Nabízení služeb', 'Připravte firemní profil a nabízejte své služby.', 'Obojí', 'Hledejte místní pomoc a nabízejte služby ze stejného účtu.'],
    logoAlt: 'Logo HolaLocal',
    auth: ['Účet s touto e-mailovou adresou již existuje.', 'E-mailová adresa nebo heslo nejsou správné.', 'Zadejte platnou e-mailovou adresu.', 'Připojení se nezdařilo. Zkontrolujte internet a zkuste to znovu.', 'Příliš mnoho pokusů. Před dalším pokusem chvíli počkejte.', 'Tento účet byl deaktivován.', 'Zvolte silnější heslo s alespoň osmi znaky.', 'Profil účtu se nepodařilo načíst. Zkuste to znovu.', 'Přihlašovací relaci se nepodařilo obnovit. Obnovte stránku a zkuste to znovu.', 'Došlo k chybě. Zkuste to znovu.', 'Zobrazit heslo', 'Skrýt heslo', 'Obnovení účtu', 'Pokyny k obnovení hesla zašleme na vaši e-mailovou adresu.', 'Pokud účet pro tento e-mail existuje, pokyny byly odeslány.', 'Odeslat odkaz pro obnovení'],
    services: ['Zavřít výzvu k přihlášení', 'Soukromé zprávy', 'Pro nahlášení této firmy se přihlaste', 'Pro odeslání zprávy této firmě se přihlaste', 'Hlášení jsou soukromá podání moderátorům. Přihlaste se a pokračujte; žádné hlášení nebylo vytvořeno.', 'K odesílání zpráv je nutný účet HolaLocal. Žádná konverzace nebyla vytvořena.'],
    business: ['Odeslat ke kontrole', 'Firemní profil byl odeslán ke kontrole.', 'Firmu se nepodařilo odeslat ke kontrole.'],
  },
{ customerFallback: 'Zákazník', messageHistory: 'Historie zpráv', you: 'Vy', sentBy: 'Odeslal(a) {{name}}' },
{
    profileUnavailable: 'Profil je momentálně nedostupný',
    profileUnavailableDescription: 'Tento firemní profil je momentálně nedostupný. Dosavadní historie zpráv zůstává dostupná.',
    messagingClosed: 'V této konverzaci nyní nelze posílat nové zprávy.',
  },
{
    sessionExpired: 'Vaše relace vypršela. Pro pokračování se znovu přihlaste.',
    permissionDenied: 'K této konverzaci nemáte přístup a nemůžete ji měnit.',
    networkUnavailable: 'Zprávy jsou dočasně nedostupné. Zkontrolujte připojení a zkuste to znovu.',
    notFound: 'Tato konverzace již není dostupná.',
    invalid: 'Tuto zprávu nelze v této podobě odeslat. Zkontrolujte ji a zkuste to znovu.',
    conflict: 'Zprávu nebylo možné bezpečně zpracovat. Před dalším pokusem konverzaci obnovte.',
  },
'Najděte místní odborníky a prohlédněte si jejich veřejné firemní profily.',
'Vaše hlášení bylo soukromě odesláno týmu HolaLocal.'
)

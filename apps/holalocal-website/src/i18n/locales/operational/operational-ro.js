import { createOperational } from './createOperational.js'

export default createOperational({
    messages: [
      'Mesaje', 'Conversațiile private vor apărea aici după ce începi să trimiți mesaje.', 'Conversații private', 'Discută direct cu firme locale din contul HolaLocal.', 'Conversații',
      'Se încarcă conversațiile…', 'Se deschide conversația…', 'Firmă', 'Firmă locală', 'Încă nu există mesaje', 'Conversație necitită cu {{name}}',
      'Conversații cu mesaje necitite: {{count}}', 'Nu ai încă nicio conversație.', 'Înapoi la pagina principală', 'Mesajele tale private', 'Selectează o conversație pentru a citi și a răspunde.',
      'Conversație indisponibilă', 'Revino la mesaje și alege altă conversație.', 'Înapoi la conversații', 'Profil activ', 'Elimină', 'Se elimină…', 'Elimini conversația?',
      'Conversația va fi eliminată din căsuța ta. Cealaltă persoană o va putea vedea în continuare, iar mesajele nu vor fi șterse definitiv.', 'Conversația a fost eliminată din căsuța ta.',
      'Mesajele originale sunt întotdeauna disponibile.', 'Se traduce…', 'Traducere automată', 'Traducerea a eșuat', 'Vezi originalul',
      'Vezi traducerea', 'Începe conversația', 'Mesaj', 'Scrie un mesaj…', 'Se trimite…', 'Trimite', 'Limba ta preferată', 'Limba firmei',
      'Conversațiile nu au putut fi încărcate.', 'Mesajele nu au putut fi încărcate.', 'Conversația nu a putut fi deschisă.', 'Mesajul nu a putut fi trimis.', 'Conversația nu a putut fi eliminată.',
    ],
    reports: [
      'Încredere și siguranță', 'Raportează {{name}}', 'Închide formularul de raportare', 'Raport trimis', 'Mulțumim. Raportul este privat și va fi analizat de echipa HolaLocal.',
      'Folosește formularul pentru probleme de moderare, încredere sau siguranță. Rapoartele nu apar niciodată ca recenzii publice.', 'Care este problema?', 'Profil înșelător',
      'Serviciu necalificat', 'Comportament periculos', 'Conduită necorespunzătoare', 'Spam sau firmă falsă', 'Alt motiv', 'Detalii', 'Oferă informații care ne ajută să analizăm problema.',
      'Pentru ajutor privind platforma, feedback sau o reclamație oficială, trimite un e-mail la', 'Se trimite…', 'Trimite raportul privat',
    ],
    onboarding: [
      'Configurează-ți experiența', 'Pentru ce vei folosi HolaLocal?', 'Poți folosi același cont pentru a găsi servicii, a oferi servicii sau ambele.', 'Alege cum vei folosi HolaLocal',
      'Alege cum intenționezi să folosești HolaLocal.', 'Găsirea serviciilor', 'Descoperă profesioniști locali de încredere când ai nevoie de ajutor.', 'Oferirea serviciilor',
      'Pregătește un profil de firmă și oferă-ți serviciile.', 'Ambele', 'Găsește ajutor local și oferă servicii din același cont.',
    ],
    logoAlt: 'Sigla HolaLocal',
    auth: [
      'Există deja un cont pentru această adresă de e-mail.', 'Adresa de e-mail sau parola este incorectă.', 'Introdu o adresă de e-mail validă.', 'Conexiunea nu a reușit. Verifică internetul și încearcă din nou.',
      'Prea multe încercări. Așteaptă înainte de a încerca din nou.', 'Acest cont a fost dezactivat.', 'Alege o parolă mai puternică, de cel puțin opt caractere.',
      'Profilul contului nu a putut fi încărcat. Încearcă din nou.', 'Sesiunea de autentificare nu a putut fi restabilită. Reîncarcă pagina și încearcă din nou.', 'A apărut o eroare. Încearcă din nou.',
      'Arată parola', 'Ascunde parola', 'Recuperarea contului', 'Vom trimite instrucțiuni de resetare a parolei la adresa ta de e-mail.',
      'Dacă există un cont pentru acel e-mail, instrucțiunile au fost trimise.', 'Trimite linkul de resetare',
    ],
    services: ['Închide solicitarea de autentificare', 'Mesaje private', 'Autentifică-te pentru a raporta această firmă', 'Autentifică-te pentru a trimite un mesaj acestei firme', 'Rapoartele sunt trimise privat spre moderare. Autentifică-te pentru a continua; nu a fost creat niciun raport.', 'Este necesar un cont HolaLocal pentru mesaje. Nu a fost creată nicio conversație.'],
    business: ['Trimite spre analiză', 'Profilul firmei a fost trimis spre analiză.', 'Firma nu a putut fi trimisă spre analiză.'],
  },
{ customerFallback: 'Client', messageHistory: 'Istoricul mesajelor', you: 'Tu', sentBy: 'Trimis de {{name}}' },
{
    profileUnavailable: 'Profil indisponibil momentan',
    profileUnavailableDescription: 'Acest profil de firmă este momentan indisponibil. Istoricul existent al mesajelor rămâne disponibil.',
    messagingClosed: 'Momentan nu pot fi trimise mesaje noi în această conversație.',
  },
{
    sessionExpired: 'Sesiunea ta a expirat. Autentifică-te din nou pentru a continua.',
    permissionDenied: 'Nu poți accesa sau modifica această conversație.',
    networkUnavailable: 'Mesajele sunt temporar indisponibile. Verifică conexiunea și încearcă din nou.',
    notFound: 'Această conversație nu mai este disponibilă.',
    invalid: 'Acest mesaj nu poate fi trimis în forma actuală. Verifică-l și încearcă din nou.',
    conflict: 'Mesajul nu a putut fi procesat în siguranță. Reîncarcă conversația înainte de a încerca din nou.',
  },
'Descoperă profesioniști locali și consultă profilurile publice ale firmelor lor.',
'Raportul tău a fost trimis în mod privat echipei HolaLocal.'
)

// Authored interface translations; customer-written content is never translated here.
const keys='title|myReviews|myReview|statsUnavailable|count|updated|reviewer|rating|text|counter|validation|submit|edit|withdraw|withdrawConfirm|approval|signIn|signInAction|verify|account|ineligible|self|unavailable|quota|failure|refresh|duplicate|success|empty|more|pending|pendingEdit|rejected|published|withdrawn|removed|submittedText|report|reportNotice|reason|details|submitReport|spam|abusive_content|personal_information|irrelevant_content|conflict_of_interest|other'.split('|')
const rows={
en:'Reviews|My reviews|Your review|Rating unavailable|Review count: {{number}}|Updated|Reviewer|Rating|Review text|{{number}} characters; 20–2,000 required after normalization.|Choose a rating from 1–5 and write 20–2,000 characters.|Submit review|Submit edit|Withdraw review|Remove your published review and cancel any pending edit?|New reviews and edits require admin approval. Your approved version stays visible while an edit is reviewed.|Sign in to continue.|Sign in|Verify your email to submit.|Account|Your account cannot submit reviews right now.|Owners and managers cannot review their own business.|This business or review is unavailable.|Submission limit reached. Try again later.|The request could not be confirmed. Retry the same request.|Content changed. Refresh before continuing.|You already have an open report for this review.|Request completed.|No reviews to display.|Load more|Awaiting approval|Published; edit awaiting approval|Rejected. You may submit again; any approved version remains visible.|Published|Withdrawn. You may submit again.|Removed. Resubmission is unavailable.|Latest submitted text|Report review|Reports go to moderation. Reporting does not automatically remove a review. A negative rating alone is not abuse.|Reason|Details (optional, up to 2,000 characters)|Send report|Spam|Abusive content|Personal information|Irrelevant content|Conflict of interest|Other',
es:'Reseñas|Mis reseñas|Tu reseña|Valoración no disponible|Número de reseñas: {{number}}|Actualizada|Autor de la reseña|Valoración|Texto de la reseña|{{number}} caracteres; se requieren 20–2.000 tras normalizar.|Elige una valoración de 1 a 5 y escribe entre 20 y 2.000 caracteres.|Enviar reseña|Enviar cambios|Retirar reseña|¿Retirar tu reseña publicada y cancelar los cambios pendientes?|Las reseñas nuevas y los cambios requieren aprobación administrativa. La versión aprobada sigue visible mientras se revisan los cambios.|Inicia sesión para continuar.|Iniciar sesión|Verifica tu correo para enviar.|Cuenta|Tu cuenta no puede enviar reseñas ahora.|Los propietarios y gestores no pueden reseñar su propio negocio.|Este negocio o esta reseña no está disponible.|Has alcanzado el límite. Inténtalo más tarde.|No se pudo confirmar la solicitud. Reintenta la misma solicitud.|El contenido ha cambiado. Actualiza antes de continuar.|Ya tienes un reporte abierto para esta reseña.|Solicitud completada.|No hay reseñas para mostrar.|Cargar más|Pendiente de aprobación|Publicada; cambios pendientes de aprobación|Rechazada. Puedes enviarla de nuevo; la versión aprobada sigue visible.|Publicada|Retirada. Puedes enviarla de nuevo.|Eliminada. No se puede volver a enviar.|Último texto enviado|Reportar reseña|Los reportes pasan a moderación. No eliminan automáticamente una reseña. Una valoración negativa por sí sola no es abuso.|Motivo|Detalles (opcionales, hasta 2.000 caracteres)|Enviar reporte|Spam|Contenido abusivo|Información personal|Contenido irrelevante|Conflicto de intereses|Otro',
fr:'Avis|Mes avis|Votre avis|Note indisponible|Nombre d’avis : {{number}}|Mis à jour|Auteur de l’avis|Note|Texte de l’avis|{{number}} caractères ; 20 à 2 000 requis après normalisation.|Choisissez une note de 1 à 5 et écrivez entre 20 et 2 000 caractères.|Envoyer l’avis|Envoyer la modification|Retirer l’avis|Retirer votre avis publié et annuler toute modification en attente ?|Les avis et modifications nécessitent une approbation administrative. La version approuvée reste visible pendant l’examen.|Connectez-vous pour continuer.|Se connecter|Vérifiez votre adresse e-mail pour envoyer.|Compte|Votre compte ne peut pas envoyer d’avis actuellement.|Les propriétaires et responsables ne peuvent pas évaluer leur propre entreprise.|Cette entreprise ou cet avis est indisponible.|Limite atteinte. Réessayez plus tard.|La demande n’a pas pu être confirmée. Réessayez la même demande.|Le contenu a changé. Actualisez avant de continuer.|Vous avez déjà un signalement ouvert pour cet avis.|Demande terminée.|Aucun avis à afficher.|Afficher plus|En attente d’approbation|Publié ; modification en attente|Rejeté. Vous pouvez renvoyer un avis ; la version approuvée reste visible.|Publié|Retiré. Vous pouvez renvoyer un avis.|Supprimé. Nouvel envoi impossible.|Dernier texte envoyé|Signaler l’avis|Les signalements sont examinés sans suppression automatique. Une mauvaise note seule n’est pas un abus.|Motif|Détails (facultatifs, 2 000 caractères maximum)|Envoyer le signalement|Spam|Contenu abusif|Informations personnelles|Contenu hors sujet|Conflit d’intérêts|Autre',
de:'Bewertungen|Meine Bewertungen|Deine Bewertung|Bewertung nicht verfügbar|Anzahl der Bewertungen: {{number}}|Aktualisiert|Bewertende Person|Bewertung|Bewertungstext|{{number}} Zeichen; nach Normalisierung sind 20–2.000 erforderlich.|Wähle 1–5 Punkte und schreibe 20–2.000 Zeichen.|Bewertung senden|Änderung senden|Bewertung zurückziehen|Veröffentlichte Bewertung zurückziehen und ausstehende Änderungen verwerfen?|Neue Bewertungen und Änderungen benötigen eine Admin-Freigabe. Die freigegebene Fassung bleibt während der Prüfung sichtbar.|Melde dich an, um fortzufahren.|Anmelden|Bestätige deine E-Mail-Adresse zum Senden.|Konto|Dein Konto kann derzeit keine Bewertungen senden.|Inhaber und Verwalter dürfen ihr eigenes Unternehmen nicht bewerten.|Dieses Unternehmen oder diese Bewertung ist nicht verfügbar.|Limit erreicht. Versuche es später erneut.|Die Anfrage konnte nicht bestätigt werden. Wiederhole dieselbe Anfrage.|Der Inhalt wurde geändert. Lade ihn erneut.|Du hast bereits eine offene Meldung für diese Bewertung.|Anfrage abgeschlossen.|Keine Bewertungen vorhanden.|Mehr laden|Freigabe ausstehend|Veröffentlicht; Änderung wartet auf Freigabe|Abgelehnt. Erneutes Einreichen möglich; die freigegebene Fassung bleibt sichtbar.|Veröffentlicht|Zurückgezogen. Erneutes Einreichen möglich.|Entfernt. Erneutes Einreichen nicht möglich.|Zuletzt eingereichter Text|Bewertung melden|Meldungen werden geprüft und entfernen Bewertungen nicht automatisch. Eine schlechte Note allein ist kein Missbrauch.|Grund|Details (optional, höchstens 2.000 Zeichen)|Meldung senden|Spam|Beleidigender Inhalt|Persönliche Informationen|Unpassender Inhalt|Interessenkonflikt|Sonstiges',
it:'Recensioni|Le mie recensioni|La tua recensione|Valutazione non disponibile|Numero di recensioni: {{number}}|Aggiornata|Autore della recensione|Valutazione|Testo della recensione|{{number}} caratteri; richiesti 20–2.000 dopo la normalizzazione.|Scegli un voto da 1 a 5 e scrivi 20–2.000 caratteri.|Invia recensione|Invia modifica|Ritira recensione|Ritirare la recensione pubblicata e annullare le modifiche in attesa?|Recensioni e modifiche richiedono approvazione amministrativa. La versione approvata resta visibile durante la revisione.|Accedi per continuare.|Accedi|Verifica la tua e-mail per inviare.|Account|Il tuo account non può inviare recensioni al momento.|Proprietari e gestori non possono recensire la propria attività.|Questa attività o recensione non è disponibile.|Limite raggiunto. Riprova più tardi.|Impossibile confermare la richiesta. Riprova la stessa richiesta.|Il contenuto è cambiato. Aggiorna prima di continuare.|Hai già una segnalazione aperta per questa recensione.|Richiesta completata.|Nessuna recensione da mostrare.|Carica altro|In attesa di approvazione|Pubblicata; modifica in attesa|Rifiutata. Puoi inviarla di nuovo; la versione approvata resta visibile.|Pubblicata|Ritirata. Puoi inviarla di nuovo.|Rimossa. Nuovo invio non disponibile.|Ultimo testo inviato|Segnala recensione|Le segnalazioni vengono moderate e non rimuovono automaticamente le recensioni. Un voto negativo da solo non è abuso.|Motivo|Dettagli (facoltativi, massimo 2.000 caratteri)|Invia segnalazione|Spam|Contenuto offensivo|Informazioni personali|Contenuto non pertinente|Conflitto di interessi|Altro',
pt:'Avaliações|As minhas avaliações|A sua avaliação|Classificação indisponível|Número de avaliações: {{number}}|Atualizada|Autor da avaliação|Classificação|Texto da avaliação|{{number}} caracteres; são necessários 20–2.000 após normalização.|Escolha uma nota de 1 a 5 e escreva 20–2.000 caracteres.|Enviar avaliação|Enviar alteração|Retirar avaliação|Retirar a avaliação publicada e cancelar alterações pendentes?|Avaliações e alterações exigem aprovação administrativa. A versão aprovada continua visível durante a análise.|Inicie sessão para continuar.|Iniciar sessão|Verifique o seu e-mail para enviar.|Conta|A sua conta não pode enviar avaliações neste momento.|Proprietários e gestores não podem avaliar o próprio negócio.|Este negócio ou avaliação está indisponível.|Limite atingido. Tente mais tarde.|Não foi possível confirmar o pedido. Repita o mesmo pedido.|O conteúdo mudou. Atualize antes de continuar.|Já tem uma denúncia aberta para esta avaliação.|Pedido concluído.|Sem avaliações para mostrar.|Carregar mais|A aguardar aprovação|Publicada; alteração pendente|Rejeitada. Pode enviar novamente; a versão aprovada continua visível.|Publicada|Retirada. Pode enviar novamente.|Removida. Novo envio indisponível.|Último texto enviado|Denunciar avaliação|As denúncias são moderadas e não removem avaliações automaticamente. Uma nota negativa por si só não é abuso.|Motivo|Detalhes (opcionais, até 2.000 caracteres)|Enviar denúncia|Spam|Conteúdo abusivo|Informações pessoais|Conteúdo irrelevante|Conflito de interesses|Outro',
nl:'Beoordelingen|Mijn beoordelingen|Je beoordeling|Score niet beschikbaar|Aantal beoordelingen: {{number}}|Bijgewerkt|Beoordelaar|Score|Beoordelingstekst|{{number}} tekens; 20–2.000 vereist na normalisatie.|Kies 1–5 punten en schrijf 20–2.000 tekens.|Beoordeling versturen|Wijziging versturen|Beoordeling intrekken|Je gepubliceerde beoordeling intrekken en wachtende wijzigingen annuleren?|Nieuwe beoordelingen en wijzigingen vereisen goedkeuring. De goedgekeurde versie blijft tijdens de controle zichtbaar.|Log in om verder te gaan.|Inloggen|Verifieer je e-mail om te versturen.|Account|Je account kan momenteel geen beoordelingen versturen.|Eigenaren en beheerders mogen hun eigen bedrijf niet beoordelen.|Dit bedrijf of deze beoordeling is niet beschikbaar.|Limiet bereikt. Probeer het later opnieuw.|Het verzoek kon niet worden bevestigd. Probeer hetzelfde verzoek opnieuw.|De inhoud is gewijzigd. Vernieuw om verder te gaan.|Je hebt al een open melding voor deze beoordeling.|Verzoek voltooid.|Geen beoordelingen beschikbaar.|Meer laden|Wacht op goedkeuring|Gepubliceerd; wijziging wacht op goedkeuring|Afgewezen. Je kunt opnieuw indienen; de goedgekeurde versie blijft zichtbaar.|Gepubliceerd|Ingetrokken. Je kunt opnieuw indienen.|Verwijderd. Opnieuw indienen is niet mogelijk.|Laatst ingediende tekst|Beoordeling melden|Meldingen worden beoordeeld en verwijderen beoordelingen niet automatisch. Een lage score alleen is geen misbruik.|Reden|Details (optioneel, maximaal 2.000 tekens)|Melding versturen|Spam|Beledigende inhoud|Persoonlijke informatie|Irrelevante inhoud|Belangenverstrengeling|Anders',
sv:'Omdömen|Mina omdömen|Ditt omdöme|Betyg saknas|Antal omdömen: {{number}}|Uppdaterat|Omdömesförfattare|Betyg|Omdömestext|{{number}} tecken; 20–2 000 krävs efter normalisering.|Välj 1–5 poäng och skriv 20–2 000 tecken.|Skicka omdöme|Skicka ändring|Dra tillbaka omdöme|Dra tillbaka ditt publicerade omdöme och avbryta väntande ändringar?|Nya omdömen och ändringar kräver godkännande. Den godkända versionen visas under granskningen.|Logga in för att fortsätta.|Logga in|Verifiera din e-post för att skicka.|Konto|Ditt konto kan inte skicka omdömen just nu.|Ägare och ansvariga får inte recensera sitt eget företag.|Företaget eller omdömet är inte tillgängligt.|Gränsen är nådd. Försök senare.|Begäran kunde inte bekräftas. Försök med samma begäran igen.|Innehållet har ändrats. Uppdatera innan du fortsätter.|Du har redan en öppen anmälan för detta omdöme.|Begäran klar.|Inga omdömen att visa.|Visa fler|Väntar på godkännande|Publicerat; ändring väntar|Avvisat. Du kan skicka igen; den godkända versionen visas fortfarande.|Publicerat|Tillbakadraget. Du kan skicka igen.|Borttaget. Kan inte skickas igen.|Senast inskickade text|Anmäl omdöme|Anmälningar granskas och tar inte automatiskt bort omdömen. Ett lågt betyg är inte i sig missbruk.|Orsak|Detaljer (valfritt, högst 2 000 tecken)|Skicka anmälan|Spam|Kränkande innehåll|Personuppgifter|Irrelevant innehåll|Intressekonflikt|Annat',
no:'Anmeldelser|Mine anmeldelser|Din anmeldelse|Vurdering utilgjengelig|Antall anmeldelser: {{number}}|Oppdatert|Anmelder|Vurdering|Anmeldelsestekst|{{number}} tegn; 20–2 000 kreves etter normalisering.|Velg 1–5 poeng og skriv 20–2 000 tegn.|Send anmeldelse|Send endring|Trekk tilbake anmeldelse|Trekke tilbake anmeldelsen og avbryte ventende endringer?|Nye anmeldelser og endringer krever godkjenning. Den godkjente versjonen vises under gjennomgangen.|Logg inn for å fortsette.|Logg inn|Bekreft e-posten din for å sende.|Konto|Kontoen din kan ikke sende anmeldelser nå.|Eiere og administratorer kan ikke anmelde egen bedrift.|Bedriften eller anmeldelsen er utilgjengelig.|Grensen er nådd. Prøv senere.|Forespørselen kunne ikke bekreftes. Prøv samme forespørsel igjen.|Innholdet er endret. Oppdater før du fortsetter.|Du har allerede en åpen rapport for denne anmeldelsen.|Forespørsel fullført.|Ingen anmeldelser å vise.|Last flere|Venter på godkjenning|Publisert; endring venter|Avvist. Du kan sende på nytt; godkjent versjon vises fortsatt.|Publisert|Trukket tilbake. Du kan sende på nytt.|Fjernet. Kan ikke sendes på nytt.|Sist innsendte tekst|Rapporter anmeldelse|Rapporter vurderes og fjerner ikke anmeldelser automatisk. En lav vurdering alene er ikke misbruk.|Årsak|Detaljer (valgfritt, maks 2 000 tegn)|Send rapport|Spam|Krenkende innhold|Personopplysninger|Irrelevant innhold|Interessekonflikt|Annet',
da:'Anmeldelser|Mine anmeldelser|Din anmeldelse|Bedømmelse utilgængelig|Antal anmeldelser: {{number}}|Opdateret|Anmelder|Bedømmelse|Anmeldelsestekst|{{number}} tegn; 20–2.000 kræves efter normalisering.|Vælg 1–5 point og skriv 20–2.000 tegn.|Send anmeldelse|Send ændring|Træk anmeldelse tilbage|Trække anmeldelsen tilbage og annullere afventende ændringer?|Nye anmeldelser og ændringer kræver godkendelse. Den godkendte version vises under gennemgangen.|Log ind for at fortsætte.|Log ind|Bekræft din e-mail for at sende.|Konto|Din konto kan ikke sende anmeldelser nu.|Ejere og administratorer kan ikke anmelde egen virksomhed.|Virksomheden eller anmeldelsen er utilgængelig.|Grænsen er nået. Prøv senere.|Anmodningen kunne ikke bekræftes. Prøv samme anmodning igen.|Indholdet er ændret. Opdater før du fortsætter.|Du har allerede en åben rapport om denne anmeldelse.|Anmodning gennemført.|Ingen anmeldelser at vise.|Indlæs flere|Afventer godkendelse|Udgivet; ændring afventer|Afvist. Du kan sende igen; den godkendte version vises stadig.|Udgivet|Trukket tilbage. Du kan sende igen.|Fjernet. Kan ikke sendes igen.|Senest indsendte tekst|Rapportér anmeldelse|Rapporter gennemgås og fjerner ikke automatisk anmeldelser. En lav bedømmelse alene er ikke misbrug.|Årsag|Detaljer (valgfrit, højst 2.000 tegn)|Send rapport|Spam|Krænkende indhold|Personlige oplysninger|Irrelevant indhold|Interessekonflikt|Andet',
fi:'Arvostelut|Omat arvostelut|Arvostelusi|Arvosana ei saatavilla|Arvostelujen määrä: {{number}}|Päivitetty|Arvostelija|Arvosana|Arvosteluteksti|{{number}} merkkiä; normalisoinnin jälkeen vaaditaan 20–2 000.|Valitse arvosana 1–5 ja kirjoita 20–2 000 merkkiä.|Lähetä arvostelu|Lähetä muutos|Peru arvostelu|Perutaanko julkaistu arvostelu ja odottavat muutokset?|Uudet arvostelut ja muutokset vaativat ylläpitäjän hyväksynnän. Hyväksytty versio näkyy tarkistuksen ajan.|Kirjaudu jatkaaksesi.|Kirjaudu|Vahvista sähköpostisi ennen lähettämistä.|Tili|Tilisi ei voi lähettää arvosteluja nyt.|Omistajat ja ylläpitäjät eivät voi arvostella omaa yritystään.|Yritys tai arvostelu ei ole saatavilla.|Raja saavutettu. Yritä myöhemmin.|Pyyntöä ei voitu vahvistaa. Yritä samaa pyyntöä uudelleen.|Sisältö on muuttunut. Päivitä ennen jatkamista.|Sinulla on jo avoin ilmoitus tästä arvostelusta.|Pyyntö valmis.|Ei näytettäviä arvosteluja.|Lataa lisää|Odottaa hyväksyntää|Julkaistu; muutos odottaa|Hylätty. Voit lähettää uudelleen; hyväksytty versio näkyy edelleen.|Julkaistu|Peruttu. Voit lähettää uudelleen.|Poistettu. Uudelleenlähetys ei ole mahdollista.|Viimeksi lähetetty teksti|Ilmoita arvostelusta|Ilmoitukset tarkistetaan eivätkä ne poista arvosteluja automaattisesti. Huono arvosana ei yksin ole väärinkäyttöä.|Syy|Lisätiedot (valinnainen, enintään 2 000 merkkiä)|Lähetä ilmoitus|Roskaposti|Loukkaava sisältö|Henkilötiedot|Asiaankuulumaton sisältö|Eturistiriita|Muu',
pl:'Opinie|Moje opinie|Twoja opinia|Ocena niedostępna|Liczba opinii: {{number}}|Zaktualizowano|Autor opinii|Ocena|Treść opinii|{{number}} znaków; wymagane 20–2000 po normalizacji.|Wybierz ocenę 1–5 i napisz 20–2000 znaków.|Wyślij opinię|Wyślij zmianę|Wycofaj opinię|Wycofać opublikowaną opinię i anulować oczekujące zmiany?|Nowe opinie i zmiany wymagają zatwierdzenia. Zatwierdzona wersja pozostaje widoczna podczas sprawdzania.|Zaloguj się, aby kontynuować.|Zaloguj się|Zweryfikuj e-mail przed wysłaniem.|Konto|Twoje konto nie może teraz wysyłać opinii.|Właściciele i zarządcy nie mogą oceniać własnej firmy.|Ta firma lub opinia jest niedostępna.|Osiągnięto limit. Spróbuj później.|Nie udało się potwierdzić żądania. Ponów to samo żądanie.|Treść uległa zmianie. Odśwież przed kontynuowaniem.|Masz już otwarte zgłoszenie dotyczące tej opinii.|Żądanie zakończone.|Brak opinii do wyświetlenia.|Załaduj więcej|Oczekuje na zatwierdzenie|Opublikowana; zmiana oczekuje|Odrzucona. Możesz wysłać ponownie; zatwierdzona wersja pozostaje widoczna.|Opublikowana|Wycofana. Możesz wysłać ponownie.|Usunięta. Ponowne wysłanie jest niedostępne.|Ostatnio wysłany tekst|Zgłoś opinię|Zgłoszenia trafiają do moderacji i nie usuwają opinii automatycznie. Sama niska ocena nie jest nadużyciem.|Powód|Szczegóły (opcjonalnie, do 2000 znaków)|Wyślij zgłoszenie|Spam|Obraźliwa treść|Dane osobowe|Treść nie na temat|Konflikt interesów|Inny',
cs:'Recenze|Moje recenze|Vaše recenze|Hodnocení není dostupné|Počet recenzí: {{number}}|Aktualizováno|Autor recenze|Hodnocení|Text recenze|{{number}} znaků; po normalizaci je potřeba 20–2 000.|Vyberte hodnocení 1–5 a napište 20–2 000 znaků.|Odeslat recenzi|Odeslat změnu|Stáhnout recenzi|Stáhnout zveřejněnou recenzi a zrušit čekající změny?|Nové recenze a změny vyžadují schválení správcem. Schválená verze zůstává při kontrole viditelná.|Pro pokračování se přihlaste.|Přihlásit se|Před odesláním ověřte e-mail.|Účet|Váš účet nyní nemůže odesílat recenze.|Vlastníci a správci nesmějí hodnotit vlastní firmu.|Tato firma nebo recenze není dostupná.|Dosažen limit. Zkuste to později.|Požadavek nelze potvrdit. Opakujte stejný požadavek.|Obsah se změnil. Před pokračováním obnovte stránku.|Pro tuto recenzi už máte otevřené hlášení.|Požadavek dokončen.|Žádné recenze k zobrazení.|Načíst další|Čeká na schválení|Zveřejněno; změna čeká|Zamítnuto. Můžete odeslat znovu; schválená verze zůstává viditelná.|Zveřejněno|Staženo. Můžete odeslat znovu.|Odstraněno. Další odeslání není možné.|Poslední odeslaný text|Nahlásit recenzi|Hlášení kontroluje moderátor a recenzi automaticky neodstraní. Samotné nízké hodnocení není zneužití.|Důvod|Podrobnosti (volitelné, nejvýše 2 000 znaků)|Odeslat hlášení|Spam|Urážlivý obsah|Osobní údaje|Nesouvisející obsah|Střet zájmů|Jiné',
sk:'Recenzie|Moje recenzie|Vaša recenzia|Hodnotenie nie je dostupné|Počet recenzií: {{number}}|Aktualizované|Autor recenzie|Hodnotenie|Text recenzie|{{number}} znakov; po normalizácii treba 20–2 000.|Vyberte hodnotenie 1–5 a napíšte 20–2 000 znakov.|Odoslať recenziu|Odoslať zmenu|Stiahnuť recenziu|Stiahnuť zverejnenú recenziu a zrušiť čakajúce zmeny?|Nové recenzie a zmeny vyžadujú schválenie správcom. Schválená verzia zostáva počas kontroly viditeľná.|Ak chcete pokračovať, prihláste sa.|Prihlásiť sa|Pred odoslaním overte e-mail.|Účet|Váš účet teraz nemôže odosielať recenzie.|Vlastníci a správcovia nesmú hodnotiť vlastnú firmu.|Táto firma alebo recenzia nie je dostupná.|Dosiahnutý limit. Skúste neskôr.|Požiadavku nemožno potvrdiť. Zopakujte tú istú požiadavku.|Obsah sa zmenil. Pred pokračovaním obnovte stránku.|Pre túto recenziu už máte otvorené hlásenie.|Požiadavka dokončená.|Žiadne recenzie na zobrazenie.|Načítať ďalšie|Čaká na schválenie|Zverejnená; zmena čaká|Zamietnutá. Môžete odoslať znova; schválená verzia zostáva viditeľná.|Zverejnená|Stiahnutá. Môžete odoslať znova.|Odstránená. Ďalšie odoslanie nie je možné.|Posledný odoslaný text|Nahlásiť recenziu|Hlásenia preverí moderátor a recenziu automaticky neodstránia. Samotné nízke hodnotenie nie je zneužitie.|Dôvod|Podrobnosti (voliteľné, najviac 2 000 znakov)|Odoslať hlásenie|Spam|Urážlivý obsah|Osobné údaje|Nesúvisiaci obsah|Konflikt záujmov|Iné',
hu:'Értékelések|Értékeléseim|Az értékelésed|A pontszám nem érhető el|Értékelések száma: {{number}}|Frissítve|Értékelő|Pontszám|Értékelés szövege|{{number}} karakter; normalizálás után 20–2000 szükséges.|Válassz 1–5 pontot, és írj 20–2000 karaktert.|Értékelés küldése|Módosítás küldése|Értékelés visszavonása|Visszavonod a közzétett értékelést és törlöd a függő módosításokat?|Az új értékelések és módosítások jóváhagyást igényelnek. A jóváhagyott változat az ellenőrzés alatt látható marad.|A folytatáshoz jelentkezz be.|Bejelentkezés|Küldés előtt erősítsd meg az e-mail-címed.|Fiók|A fiókod most nem küldhet értékelést.|Tulajdonosok és kezelők nem értékelhetik saját vállalkozásukat.|Ez a vállalkozás vagy értékelés nem érhető el.|Elérted a korlátot. Próbáld később.|A kérés nem igazolható. Ismételd meg ugyanazt a kérést.|A tartalom megváltozott. Frissíts a folytatás előtt.|Ehhez az értékeléshez már van nyitott bejelentésed.|Kérés teljesítve.|Nincs megjeleníthető értékelés.|Továbbiak betöltése|Jóváhagyásra vár|Közzétéve; módosítás függőben|Elutasítva. Újra beküldheted; a jóváhagyott változat látható marad.|Közzétéve|Visszavonva. Újra beküldheted.|Eltávolítva. Nem küldhető be újra.|Legutóbb beküldött szöveg|Értékelés jelentése|A bejelentéseket ellenőrzik, és nem törlik automatikusan az értékelést. Az alacsony pontszám önmagában nem visszaélés.|Indok|Részletek (nem kötelező, legfeljebb 2000 karakter)|Bejelentés küldése|Spam|Sértő tartalom|Személyes adatok|Nem kapcsolódó tartalom|Összeférhetetlenség|Egyéb',
ro:'Recenzii|Recenziile mele|Recenzia ta|Evaluare indisponibilă|Număr de recenzii: {{number}}|Actualizată|Autorul recenziei|Evaluare|Textul recenziei|{{number}} de caractere; sunt necesare 20–2.000 după normalizare.|Alege o notă de la 1 la 5 și scrie 20–2.000 de caractere.|Trimite recenzia|Trimite modificarea|Retrage recenzia|Retragi recenzia publicată și anulezi modificările în așteptare?|Recenziile noi și modificările necesită aprobarea unui administrator. Versiunea aprobată rămâne vizibilă în timpul verificării.|Autentifică-te pentru a continua.|Autentificare|Verifică adresa de e-mail înainte de trimitere.|Cont|Contul tău nu poate trimite recenzii acum.|Proprietarii și administratorii nu pot evalua propria afacere.|Această afacere sau recenzie nu este disponibilă.|Limita a fost atinsă. Încearcă mai târziu.|Cererea nu a putut fi confirmată. Reîncearcă aceeași cerere.|Conținutul s-a schimbat. Reîncarcă înainte de a continua.|Ai deja o sesizare deschisă pentru această recenzie.|Cerere finalizată.|Nu există recenzii de afișat.|Încarcă mai multe|În așteptarea aprobării|Publicată; modificare în așteptare|Respinsă. Poți trimite din nou; versiunea aprobată rămâne vizibilă.|Publicată|Retrasă. Poți trimite din nou.|Eliminată. Nu poate fi retrimisă.|Ultimul text trimis|Raportează recenzia|Sesizările sunt moderate și nu elimină automat recenziile. O notă mică nu este în sine un abuz.|Motiv|Detalii (opționale, maximum 2.000 de caractere)|Trimite sesizarea|Spam|Conținut abuziv|Informații personale|Conținut irelevant|Conflict de interese|Altul',
uk:'Відгуки|Мої відгуки|Ваш відгук|Оцінка недоступна|Кількість відгуків: {{number}}|Оновлено|Автор відгуку|Оцінка|Текст відгуку|{{number}} символів; після нормалізації потрібно 20–2 000.|Виберіть оцінку 1–5 і напишіть 20–2 000 символів.|Надіслати відгук|Надіслати зміни|Відкликати відгук|Відкликати опублікований відгук і скасувати зміни на розгляді?|Нові відгуки та зміни потребують схвалення адміністратора. Схвалена версія залишається видимою під час розгляду.|Увійдіть, щоб продовжити.|Увійти|Підтвердьте електронну пошту перед надсиланням.|Обліковий запис|Ваш обліковий запис зараз не може надсилати відгуки.|Власники й керівники не можуть оцінювати власний бізнес.|Цей бізнес або відгук недоступний.|Ліміт досягнуто. Спробуйте пізніше.|Не вдалося підтвердити запит. Повторіть той самий запит.|Вміст змінився. Оновіть перед продовженням.|Ви вже маєте відкриту скаргу на цей відгук.|Запит виконано.|Немає відгуків для показу.|Завантажити ще|Очікує схвалення|Опубліковано; зміни на розгляді|Відхилено. Можна надіслати знову; схвалена версія залишається видимою.|Опубліковано|Відкликано. Можна надіслати знову.|Видалено. Повторне надсилання недоступне.|Останній надісланий текст|Поскаржитися на відгук|Скарги розглядаються модераторами й не видаляють відгуки автоматично. Низька оцінка сама по собі не є порушенням.|Причина|Подробиці (необов’язково, до 2 000 символів)|Надіслати скаргу|Спам|Образливий вміст|Особиста інформація|Недоречний вміст|Конфлікт інтересів|Інше'
}
// Authored presentation copy. Count forms are selected using the numeric count, not a formatted string.
const presentationRows={
  "en": [
    "review",
    "reviews",
    "reviews",
    "reviews",
    "characters",
    "Minimum {{minimum}} characters"
  ],
  "es": [
    "reseña",
    "reseñas",
    "reseñas",
    "reseñas",
    "caracteres",
    "Mínimo {{minimum}} caracteres"
  ],
  "fr": [
    "avis",
    "avis",
    "avis",
    "avis",
    "caractères",
    "Minimum {{minimum}} caractères"
  ],
  "de": [
    "Bewertung",
    "Bewertungen",
    "Bewertungen",
    "Bewertungen",
    "Zeichen",
    "Mindestens {{minimum}} Zeichen"
  ],
  "it": [
    "recensione",
    "recensioni",
    "recensioni",
    "recensioni",
    "caratteri",
    "Minimo {{minimum}} caratteri"
  ],
  "pt": [
    "avaliação",
    "avaliações",
    "avaliações",
    "avaliações",
    "caracteres",
    "Mínimo de {{minimum}} caracteres"
  ],
  "nl": [
    "beoordeling",
    "beoordelingen",
    "beoordelingen",
    "beoordelingen",
    "tekens",
    "Minimaal {{minimum}} tekens"
  ],
  "sv": [
    "omdöme",
    "omdömen",
    "omdömen",
    "omdömen",
    "tecken",
    "Minst {{minimum}} tecken"
  ],
  "no": [
    "anmeldelse",
    "anmeldelser",
    "anmeldelser",
    "anmeldelser",
    "tegn",
    "Minst {{minimum}} tegn"
  ],
  "da": [
    "anmeldelse",
    "anmeldelser",
    "anmeldelser",
    "anmeldelser",
    "tegn",
    "Mindst {{minimum}} tegn"
  ],
  "fi": [
    "arvostelu",
    "arvostelua",
    "arvostelua",
    "arvostelua",
    "merkkiä",
    "Vähintään {{minimum}} merkkiä"
  ],
  "pl": [
    "opinia",
    "opinie",
    "opinii",
    "opinii",
    "znaków",
    "Minimum {{minimum}} znaków"
  ],
  "cs": [
    "recenze",
    "recenze",
    "recenzí",
    "recenze",
    "znaků",
    "Minimálně {{minimum}} znaků"
  ],
  "sk": [
    "recenzia",
    "recenzie",
    "recenzií",
    "recenzie",
    "znakov",
    "Minimálne {{minimum}} znakov"
  ],
  "hu": [
    "értékelés",
    "értékelés",
    "értékelés",
    "értékelés",
    "karakter",
    "Legalább {{minimum}} karakter"
  ],
  "ro": [
    "recenzie",
    "recenzii",
    "de recenzii",
    "de recenzii",
    "caractere",
    "Minimum {{minimum}} caractere"
  ],
  "uk": [
    "відгук",
    "відгуки",
    "відгуків",
    "відгуку",
    "символів",
    "Щонайменше {{minimum}} символів"
  ]
}
const editorKeys="writeTrigger|editTrigger|success_submit|success_edit|success_withdraw|success_report|withdrawPending|withdrawPublished|withdrawBoth".split("|")
const editorRows={
  "en": [
    "Write a review",
    "Edit your review",
    "Review submitted. Awaiting approval.",
    "Edit submitted. Awaiting approval; your published review remains visible.",
    "Review withdrawn. Any pending submission has been cancelled.",
    "Report sent to moderation. The review has not been removed.",
    "Cancel your pending review submission? It has not been published.",
    "Withdraw your published review and remove its rating?",
    "Withdraw your published review and cancel the pending edit?"
  ],
  "es": [
    "Escribir una reseña",
    "Editar tu reseña",
    "Reseña enviada. Pendiente de aprobación.",
    "Cambios enviados. Pendientes de aprobación; tu reseña publicada sigue visible.",
    "Reseña retirada. Se ha cancelado cualquier envío pendiente.",
    "Reporte enviado a moderación. La reseña no se ha eliminado.",
    "¿Cancelar tu reseña pendiente? No se ha publicado.",
    "¿Retirar tu reseña publicada y su valoración?",
    "¿Retirar tu reseña publicada y cancelar los cambios pendientes?"
  ],
  "fr": [
    "Écrire un avis",
    "Modifier votre avis",
    "Avis envoyé. En attente d’approbation.",
    "Modification envoyée. En attente d’approbation ; votre avis publié reste visible.",
    "Avis retiré. Tout envoi en attente a été annulé.",
    "Signalement envoyé à la modération. L’avis n’a pas été supprimé.",
    "Annuler votre avis en attente ? Il n’a pas été publié.",
    "Retirer votre avis publié et sa note ?",
    "Retirer votre avis publié et annuler la modification en attente ?"
  ],
  "de": [
    "Bewertung schreiben",
    "Deine Bewertung bearbeiten",
    "Bewertung eingereicht. Freigabe ausstehend.",
    "Änderung eingereicht. Freigabe ausstehend; deine veröffentlichte Bewertung bleibt sichtbar.",
    "Bewertung zurückgezogen. Ausstehende Einreichungen wurden storniert.",
    "Meldung zur Prüfung gesendet. Die Bewertung wurde nicht entfernt.",
    "Ausstehende Bewertung stornieren? Sie wurde noch nicht veröffentlicht.",
    "Deine veröffentlichte Bewertung und ihre Wertung zurückziehen?",
    "Veröffentlichte Bewertung zurückziehen und ausstehende Änderung stornieren?"
  ],
  "it": [
    "Scrivi una recensione",
    "Modifica la tua recensione",
    "Recensione inviata. In attesa di approvazione.",
    "Modifica inviata. In attesa di approvazione; la recensione pubblicata resta visibile.",
    "Recensione ritirata. Ogni invio in attesa è stato annullato.",
    "Segnalazione inviata alla moderazione. La recensione non è stata rimossa.",
    "Annullare la recensione in attesa? Non è stata pubblicata.",
    "Ritirare la recensione pubblicata e il suo voto?",
    "Ritirare la recensione pubblicata e annullare la modifica in attesa?"
  ],
  "pt": [
    "Escrever uma avaliação",
    "Editar a tua avaliação",
    "Avaliação enviada. A aguardar aprovação.",
    "Alteração enviada. A aguardar aprovação; a avaliação publicada continua visível.",
    "Avaliação retirada. Os envios pendentes foram cancelados.",
    "Denúncia enviada para moderação. A avaliação não foi removida.",
    "Cancelar a avaliação pendente? Ainda não foi publicada.",
    "Retirar a avaliação publicada e a respetiva classificação?",
    "Retirar a avaliação publicada e cancelar a alteração pendente?"
  ],
  "nl": [
    "Een beoordeling schrijven",
    "Je beoordeling bewerken",
    "Beoordeling ingediend. Wacht op goedkeuring.",
    "Wijziging ingediend. Wacht op goedkeuring; je gepubliceerde beoordeling blijft zichtbaar.",
    "Beoordeling ingetrokken. Openstaande inzendingen zijn geannuleerd.",
    "Melding naar moderatie verzonden. De beoordeling is niet verwijderd.",
    "Je openstaande beoordeling annuleren? Deze is niet gepubliceerd.",
    "Je gepubliceerde beoordeling en score intrekken?",
    "Je gepubliceerde beoordeling intrekken en de openstaande wijziging annuleren?"
  ],
  "sv": [
    "Skriv ett omdöme",
    "Redigera ditt omdöme",
    "Omdömet har skickats. Väntar på godkännande.",
    "Ändringen har skickats. Väntar på godkännande; ditt publicerade omdöme är kvar.",
    "Omdömet har dragits tillbaka. Väntande inskick har avbrutits.",
    "Anmälan har skickats till moderering. Omdömet har inte tagits bort.",
    "Avbryta ditt väntande omdöme? Det har inte publicerats.",
    "Dra tillbaka ditt publicerade omdöme och betyg?",
    "Dra tillbaka ditt publicerade omdöme och avbryta den väntande ändringen?"
  ],
  "no": [
    "Skriv en anmeldelse",
    "Rediger anmeldelsen din",
    "Anmeldelsen er sendt. Venter på godkjenning.",
    "Endringen er sendt. Venter på godkjenning; den publiserte anmeldelsen er fortsatt synlig.",
    "Anmeldelsen er trukket tilbake. Ventende innsendinger er avbrutt.",
    "Rapporten er sendt til moderering. Anmeldelsen er ikke fjernet.",
    "Avbryte den ventende anmeldelsen? Den er ikke publisert.",
    "Trekke tilbake den publiserte anmeldelsen og vurderingen?",
    "Trekke tilbake den publiserte anmeldelsen og avbryte den ventende endringen?"
  ],
  "da": [
    "Skriv en anmeldelse",
    "Rediger din anmeldelse",
    "Anmeldelsen er sendt. Afventer godkendelse.",
    "Ændringen er sendt. Afventer godkendelse; din offentliggjorte anmeldelse forbliver synlig.",
    "Anmeldelsen er trukket tilbage. Afventende indsendelser er annulleret.",
    "Rapporten er sendt til moderation. Anmeldelsen er ikke fjernet.",
    "Annullere din afventende anmeldelse? Den er ikke offentliggjort.",
    "Trække din offentliggjorte anmeldelse og bedømmelse tilbage?",
    "Trække din offentliggjorte anmeldelse tilbage og annullere den afventende ændring?"
  ],
  "fi": [
    "Kirjoita arvostelu",
    "Muokkaa arvosteluasi",
    "Arvostelu lähetetty. Odottaa hyväksyntää.",
    "Muutos lähetetty. Odottaa hyväksyntää; julkaistu arvostelusi pysyy näkyvissä.",
    "Arvostelu peruttu. Odottavat lähetykset on peruttu.",
    "Ilmoitus lähetetty käsittelyyn. Arvostelua ei ole poistettu.",
    "Perutaanko odottava arvostelusi? Sitä ei ole julkaistu.",
    "Perutaanko julkaistu arvostelusi ja sen arvosana?",
    "Perutaanko julkaistu arvostelusi ja odottava muutos?"
  ],
  "pl": [
    "Napisz opinię",
    "Edytuj swoją opinię",
    "Opinia wysłana. Oczekuje na zatwierdzenie.",
    "Zmiana wysłana. Oczekuje na zatwierdzenie; opublikowana opinia pozostaje widoczna.",
    "Opinia wycofana. Anulowano oczekujące zgłoszenia.",
    "Zgłoszenie wysłane do moderacji. Opinia nie została usunięta.",
    "Anulować oczekującą opinię? Nie została opublikowana.",
    "Wycofać opublikowaną opinię i jej ocenę?",
    "Wycofać opublikowaną opinię i anulować oczekującą zmianę?"
  ],
  "cs": [
    "Napsat recenzi",
    "Upravit svou recenzi",
    "Recenze odeslána. Čeká na schválení.",
    "Úprava odeslána. Čeká na schválení; zveřejněná recenze zůstává viditelná.",
    "Recenze stažena. Čekající podání byla zrušena.",
    "Hlášení odesláno moderátorům. Recenze nebyla odstraněna.",
    "Zrušit čekající recenzi? Nebyla zveřejněna.",
    "Stáhnout zveřejněnou recenzi a její hodnocení?",
    "Stáhnout zveřejněnou recenzi a zrušit čekající úpravu?"
  ],
  "sk": [
    "Napísať recenziu",
    "Upraviť svoju recenziu",
    "Recenzia odoslaná. Čaká na schválenie.",
    "Úprava odoslaná. Čaká na schválenie; zverejnená recenzia zostáva viditeľná.",
    "Recenzia stiahnutá. Čakajúce podania boli zrušené.",
    "Hlásenie odoslané moderátorom. Recenzia nebola odstránená.",
    "Zrušiť čakajúcu recenziu? Nebola zverejnená.",
    "Stiahnuť zverejnenú recenziu a jej hodnotenie?",
    "Stiahnuť zverejnenú recenziu a zrušiť čakajúcu úpravu?"
  ],
  "hu": [
    "Értékelés írása",
    "Értékelésed szerkesztése",
    "Értékelés elküldve. Jóváhagyásra vár.",
    "Módosítás elküldve. Jóváhagyásra vár; közzétett értékelésed látható marad.",
    "Értékelés visszavonva. A függő beküldések törölve.",
    "Bejelentés elküldve moderálásra. Az értékelés nem lett eltávolítva.",
    "Visszavonod a függő értékelésed? Még nem tették közzé.",
    "Visszavonod a közzétett értékelésed és pontszámod?",
    "Visszavonod a közzétett értékelésed és a függő módosítást?"
  ],
  "ro": [
    "Scrie o recenzie",
    "Editează recenzia ta",
    "Recenzie trimisă. Așteaptă aprobarea.",
    "Modificare trimisă. Așteaptă aprobarea; recenzia publicată rămâne vizibilă.",
    "Recenzie retrasă. Trimiterile în așteptare au fost anulate.",
    "Raport trimis la moderare. Recenzia nu a fost eliminată.",
    "Anulezi recenzia în așteptare? Nu a fost publicată.",
    "Retragi recenzia publicată și nota ei?",
    "Retragi recenzia publicată și anulezi modificarea în așteptare?"
  ],
  "uk": [
    "Написати відгук",
    "Редагувати свій відгук",
    "Відгук надіслано. Очікує схвалення.",
    "Зміни надіслано. Очікують схвалення; опублікований відгук залишається видимим.",
    "Відгук відкликано. Подання, що очікували розгляду, скасовано.",
    "Скаргу надіслано модераторам. Відгук не видалено.",
    "Скасувати відгук, що очікує розгляду? Його не опубліковано.",
    "Відкликати опублікований відгук і його оцінку?",
    "Відкликати опублікований відгук і скасувати зміни, що очікують розгляду?"
  ]
}
const rejectionCopy={"en": ["This submission was rejected for:", "Revise your review before submitting it again."], "es": ["Este envío se rechazó por:", "Revisa tu reseña antes de enviarla de nuevo."], "fr": ["Cet envoi a été rejeté pour :", "Modifiez votre avis avant de le renvoyer."], "de": ["Diese Einreichung wurde abgelehnt wegen:", "Überarbeite deine Bewertung vor dem erneuten Einreichen."], "it": ["Questo invio è stato rifiutato per:", "Modifica la recensione prima di inviarla di nuovo."], "pt": ["Este envio foi rejeitado por:", "Revê a avaliação antes de a enviar novamente."], "nl": ["Deze inzending is afgewezen wegens:", "Pas je beoordeling aan voordat je deze opnieuw indient."], "sv": ["Inskicket avvisades på grund av:", "Ändra ditt omdöme innan du skickar det igen."], "no": ["Innsendingen ble avvist på grunn av:", "Endre anmeldelsen før du sender den inn igjen."], "da": ["Indsendelsen blev afvist på grund af:", "Ret din anmeldelse, før du sender den igen."], "fi": ["Lähetys hylättiin syystä:", "Muokkaa arvosteluasi ennen uutta lähetystä."], "pl": ["Zgłoszenie odrzucono z powodu:", "Popraw opinię przed ponownym przesłaniem."], "cs": ["Podání bylo zamítnuto z důvodu:", "Před opětovným odesláním recenzi upravte."], "sk": ["Podanie bolo zamietnuté z dôvodu:", "Pred opätovným odoslaním recenziu upravte."], "hu": ["A beküldés elutasításának oka:", "Módosítsd az értékelésed, mielőtt újra beküldöd."], "ro": ["Trimiterea a fost respinsă pentru:", "Revizuiește recenzia înainte de a o trimite din nou."], "uk": ["Подання відхилено через:", "Відредагуйте відгук, перш ніж надсилати його знову."]}
const displayNameCopy={"sk":["Verejné zobrazované meno", "Toto meno bude po schválení verejné pri vašej recenzii. Vyberte meno na zdieľanie bez e-mailovej adresy. Recenziu súkromne prepájame s účtom na moderovanie. Meno ani overený e-mail nedokazujú nákup alebo službu.", "Zadajte verejné meno s 1–80 znakmi bez riadiacich znakov."],
  "en": [
    "Public display name",
    "This name will be public with your review after approval. Choose a name you want to share; do not include your email. We keep the review linked privately to your account for moderation. A display name or verified email does not prove a purchase or service.",
    "Enter a public display name of 1–80 characters without control characters."
  ],
  "es": [
    "Nombre público",
    "Este nombre será público junto a tu reseña tras su aprobación. Elige un nombre que quieras compartir; no incluyas tu correo. Vinculamos la reseña a tu cuenta de forma privada para moderarla. Un nombre o correo verificado no demuestra una compra ni un servicio.",
    "Introduce un nombre público de 1 a 80 caracteres sin caracteres de control."
  ],
  "fr": [
    "Nom public",
    "Ce nom sera public avec votre avis après approbation. Choisissez un nom à partager, sans votre adresse e-mail. L’avis reste lié en privé à votre compte pour la modération. Un nom ou un e-mail vérifié ne prouve ni achat ni prestation.",
    "Saisissez un nom public de 1 à 80 caractères sans caractères de contrôle."
  ],
  "de": [
    "Öffentlicher Anzeigename",
    "Dieser Name wird nach Freigabe mit Ihrer Bewertung veröffentlicht. Wählen Sie einen Namen ohne E-Mail-Adresse. Für die Moderation bleibt die Bewertung intern mit Ihrem Konto verknüpft. Ein Name oder eine bestätigte E-Mail belegt keinen Kauf und keine Leistung.",
    "Geben Sie einen öffentlichen Namen mit 1–80 Zeichen ohne Steuerzeichen ein."
  ],
  "it": [
    "Nome pubblico",
    "Questo nome sarà pubblico con la recensione dopo l’approvazione. Scegli un nome da condividere, senza la tua email. La recensione resta collegata privatamente al tuo account per la moderazione. Un nome o un’email verificata non prova un acquisto o un servizio.",
    "Inserisci un nome pubblico di 1–80 caratteri senza caratteri di controllo."
  ],
  "pt": [
    "Nome público",
    "Este nome será público com a avaliação após aprovação. Escolha um nome para partilhar, sem o seu email. A avaliação fica ligada à sua conta de forma privada para moderação. Um nome ou email verificado não comprova uma compra ou serviço.",
    "Introduza um nome público de 1–80 caracteres sem caracteres de controlo."
  ],
  "nl": [
    "Openbare weergavenaam",
    "Deze naam wordt na goedkeuring bij je review gepubliceerd. Kies een naam om te delen, zonder je e-mailadres. Voor moderatie blijft de review privé gekoppeld aan je account. Een naam of geverifieerd e-mailadres bewijst geen aankoop of dienst.",
    "Voer een openbare naam van 1–80 tekens zonder besturingstekens in."
  ],
  "sv": [
    "Offentligt visningsnamn",
    "Namnet visas offentligt med ditt omdöme efter godkännande. Välj ett namn att dela, utan din e-postadress. Omdömet kopplas privat till ditt konto för moderering. Ett namn eller en verifierad e-postadress bevisar inte ett köp eller en tjänst.",
    "Ange ett offentligt namn med 1–80 tecken utan kontrolltecken."
  ],
  "no": [
    "Offentlig visningsnavn",
    "Navnet blir offentlig sammen med omtalen etter godkjenning. Velg et navn å dele, uten e-postadressen din. Omtalen knyttes privat til kontoen din for moderering. Et navn eller en bekreftet e-postadresse beviser ikke et kjøp eller en tjeneste.",
    "Skriv et offentlig navn med 1–80 tegn uten kontrolltegn."
  ],
  "da": [
    "Offentligt visningsnavn",
    "Navnet vises offentligt med din anmeldelse efter godkendelse. Vælg et navn at dele uden din e-mailadresse. Anmeldelsen knyttes privat til din konto til moderation. Et navn eller en bekræftet e-mail beviser ikke et køb eller en ydelse.",
    "Indtast et offentligt navn med 1–80 tegn uden kontroltegn."
  ],
  "fi": [
    "Julkinen näyttönimi",
    "Nimi julkaistaan arvostelusi yhteydessä hyväksynnän jälkeen. Valitse jaettava nimi, älä sähköpostiosoitetta. Arvostelu yhdistetään yksityisesti tiliisi moderointia varten. Nimi tai vahvistettu sähköposti ei todista ostoa tai palvelua.",
    "Anna 1–80 merkin julkinen nimi ilman ohjausmerkkejä."
  ],
  "pl": [
    "Publiczna nazwa",
    "Ta nazwa będzie publiczna wraz z opinią po zatwierdzeniu. Wybierz nazwę do udostępnienia, bez adresu e-mail. Opinia pozostaje prywatnie powiązana z kontem na potrzeby moderacji. Nazwa ani zweryfikowany e-mail nie dowodzą zakupu lub usługi.",
    "Wpisz publiczną nazwę o długości 1–80 znaków bez znaków sterujących."
  ],
  "ro": [
    "Nume public",
    "Acest nume va fi public alături de recenzie după aprobare. Alege un nume de afișat, fără adresa de e-mail. Recenzia rămâne legată privat de cont pentru moderare. Un nume sau un e-mail verificat nu dovedește o achiziție sau un serviciu.",
    "Introdu un nume public de 1–80 de caractere fără caractere de control."
  ],
  "hu": [
    "Nyilvános megjelenítési név",
    "Ez a név jóváhagyás után nyilvánosan megjelenik az értékeléssel. Válassz megosztható nevet, e-mail-cím nélkül. Az értékelést moderálás céljából privát módon a fiókodhoz kapcsoljuk. A név vagy igazolt e-mail nem bizonyít vásárlást vagy szolgáltatást.",
    "Adj meg egy 1–80 karakteres nyilvános nevet vezérlőkarakterek nélkül."
  ],
  "cs": [
    "Veřejné zobrazované jméno",
    "Toto jméno bude po schválení veřejné u vaší recenze. Vyberte jméno ke sdílení bez e-mailové adresy. Recenze zůstává soukromě spojena s účtem pro moderování. Jméno ani ověřený e-mail nedokazují nákup nebo službu.",
    "Zadejte veřejné jméno o délce 1–80 znaků bez řídicích znaků."
  ],
  "uk": [
    "Публічне ім’я",
    "Після схвалення це ім’я буде публічним разом із відгуком. Виберіть ім’я для показу, без електронної адреси. Для модерації відгук приватно пов’язаний із вашим обліковим записом. Ім’я чи підтверджена пошта не доводять купівлю або отримання послуги.",
    "Введіть публічне ім’я з 1–80 символів без керівних символів."
  ],
  "ru": [
    "Публичное имя",
    "После одобрения это имя будет публичным вместе с отзывом. Выберите имя для показа, без электронной почты. Для модерации отзыв связан с вашим аккаунтом приватно. Имя или подтверждённая почта не доказывают покупку или получение услуги.",
    "Введите публичное имя из 1–80 символов без управляющих символов."
  ]
}
export const customerReviewTranslations=Object.fromEntries(Object.entries(rows).map(([code,row])=>{
  const values=row.split('|')
  if(values.length!==keys.length)throw new Error(`Review translation key count: ${code} ${values.length}/${keys.length}`)
  const [one,few,many,other,characters,minimum]=presentationRows[code]
  const result=Object.fromEntries(keys.map((key,index)=>[key,values[index]]))
  const [displayName,displayNameNotice,nameValidation]=displayNameCopy[code]
  Object.assign(result,{displayName,displayNameNotice,nameValidation,validation:result.validation+' '+nameValidation})
  Object.assign(result,{counter:`{{number}} / {{maximum}} ${characters}`,minimum,count:`{{count, number}} ${other}`})
  for(const [category,word] of Object.entries({one,two:few,few,many,other}))result[`count_${category}`]=`{{count, number}} ${word}`
  editorKeys.forEach((key,index)=>{result[key]=editorRows[code][index]})
  for(const reason of ['spam','abusive_content','personal_information','irrelevant_content','conflict_of_interest'])result[`rejection_${reason}`]=`${rejectionCopy[code][0]} ${result[reason]}. ${rejectionCopy[code][1]}`
  return [code,result]
}))

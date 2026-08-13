const english = {
  admin: { navigation: { deletions: 'Account deletions' }, deletions: {
    eyebrow: 'Account operations', title: 'Account deletion requests', description: 'Review trusted deletion workflow status without exposing profile data.',
    history: 'Include completed and cancelled', loading: 'Loading deletion requests…', empty: 'There are no deletion requests in this view.', operationalOverflow: 'More active deletion requests exist than this bounded view can show. Review the backend queue before assuming it is complete.', historyOverflow: 'Additional completed or cancelled history is not shown.', detail: 'Deletion request detail',
    identifier: 'User identifier', status: 'Status', requestedAt: 'Requested', versionLabel: 'Request version', version: 'Version {{version}}', checkpoint: 'Last completed checkpoint', failure: 'Retry reason',
    finalize: 'Finalize account deletion', retry: 'Retry finalization', inProgress: 'Finalization is in progress. Refresh later for authoritative status.', resumeAvailable: 'The previous finalization lease expired. Review the current checkpoint before retrying.', processing: 'Processing…',
    confirmation: 'This destructive operation may remove the user profile, profile media and Firebase Authentication, tombstone retained conversations, and remove manager relationships.',
    historyPreserved: 'It does not delete businesses or retained conversation history.', cleanup: 'Media cleanup: {{deleted}} deleted, {{failed}} failed, {{alreadyMissing}} already absent.',
    state: { requested: 'Requested', finalizing: 'Finalizing', failed_retryable: 'Retry required', completed: 'Completed', cancelled: 'Cancelled' },
    checkpoints: { ownership_verified: 'Ownership verified', manager_relationships_cleaned: 'Manager relationships cleaned', conversations_tombstoned: 'Conversations tombstoned', profile_media_cleaned: 'Profile media cleaned', user_evidence_minimized: 'User evidence minimized', firebase_auth_removed: 'Authentication removed', completed: 'Completed' },
    codes: { ownership_blocked: 'Owned businesses must be resolved first.', ownership_integrity_conflict: 'Ownership records require review.', manager_relationship_integrity_conflict: 'Manager relationships require review.', conversation_integrity_conflict: 'Conversation relationships require review.', profile_media_cleanup_failed: 'Profile media cleanup must be retried.', consent_evidence_invalid: 'Consent evidence could not be validated.', user_evidence_minimization_failed: 'User evidence minimization must be retried.', firebase_auth_deletion_failed: 'Authentication removal must be retried.', workflow_state_conflict: 'The workflow state changed.', internal_retryable: 'A trusted backend step must be retried.', generic: 'The request requires review.' },
    notice: { completed: 'Account deletion completed.', updated: 'Authoritative request status was refreshed.', 'owned-businesses': 'Account deletion is blocked while the user owns a business.', 'ownership-integrity-conflict': 'Ownership records are inconsistent and require review.', 'profile-integrity-conflict': 'The account profile and workflow state require review.', stale: 'The request changed. Review the refreshed state before trying again.', lease: 'Another finalization is in progress. Refresh later.', permission: 'Administrator access is required.', generic: 'The operation could not be completed safely.', blocker: 'Finalization is blocked.' },
  } },
}

const spanish = {
  admin: { navigation: { deletions: 'Eliminaciones de cuentas' }, deletions: {
    ...english.admin.deletions,
    eyebrow: 'Operaciones de cuenta', title: 'Solicitudes de eliminación de cuenta', description: 'Revisa el estado del proceso sin mostrar datos del perfil.',
    history: 'Incluir completadas y canceladas', loading: 'Cargando solicitudes…', empty: 'No hay solicitudes en esta vista.', operationalOverflow: 'Existen más solicitudes activas de las que muestra esta vista limitada. Revisa la cola del backend antes de considerarla completa.', historyOverflow: 'No se muestra todo el historial completado o cancelado.', detail: 'Detalle de la solicitud',
    identifier: 'Identificador de usuario', status: 'Estado', requestedAt: 'Solicitada', versionLabel: 'Versión de solicitud', version: 'Versión {{version}}', checkpoint: 'Último paso completado', failure: 'Motivo del reintento',
    finalize: 'Finalizar eliminación de cuenta', retry: 'Reintentar finalización', inProgress: 'La finalización está en curso. Actualiza más tarde.', resumeAvailable: 'La ejecución anterior expiró. Revisa el último paso antes de reintentar.', processing: 'Procesando…',
    confirmation: 'Esta operación destructiva puede eliminar el perfil, sus imágenes y Firebase Authentication, conservar conversaciones como historial y retirar relaciones de gestión.', historyPreserved: 'No elimina negocios ni el historial de conversaciones conservado.',
    state: { requested: 'Solicitada', finalizing: 'Finalizando', failed_retryable: 'Reintento necesario', completed: 'Completada', cancelled: 'Cancelada' },
    notice: { ...english.admin.deletions.notice, completed: 'Eliminación de cuenta completada.', updated: 'Se actualizó el estado autoritativo.', 'owned-businesses': 'La eliminación está bloqueada mientras la persona sea propietaria de un negocio.', stale: 'La solicitud cambió. Revisa el estado actualizado antes de reintentar.', permission: 'Se requiere acceso de administrador.', generic: 'La operación no pudo completarse de forma segura.' },
  } },
}

const localized = {
  cs: ['Žádosti o odstranění účtu', 'Dokončit odstranění účtu', 'Opakovat dokončení', 'Požadováno', 'Dokončuje se', 'Je nutné opakování', 'Dokončeno', 'Zrušeno'],
  da: ['Anmodninger om kontosletning', 'Gennemfør kontosletning', 'Prøv færdiggørelse igen', 'Anmodet', 'Færdiggør', 'Nyt forsøg kræves', 'Gennemført', 'Annulleret'],
  de: ['Anträge auf Kontolöschung', 'Kontolöschung abschließen', 'Abschluss wiederholen', 'Beantragt', 'Wird abgeschlossen', 'Wiederholung erforderlich', 'Abgeschlossen', 'Abgebrochen'],
  fi: ['Tilin poistopyynnöt', 'Viimeistele tilin poisto', 'Yritä viimeistelyä uudelleen', 'Pyydetty', 'Viimeistellään', 'Uudelleenyritys tarvitaan', 'Valmis', 'Peruutettu'],
  fr: ['Demandes de suppression de compte', 'Finaliser la suppression du compte', 'Réessayer la finalisation', 'Demandée', 'Finalisation', 'Nouvel essai requis', 'Terminée', 'Annulée'],
  hu: ['Fióktörlési kérelmek', 'Fióktörlés véglegesítése', 'Véglegesítés újrapróbálása', 'Kérelmezve', 'Véglegesítés alatt', 'Újrapróbálás szükséges', 'Befejezve', 'Visszavonva'],
  it: ['Richieste di eliminazione account', 'Completa eliminazione account', 'Riprova finalizzazione', 'Richiesta', 'Finalizzazione', 'Nuovo tentativo richiesto', 'Completata', 'Annullata'],
  nl: ['Verzoeken om accountverwijdering', 'Accountverwijdering voltooien', 'Voltooiing opnieuw proberen', 'Aangevraagd', 'Wordt voltooid', 'Opnieuw proberen vereist', 'Voltooid', 'Geannuleerd'],
  no: ['Forespørsler om kontosletting', 'Fullfør kontosletting', 'Prøv fullføring på nytt', 'Forespurt', 'Fullfører', 'Nytt forsøk kreves', 'Fullført', 'Kansellert'],
  pl: ['Wnioski o usunięcie konta', 'Sfinalizuj usunięcie konta', 'Ponów finalizację', 'Zgłoszono', 'Finalizowanie', 'Wymagane ponowienie', 'Zakończono', 'Anulowano'],
  pt: ['Pedidos de eliminação de conta', 'Finalizar eliminação da conta', 'Tentar finalização novamente', 'Pedido', 'A finalizar', 'Nova tentativa necessária', 'Concluído', 'Cancelado'],
  ro: ['Solicitări de ștergere a contului', 'Finalizează ștergerea contului', 'Reîncearcă finalizarea', 'Solicitată', 'În curs de finalizare', 'Este necesară reîncercarea', 'Finalizată', 'Anulată'],
  sk: ['Žiadosti o odstránenie účtu', 'Dokončiť odstránenie účtu', 'Zopakovať dokončenie', 'Požiadané', 'Dokončuje sa', 'Vyžaduje sa opakovanie', 'Dokončené', 'Zrušené'],
  sv: ['Begäranden om kontoborttagning', 'Slutför kontoborttagning', 'Försök slutföra igen', 'Begärd', 'Slutförs', 'Nytt försök krävs', 'Slutförd', 'Avbruten'],
  uk: ['Запити на видалення облікового запису', 'Завершити видалення облікового запису', 'Повторити завершення', 'Запитано', 'Завершується', 'Потрібна повторна спроба', 'Завершено', 'Скасовано'],
}

function localizedAdminDeletion([title, finalize, retry, requested, finalizing, failed, completed, cancelled]) {
  return { admin: { navigation: { deletions: title }, deletions: { ...english.admin.deletions, title, finalize, retry, state: { requested, finalizing, failed_retryable: failed, completed, cancelled } } } }
}

export const adminDeletionTranslations = Object.freeze({
  en: english,
  es: spanish,
  ...Object.fromEntries(Object.entries(localized).map(([code, values]) => [code, localizedAdminDeletion(values)])),
})

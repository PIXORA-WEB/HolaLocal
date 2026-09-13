// Private admin contract; no arbitrary collection paths or client-supplied cleanup switch.
export const RETENTION_KINDS = Object.freeze(['acknowledgment', 'business-report', 'conversation'])
export const RETENTION_PAGE_LIMIT = 20
export const RETENTION_EXECUTION_LIMIT = 5
export const RETENTION_ACTION_FIELDS = Object.freeze({
  list: ['action', 'kind', 'cursor', 'view'],
  assess: ['action', 'kind', 'id', 'expectedRevision', 'decision', 'reason', 'endingCondition', 'reviewAt'],
  resolve: ['action', 'kind', 'id', 'summary'],
  execute: ['action', 'kind', 'ids'],
  redact: ['action', 'kind', 'id', 'messageId', 'subjectUid', 'reason'],
})

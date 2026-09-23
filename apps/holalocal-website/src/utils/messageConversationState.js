export function createInboxViewState(userId = null) {
  return {
    error: null,
    items: [],
    snapshot: [],
    status: userId ? 'loading' : 'idle',
    userId,
  }
}

function matchesInboxOwner(state, action) {
  return state.userId === action.userId
}

// Retention is presentation continuity only: membership and identity must still
// agree with the new snapshot. Fresh snapshot fields always replace old fields.
function compatibleInboxRow(previous, next, userId) {
  if (!previous || !Array.isArray(next.participantIds) || !next.participantIds.includes(userId)) return false
  const participants = row => Array.isArray(row.participantIds) ? [...row.participantIds].sort() : null
  return JSON.stringify(participants(previous)) === JSON.stringify(participants(next))
    && ['customerId', 'businessOwnerId', 'businessId', 'status', 'participantTombstones']
      .every(field => JSON.stringify(previous[field]) === JSON.stringify(next[field]))
}

export function inboxViewReducer(state, action) {
  switch (action.type) {
    case 'loadStarted':
      return matchesInboxOwner(state, action)
        ? { ...state, error: null, items: [], status: 'loading' }
        : createInboxViewState(action.userId)
    case 'snapshotReceived': {
      if (!matchesInboxOwner(state, action)) return state
      const previous = new Map(state.items.map(item => [item.conversationId, item]))
      const items = action.items.flatMap(row => {
        const retained = previous.get(row.conversationId)
        return compatibleInboxRow(retained, row, action.userId)
          ? [{ ...row, business: retained.business }] : []
      })
      return { ...state, error: null, snapshot: action.items, items,
        status: action.items.length === 0 ? 'ready' : items.length ? 'enriching' : 'loading' }
    }
    case 'loadProgress': {
      if (!matchesInboxOwner(state, action)) return state
      const settled = new Set(action.settledIds)
      const ready = new Map(state.items.filter(item => !settled.has(item.conversationId))
        .map(item => [item.conversationId, item]))
      for (const item of action.items) ready.set(item.conversationId, item)
      const items = state.snapshot.flatMap(row => ready.has(row.conversationId)
        ? [{ ...row, business: ready.get(row.conversationId).business }] : [])
      return { ...state, error: null, items, status: items.length ? 'enriching' : 'loading' }
    }
    case 'loadSucceeded':
      if (!matchesInboxOwner(state, action)) return state
      return { ...state, error: null, items: action.items, status: 'ready' }
    case 'loadFailed':
      if (!matchesInboxOwner(state, action)) return state
      return { ...state, error: action.error, items: [], status: 'failed' }
    case 'itemRemoved':
      if (!matchesInboxOwner(state, action)) return state
      return {
        ...state,
        items: state.items.filter(({ conversationId }) => conversationId !== action.conversationId),
      }
    default:
      return state
  }
}

export function selectInboxView(state, userId) {
  return state.userId === userId ? state : createInboxViewState(userId)
}

function normalizedErrorCode(error) {
  const code = typeof error?.code === 'string' ? error.code.trim().toLowerCase() : ''
  const separator = code.indexOf('/')
  return separator === -1 ? code : code.slice(separator + 1)
}

function isExpectedUnavailableProjection(error) {
  return ['not-found', 'permission-denied'].includes(normalizedErrorCode(error))
}

export async function enrichConversationSummaries(conversations, loadBusinessContext, onProgress = () => {}) {
  // Settled index slots preserve order and identify failed retained rows that
  // must disappear immediately, even while unrelated enrichment is pending.
  const completed = new Map()
  const settled = await Promise.all(conversations.map(async (conversation, index) => {
    let result
    try {
      const business = await loadBusinessContext(conversation.conversationId)
      result = business
        ? { status: 'available', value: { ...conversation, business } }
        : { status: 'unavailable' }
    } catch (error) {
      result = isExpectedUnavailableProjection(error)
        ? { status: 'unavailable' } : { status: 'failed', error }
    }
    completed.set(index, result)
    const ordered = [...completed.entries()].sort(([a], [b]) => a - b)
    onProgress(
      ordered.filter(([, entry]) => entry.status === 'available').map(([, entry]) => entry.value),
      ordered.map(([slot]) => conversations[slot].conversationId),
    )
    return result
  }))

  const items = settled
    .filter(({ status }) => status === 'available')
    .map(({ value }) => value)
  const infrastructureFailures = settled.filter(({ status }) => status === 'failed')

  if (items.length === 0 && infrastructureFailures.length > 0) {
    throw infrastructureFailures[0].error
  }
  return items
}

export function messageSenderIdentity(senderId, currentUserId, ownLabel, otherLabel) {
  return senderId === currentUserId ? ownLabel : otherLabel
}

export function createConversationViewState(conversationId = null) {
  return {
    business: null,
    conversation: null,
    conversationId,
    draft: '',
    error: null,
    hiding: false,
    hideOperationId: null,
    loadStatus: conversationId ? 'loading' : 'idle',
    messages: [],
    pendingSend: null,
    sending: false,
    sendOperationId: null,
  }
}

function matchesConversation(state, action) {
  return state.conversationId === action.conversationId
}

export function conversationViewReducer(state, action) {
  switch (action.type) {
    case 'loadStarted':
      if (!matchesConversation(state, action)) {
        return createConversationViewState(action.conversationId)
      }
      return {
        ...state,
        business: null,
        conversation: null,
        error: null,
        loadStatus: 'loading',
        messages: [],
      }
    case 'metadataLoaded':
      if (!matchesConversation(state, action)) return state
      return {
        ...state,
        business: action.business,
        conversation: action.conversation,
        error: null,
        loadStatus: 'messages-loading',
        messages: [],
      }
    case 'messagesLoaded':
      if (!matchesConversation(state, action)) return state
      return {
        ...state,
        error: null,
        loadStatus: 'ready',
        messages: action.messages,
      }
    case 'loadFailed':
      if (!matchesConversation(state, action)) return state
      return {
        ...state,
        business: null,
        conversation: null,
        error: action.error,
        loadStatus: 'failed',
        messages: [],
      }
    case 'messagesFailed':
      if (!matchesConversation(state, action)) return state
      return {
        ...state,
        error: action.error,
        loadStatus: 'messages-failed',
        messages: [],
      }
    case 'businessUnavailable':
      if (!matchesConversation(state, action)) return state
      return {
        ...state,
        business: null,
        conversation: action.conversation,
        error: null,
        loadStatus: 'unavailable',
        messages: [],
      }
    case 'draftChanged':
      if (!matchesConversation(state, action)) return state
      return {
        ...state,
        draft: action.draft,
        error: state.error?.type === 'MESSAGE_INVALID' ? null : state.error,
      }
    case 'sendStarted':
      if (!matchesConversation(state, action)) return state
      return {
        ...state,
        error: null,
        pendingSend: action.pendingSend,
        sending: true,
        sendOperationId: action.operationId,
      }
    case 'sendSucceeded':
      if (
        !matchesConversation(state, action) ||
        state.sendOperationId !== action.operationId
      ) return state
      return {
        ...state,
        draft: '',
        error: null,
        pendingSend: null,
      }
    case 'sendFailed':
      if (
        !matchesConversation(state, action) ||
        state.sendOperationId !== action.operationId
      ) return state
      return {
        ...state,
        error: action.error,
      }
    case 'sendFinished':
      if (
        !matchesConversation(state, action) ||
        state.sendOperationId !== action.operationId
      ) return state
      return {
        ...state,
        sending: false,
        sendOperationId: null,
      }
    case 'hideStarted':
      if (!matchesConversation(state, action)) return state
      return {
        ...state,
        error: null,
        hiding: true,
        hideOperationId: action.operationId,
      }
    case 'hideFailed':
      if (
        !matchesConversation(state, action) ||
        state.hideOperationId !== action.operationId
      ) return state
      return {
        ...state,
        error: action.error,
      }
    case 'hideFinished':
      if (
        !matchesConversation(state, action) ||
        state.hideOperationId !== action.operationId
      ) return state
      return {
        ...state,
        hiding: false,
        hideOperationId: null,
      }
    case 'clearError':
      if (!matchesConversation(state, action)) return state
      return { ...state, error: null }
    default:
      return state
  }
}

export function selectConversationView(state, conversationId) {
  if (state.conversationId === conversationId) return state
  return createConversationViewState(conversationId)
}

export function pendingSendForDraft(state, normalizedText, createRequestId) {
  return state.pendingSend?.text === normalizedText
    ? state.pendingSend
    : { text: normalizedText, requestId: createRequestId() }
}

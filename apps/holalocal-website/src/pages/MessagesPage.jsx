import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  isConversationUnreadForUser,
  isParticipantDeletedConversation,
  normalizeMessageTranslation,
  selectMessageDisplayText,
  shouldShowTranslatedMessage,
} from '@holalocal/firebase-contract'
import AccessibleDialog from '../components/common/AccessibleDialog.jsx'
import { ImageAvatar } from '../components/common/PublicBusinessCard.jsx'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import RecoveryMessage from '../components/common/RecoveryMessage.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import {
  getConversationForUser,
  getParticipantBusinessContext,
  hideConversationForUser,
  markConversationReadForUser,
  createMessageRequestId,
  sendTextMessage,
  subscribeToConversationsForUser,
  subscribeToMessages,
} from '../services/conversationService.js'
import { conversationParticipantPresentation } from '../utils/conversationPresentation.js'
import { classifyFrontendError } from '../utils/frontendErrors.js'
import {
  conversationViewReducer,
  createInboxViewState,
  createConversationViewState,
  enrichConversationSummaries,
  inboxViewReducer,
  messageSenderIdentity,
  pendingSendForDraft,
  selectInboxView,
  selectConversationView,
} from '../utils/messageConversationState.js'

function formatMessageTime(timestamp) {
  const date = timestamp?.toDate?.()
  if (!date) return ''

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function MessagesPage() {
  const { t } = useTranslation()
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { user, userProfile } = useAuthentication()
  const messagesEndRef = useRef(null)
  const readMarkersRef = useRef(new Set())
  const activeSendOperationsRef = useRef(new Map())
  const activeHideOperationsRef = useRef(new Map())
  const operationSequenceRef = useRef(0)
  const [inboxState, dispatchInbox] = useReducer(
    inboxViewReducer,
    user.uid,
    createInboxViewState,
  )
  const [conversationState, dispatchConversation] = useReducer(
    conversationViewReducer,
    conversationId,
    createConversationViewState,
  )
  const [success, setSuccess] = useState('')
  const [inboxAttempt, setInboxAttempt] = useState(0)
  const [conversationAttempt, setConversationAttempt] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [originalMessageIds, setOriginalMessageIds] = useState(() => new Set())
  const activeInboxState = selectInboxView(inboxState, user.uid)
  const {
    error: inboxError,
    items: conversations,
    status: inboxStatus,
  } = activeInboxState
  const activeConversationState = selectConversationView(conversationState, conversationId)
  const {
    business,
    conversation,
    draft: messageText,
    error: conversationError,
    hiding,
    loadStatus: conversationLoadStatus,
    messages,
    sending,
  } = activeConversationState
  const error = conversationId ? conversationError : inboxError

  useEffect(() => {
    let active = true
    let requestId = 0
    dispatchInbox({ type: 'loadStarted', userId: user.uid })

    const unsubscribe = subscribeToConversationsForUser(
      user.uid,
      (items) => {
        const currentRequest = requestId + 1
        requestId = currentRequest
        enrichConversationSummaries(items, getParticipantBusinessContext)
          .then((summaries) => {
            if (active && currentRequest === requestId) {
              dispatchInbox({
                type: 'loadSucceeded',
                items: summaries,
                userId: user.uid,
              })
            }
          })
          .catch((loadError) => {
            if (active && currentRequest === requestId) {
              dispatchInbox({
                type: 'loadFailed',
                error: classifyFrontendError(loadError, {
                  fallbackType: 'MESSAGE_LOAD_FAILED',
                  fallbackTranslationKey: 'messages.errors.loadConversations',
                  operation: 'load-inbox',
                }),
                userId: user.uid,
              })
            }
          })
      },
      (loadError) => {
        if (active) {
          dispatchInbox({
            type: 'loadFailed',
            error: classifyFrontendError(loadError, {
              fallbackType: 'MESSAGE_LOAD_FAILED',
              fallbackTranslationKey: 'messages.errors.loadConversations',
              operation: 'load-inbox',
            }),
            userId: user.uid,
          })
        }
      },
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [inboxAttempt, t, user.uid])

  useEffect(() => {
    if (!conversationId) {
      dispatchConversation({ type: 'loadStarted', conversationId: null })
      return undefined
    }

    let active = true
    let unsubscribe = () => undefined
    dispatchConversation({ type: 'loadStarted', conversationId })

    Promise.all([
      getConversationForUser(conversationId, user.uid),
      getParticipantBusinessContext(conversationId),
    ])
      .then(([loadedConversation, loadedBusiness]) => {
        if (!active) return

        if (!loadedBusiness) {
          dispatchConversation({
            type: 'businessUnavailable',
            conversationId,
            conversation: loadedConversation,
          })
          return
        }

        dispatchConversation({
          type: 'metadataLoaded',
          business: loadedBusiness,
          conversation: loadedConversation,
          conversationId,
        })
        unsubscribe = subscribeToMessages(
          conversationId,
          (loadedMessages) => {
            if (active) {
              dispatchConversation({
                type: 'messagesLoaded',
                conversationId,
                messages: loadedMessages.filter(
                  (message) => message.moderationStatus === 'visible' && !message.deletedAt,
                ),
              })
            }
          },
          (loadError) => {
            if (active) {
              dispatchConversation({
                type: 'messagesFailed',
                conversationId,
                error: classifyFrontendError(loadError, {
                  fallbackType: 'MESSAGE_LOAD_FAILED',
                  fallbackTranslationKey: 'messages.errors.loadMessages',
                }),
              })
            }
          },
        )
      })
      .catch((loadError) => {
        if (active) {
          dispatchConversation({
            type: 'loadFailed',
            conversationId,
            error: classifyFrontendError(loadError, {
              fallbackType: 'MESSAGE_LOAD_FAILED',
              fallbackTranslationKey: 'messages.errors.openConversation',
            }),
          })
        }
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [conversationAttempt, conversationId, t, user.uid])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conversationId || !user.uid) return
    const currentConversation = conversations.find((item) => item.conversationId === conversationId) ?? conversation
    if (!isConversationUnreadForUser(currentConversation, user.uid)) return

    const marker = `${conversationId}:${currentConversation.lastMessage?.messageId ?? ''}:${currentConversation.lastMessageAt?.toMillis?.() ?? ''}`
    if (readMarkersRef.current.has(marker)) return
    readMarkersRef.current.add(marker)

    markConversationReadForUser(conversationId, user.uid).catch(() => {
      readMarkersRef.current.delete(marker)
    })
  }, [conversation, conversationId, conversations, user.uid])

  async function handleSend(event) {
    event.preventDefault()
    const normalizedText = messageText.trim()
    if (!conversationId || !normalizedText || isParticipantDeletedConversation(conversation)) return
    if (activeSendOperationsRef.current.has(conversationId)) return

    operationSequenceRef.current += 1
    const operationId = operationSequenceRef.current
    const pendingSend = pendingSendForDraft(
      activeConversationState,
      normalizedText,
      createMessageRequestId,
    )
    activeSendOperationsRef.current.set(conversationId, operationId)

    dispatchConversation({
      type: 'sendStarted',
      conversationId,
      operationId,
      pendingSend,
    })
    try {
      await sendTextMessage(conversationId, user.uid, normalizedText, pendingSend.requestId)
      dispatchConversation({ type: 'sendSucceeded', conversationId, operationId })
    } catch (sendError) {
      dispatchConversation({
        type: 'sendFailed',
        conversationId,
        operationId,
        error: classifyFrontendError(sendError, { fallbackType: 'MESSAGE_SEND_FAILED' }),
      })
    } finally {
      if (activeSendOperationsRef.current.get(conversationId) === operationId) {
        activeSendOperationsRef.current.delete(conversationId)
      }
      dispatchConversation({ type: 'sendFinished', conversationId, operationId })
    }
  }

  async function handleHideConversation() {
    if (!conversationId) return
    if (activeHideOperationsRef.current.has(conversationId)) return

    operationSequenceRef.current += 1
    const operationId = operationSequenceRef.current
    activeHideOperationsRef.current.set(conversationId, operationId)
    dispatchConversation({ type: 'hideStarted', conversationId, operationId })
    setSuccess('')
    try {
      await hideConversationForUser(conversationId, user.uid)
      dispatchInbox({
        type: 'itemRemoved',
        conversationId,
        userId: user.uid,
      })
      setSuccess(t('messages.removeSuccess'))
      setConfirmRemove(false)
      navigate('/messages', { replace: true })
    } catch (hideError) {
      dispatchConversation({
        type: 'hideFailed',
        conversationId,
        operationId,
        error: classifyFrontendError(hideError, {
          fallbackType: 'CONVERSATION_REMOVE_FAILED',
        }),
      })
    } finally {
      if (activeHideOperationsRef.current.get(conversationId) === operationId) {
        activeHideOperationsRef.current.delete(conversationId)
      }
      dispatchConversation({ type: 'hideFinished', conversationId, operationId })
    }
  }

  function toggleOriginalMessage(messageId) {
    setOriginalMessageIds((current) => {
      const next = new Set(current)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  const customerLanguage = userProfile?.preferredLocale ?? t('messages.preferredLanguageFallback')
  const businessLanguage = business?.primaryLanguage ?? business?.languages?.[0] ?? t('messages.businessLanguageFallback')
  const isBusinessParticipant = Boolean(conversation && conversation.customerId !== user.uid)
  const participantDeleted = isParticipantDeletedConversation(conversation)
  const participantPresentation = conversationParticipantPresentation(conversation, user.uid, {
    deletedUser: t('messages.deletedUser'),
  })
  const activeLanguage = isBusinessParticipant ? businessLanguage : customerLanguage
  const otherParticipantName = isBusinessParticipant
    ? participantPresentation.deleted ? participantPresentation.label : t('messages.customerFallback')
    : business?.name ?? t('messages.businessFallback')
  const errorAction = error?.recovery === 'edit'
    ? undefined
    : error?.recovery === 'back'
      ? conversationId
        ? () => navigate('/messages')
        : undefined
      : error?.recovery === 'sign-in'
        ? () => navigate('/login')
        : () => {
            if (conversationId) {
              dispatchConversation({ type: 'clearError', conversationId })
            }
            if (conversationId) {
              setConversationAttempt((attempt) => attempt + 1)
            } else {
              dispatchInbox({ type: 'loadStarted', userId: user.uid })
              setInboxAttempt((attempt) => attempt + 1)
            }
          }
  const errorActionLabel = error?.recovery === 'back'
    ? t('messages.back')
    : error?.recovery === 'sign-in'
      ? t('account.signIn')
      : undefined

  return (
    <div className={`messages-page${conversationId ? ' has-conversation' : ''}`}>
      <header className="messages-page__heading">
        <p className="marketing-eyebrow">{t('messages.eyebrow')}</p>
        <h1>{t('messages.title')}</h1>
        <p>{t('messages.description')}</p>
      </header>

      {error && (
        <div className="messages-page__error">
          <RecoveryMessage
            actionLabel={errorActionLabel}
            message={t(error.translationKey)}
            onRetry={errorAction}
          />
        </div>
      )}
      {success && <p className="form-message form-message--success messages-page__error" role="status">{success}</p>}

      <div className="messages-layout">
        <aside className="conversation-list" aria-label={t('messages.conversations')}>
          <header>
            <h2>{t('messages.conversations')}</h2>
            <span>{conversations.length}</span>
          </header>
          {inboxStatus === 'loading' ? (
            <LoadingScreen message={t('messages.loadingConversations')} />
          ) : inboxStatus === 'failed' ? (
            <div className="conversation-list__empty">
              <p>{t('messages.errors.loadConversations')}</p>
            </div>
          ) : conversations.length > 0 ? (
            <nav>
              {conversations.map((item) => (
                (() => {
                  const isUnread = isConversationUnreadForUser(item, user.uid)
                  const itemParticipant = conversationParticipantPresentation(item, user.uid, {
                    deletedUser: t('messages.deletedUser'),
                  })
                  const businessName = itemParticipant.deleted
                    ? itemParticipant.label
                    : item.business?.name || t('messages.localBusiness')
                  return (
                    <Link
                      aria-label={isUnread ? t('messages.unreadConversation', { name: businessName }) : undefined}
                      className={[
                        item.conversationId === conversationId ? 'is-active' : '',
                        isUnread ? 'is-unread' : '',
                      ].filter(Boolean).join(' ')}
                      key={item.conversationId}
                      to={`/messages/${item.conversationId}`}
                    >
                      <ImageAvatar
                        className="image-avatar--conversation"
                        name={businessName}
                        src={itemParticipant.deleted ? null : item.business?.logoUrl}
                      />
                      <span>
                        <strong>{businessName}</strong>
                        <small>{item.lastMessage?.preview || t('messages.noMessages')}</small>
                      </span>
                      <time>{formatMessageTime(item.lastMessageAt ?? item.createdAt)}</time>
                    </Link>
                  )
                })()
              ))}
            </nav>
          ) : (
            <div className="conversation-list__empty">
              <span aria-hidden="true">✦</span>
              <p>{t('messages.emptyConversations')}</p>
              <Link to="/">{t('messages.returnHome')}</Link>
            </div>
          )}
        </aside>

        <section className="conversation-view">
          {!conversationId ? (
            <div className="conversation-view__placeholder">
              <span aria-hidden="true">✦</span>
              <h2>{t('messages.privateMessages')}</h2>
              <p>{t('messages.selectConversation')}</p>
              <Link className="button button--primary" to="/">{t('messages.returnHome')}</Link>
            </div>
          ) : (
            conversationLoadStatus === 'unavailable' ||
            conversationLoadStatus === 'failed' ||
            conversationLoadStatus === 'messages-failed'
          ) ? (
            <div className="conversation-view__placeholder">
              <h2>{t('messages.unavailable')}</h2>
              <p>{t('messages.unavailableDescription')}</p>
              <button className="button button--secondary" onClick={() => navigate('/messages')} type="button">{t('messages.back')}</button>
            </div>
          ) : conversationLoadStatus !== 'ready' ? (
            <LoadingScreen message={t('messages.openingConversation')} />
          ) : conversation && business ? (
            <>
              <header className="conversation-view__header">
                <button className="conversation-view__back" aria-label={t('messages.back')} onClick={() => navigate('/messages')} type="button">←</button>
                <ImageAvatar
                  className="image-avatar--conversation-header"
                  name={participantPresentation.deleted ? participantPresentation.label : business.name}
                  src={participantPresentation.deleted ? null : business.logoUrl}
                />
                <div>
                  <h2>{participantPresentation.deleted ? participantPresentation.label : business.name}</h2>
                  <p>
                    {participantDeleted
                      ? t('messages.participantDeletedNotice')
                      : business.profileAvailable
                      ? t('messages.activeProfile')
                      : t('messages.profileUnavailable')}
                  </p>
                </div>
                <button
                  className="conversation-view__delete"
                  disabled={hiding}
                  onClick={() => setConfirmRemove(true)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                  {hiding ? t('messages.removing') : t('messages.remove')}
                </button>
              </header>

              <div className="conversation-translation-note">
                <span aria-hidden="true">🌐</span>
                <p>
                  {t('messages.translationNote', { language: activeLanguage })}
                </p>
              </div>

              <ol
                aria-atomic="false"
                aria-label={t('messages.messageHistory')}
                aria-live="polite"
                aria-relevant="additions"
                className="message-list"
                role="log"
              >
                {messages.length > 0 ? messages.map((message) => {
                  const isOwn = message.senderId === user.uid
                  const senderName = messageSenderIdentity(
                    message.senderId,
                    user.uid,
                    t('messages.you'),
                    otherParticipantName,
                  )
                  const translation = normalizeMessageTranslation(message.translation)
                  const canShowTranslation = shouldShowTranslatedMessage(message, user.uid)
                  const showOriginal = originalMessageIds.has(message.messageId)
                  const visibleText = selectMessageDisplayText(message, user.uid, showOriginal)
                  return (
                    <li className={isOwn ? 'message-bubble is-own' : 'message-bubble'} key={message.messageId}>
                      <span className="visually-hidden">{t('messages.sentBy', { name: senderName })}</span>
                      <p>{visibleText}</p>
                      {canShowTranslation && (
                        <div className="message-translation-controls">
                          <span>{t('messages.translation.completed')}</span>
                          <button
                            aria-label={showOriginal ? t('messages.translation.viewTranslation') : t('messages.translation.viewOriginal')}
                            onClick={() => toggleOriginalMessage(message.messageId)}
                            type="button"
                          >
                            {showOriginal ? t('messages.translation.viewTranslation') : t('messages.translation.viewOriginal')}
                          </button>
                        </div>
                      )}
                      {!isOwn && translation.status === 'processing' && (
                        <small className="message-translation-status">{t('messages.translation.processing')}</small>
                      )}
                      {!isOwn && translation.status === 'failed' && (
                        <small className="message-translation-status">{t('messages.translation.failed')}</small>
                      )}
                      <time>{formatMessageTime(message.createdAt)}</time>
                    </li>
                  )
                }) : (
                  <li className="message-list__empty">
                    <p>{t('messages.noMessages')}</p>
                    <span>{t('messages.startConversation')}</span>
                  </li>
                )}
                <li aria-hidden="true" className="message-list__end" ref={messagesEndRef} />
              </ol>

              {!business.profileAvailable && (
                <p className="form-message" role="status">{t('messages.profileUnavailableDescription')}</p>
              )}
              {business.canSendMessages && !participantDeleted ? (
              <form className="message-composer" onSubmit={handleSend}>
                <label className="visually-hidden" htmlFor="message-text">{t('messages.messageLabel')}</label>
                <textarea
                  id="message-text"
                  maxLength={4000}
                  onChange={(event) => {
                    dispatchConversation({
                      type: 'draftChanged',
                      conversationId,
                      draft: event.target.value,
                    })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                  placeholder={t('messages.placeholder')}
                  rows={2}
                  value={messageText}
                />
                <button className="button button--primary" disabled={sending || !messageText.trim()} type="submit">
                  {sending ? t('messages.sending') : t('messages.send')}
                </button>
              </form>
              ) : (
                <p className="form-message" role="status">
                  {participantDeleted ? t('messages.participantDeletedNotice') : t('messages.messagingClosed')}
                </p>
              )}
            </>
          ) : null}
        </section>
      </div>
      <AccessibleDialog
        ariaDescribedBy="remove-conversation-description"
        ariaLabelledBy="remove-conversation-title"
        className="profile-edit-dialog confirmation-dialog"
        closeDisabled={hiding}
        onClose={() => setConfirmRemove(false)}
        open={confirmRemove && conversationState.conversationId === conversationId}
      >
        <section className="profile-edit-dialog__panel">
          <header className="profile-edit-dialog__header">
            <h2 id="remove-conversation-title">{t('messages.removeTitle')}</h2>
            <button aria-label={t('common.close')} disabled={hiding} onClick={() => setConfirmRemove(false)} type="button">×</button>
          </header>
          <p id="remove-conversation-description">{t('messages.removeDescription')}</p>
          <div className="profile-edit-form__actions">
            <button className="button button--secondary" disabled={hiding} onClick={() => setConfirmRemove(false)} type="button">{t('common.cancel')}</button>
            <button className="button button--primary" disabled={hiding} onClick={() => void handleHideConversation()} type="button">{hiding ? t('messages.removing') : t('messages.remove')}</button>
          </div>
        </section>
      </AccessibleDialog>
    </div>
  )
}

export default MessagesPage

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AccessibleDialog from '../components/common/AccessibleDialog.jsx'
import { ImageAvatar } from '../components/common/PublicBusinessCard.jsx'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import RecoveryMessage from '../components/common/RecoveryMessage.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { getPublicBusinessById } from '../services/businessService.js'
import {
  getConversationForUser,
  getConversationsForUser,
  hideConversationForUser,
  sendTextMessage,
  subscribeToMessages,
} from '../services/conversationService.js'

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

async function loadConversationSummaries(userId) {
  const conversations = await getConversationsForUser(userId)
  const businesses = new Map()

  await Promise.all(conversations.map(async (conversation) => {
    if (!businesses.has(conversation.businessId)) {
      businesses.set(conversation.businessId, await getPublicBusinessById(conversation.businessId))
    }
  }))

  return conversations.map((conversation) => ({
    ...conversation,
    business: businesses.get(conversation.businessId),
  }))
}

function MessagesPage() {
  const { t } = useTranslation()
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { user, userProfile } = useAuthentication()
  const messagesEndRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [inboxLoading, setInboxLoading] = useState(true)
  const [conversation, setConversation] = useState(null)
  const [business, setBusiness] = useState(null)
  const [messages, setMessages] = useState([])
  const [failedConversationId, setFailedConversationId] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inboxAttempt, setInboxAttempt] = useState(0)
  const [conversationAttempt, setConversationAttempt] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    let active = true

    loadConversationSummaries(user.uid)
      .then((items) => {
        if (active) {
          setConversations(items)
          setError('')
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || t('messages.errors.loadConversations'))
      })
      .finally(() => {
        if (active) setInboxLoading(false)
      })

    return () => {
      active = false
    }
  }, [inboxAttempt, t, user.uid])

  useEffect(() => {
    if (!conversationId) return undefined

    let active = true
    let unsubscribe = () => undefined

    Promise.all([
      getConversationForUser(conversationId, user.uid),
    ])
      .then(async ([loadedConversation]) => {
        const loadedBusiness = await getPublicBusinessById(loadedConversation.businessId)
        if (!active) return

        setConversation(loadedConversation)
        setBusiness(loadedBusiness)
        setFailedConversationId(null)
        setError('')
        unsubscribe = subscribeToMessages(
          conversationId,
          (loadedMessages) => {
            if (active) setMessages(loadedMessages.filter(
              (message) => message.moderationStatus === 'visible' && !message.deletedAt,
            ))
          },
          (loadError) => {
            if (active) setError(loadError.message || t('messages.errors.loadMessages'))
          },
        )
      })
      .catch((loadError) => {
        if (active) {
          setConversation(null)
          setBusiness(null)
          setFailedConversationId(conversationId)
          setError(loadError.message || t('messages.errors.openConversation'))
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

  async function handleSend(event) {
    event.preventDefault()
    if (!conversationId || !messageText.trim()) return

    setSending(true)
    setError('')
    try {
      await sendTextMessage(conversationId, user.uid, messageText)
      setMessageText('')
      setConversations(await loadConversationSummaries(user.uid))
    } catch (sendError) {
      setError(sendError.message || t('messages.errors.send'))
    } finally {
      setSending(false)
    }
  }

  async function handleHideConversation() {
    if (!conversationId) return

    setHiding(true)
    setError('')
    setSuccess('')
    try {
      await hideConversationForUser(conversationId, user.uid)
      setConversations((items) => items.filter((item) => item.conversationId !== conversationId))
      setSuccess(t('messages.removeSuccess'))
      setConfirmRemove(false)
      navigate('/messages', { replace: true })
    } catch (hideError) {
      setError(hideError.message || t('messages.errors.remove'))
    } finally {
      setHiding(false)
    }
  }

  const customerLanguage = userProfile?.preferredLocale ?? t('messages.preferredLanguageFallback')
  const businessLanguage = business?.primaryLanguage ?? business?.languages?.[0] ?? t('messages.businessLanguageFallback')
  const isBusinessParticipant = conversation && business?.ownerId === user.uid
  const activeLanguage = isBusinessParticipant ? businessLanguage : customerLanguage

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
            message={error}
            onRetry={() => conversationId
              ? (() => {
                  setError('')
                  setConversationAttempt((attempt) => attempt + 1)
                })()
              : (() => {
                  setError('')
                  setInboxLoading(true)
                  setInboxAttempt((attempt) => attempt + 1)
                })()}
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
          {inboxLoading ? (
            <LoadingScreen message={t('messages.loadingConversations')} />
          ) : conversations.length > 0 ? (
            <nav>
              {conversations.map((item) => (
                <Link
                  className={item.conversationId === conversationId ? 'is-active' : ''}
                  key={item.conversationId}
                  to={`/messages/${item.conversationId}`}
                >
                  <ImageAvatar
                    className="image-avatar--conversation"
                    name={item.business?.name || t('messages.businessFallback')}
                    src={item.business?.logoUrl}
                  />
                  <span>
                    <strong>{item.business?.name || t('messages.localBusiness')}</strong>
                    <small>{item.lastMessage?.preview || t('messages.noMessages')}</small>
                  </span>
                </Link>
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
          ) : failedConversationId === conversationId ? (
            <div className="conversation-view__placeholder">
              <h2>{t('messages.unavailable')}</h2>
              <p>{t('messages.unavailableDescription')}</p>
              <button className="button button--secondary" onClick={() => navigate('/messages')} type="button">{t('messages.back')}</button>
            </div>
          ) : conversation?.conversationId !== conversationId || !business ? (
            <LoadingScreen message={t('messages.openingConversation')} />
          ) : conversation && business ? (
            <>
              <header className="conversation-view__header">
                <button className="conversation-view__back" aria-label={t('messages.back')} onClick={() => navigate('/messages')} type="button">←</button>
                <ImageAvatar
                  className="image-avatar--conversation-header"
                  name={business.name}
                  src={business.logoUrl}
                />
                <div>
                  <h2>{business.name}</h2>
                  <p>{business.category || t('messages.localBusiness')} · {t('messages.activeProfile')}</p>
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

              <div className="message-list" aria-live="polite">
                {messages.length > 0 ? messages.map((message) => {
                  const isOwn = message.senderId === user.uid
                  return (
                    <article className={isOwn ? 'message-bubble is-own' : 'message-bubble'} key={message.messageId}>
                      <p>{message.text}</p>
                      <time>{formatMessageTime(message.createdAt)}</time>
                    </article>
                  )
                }) : (
                  <div className="message-list__empty">
                    <p>{t('messages.noMessages')}</p>
                    <span>{t('messages.startConversation')}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="message-composer" onSubmit={handleSend}>
                <label className="visually-hidden" htmlFor="message-text">{t('messages.messageLabel')}</label>
                <textarea
                  id="message-text"
                  maxLength={4000}
                  onChange={(event) => setMessageText(event.target.value)}
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
        open={confirmRemove}
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

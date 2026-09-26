import { useEffect, useState } from 'react'
import { messageTranslationPresentation } from '../../utils/messageTranslationPresentation.js'

// The caller keys this component by viewer, conversation, message and target language.
export default function MessageTranslationText({ message, viewerId, targetLanguage, t }) {
  const [showOriginal, setShowOriginal] = useState(false)
  const [clockTick, refreshClock] = useState(0)
  const presentation = messageTranslationPresentation(message, viewerId, targetLanguage, showOriginal)
  useEffect(() => {
    if (presentation.status !== 'processing') return undefined
    const timer = setTimeout(() => refreshClock(value => value + 1), Math.min(2147483647, Math.max(0, presentation.expiresAt - Date.now())))
    return () => clearTimeout(timer)
  }, [presentation.status, presentation.expiresAt, clockTick])
  return <>
    <p>{presentation.text}</p>
    {presentation.canToggle && <div className="message-translation-controls">
      {!showOriginal && <span>{t('messages.translation.completed')}</span>}
      <button type="button" onClick={() => setShowOriginal(value => !value)}>
        {t(showOriginal ? 'messages.translation.viewTranslation' : 'messages.translation.viewOriginal')}
      </button>
    </div>}
    {['processing', 'failed'].includes(presentation.status) && <small className="message-translation-status">
      {t(`messages.translation.${presentation.status}`)}
    </small>}
  </>
}

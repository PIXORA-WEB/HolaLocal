import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAnalyticsChoice, setAnalyticsChoice, subscribeAnalyticsChoice } from '../../services/analyticsConsent.js'
import { updateAnalyticsRoute, watchAnalyticsChoice } from '../../services/analyticsController.js'

export default function AnalyticsConsent() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const choice = useSyncExternalStore(subscribeAnalyticsChoice, getAnalyticsChoice, () => null)
  const [editing, setEditing] = useState(false)
  const panel = useRef(null)
  const returnFocus = useRef(null)
  const visible = choice === null || editing
  useLayoutEffect(() => { updateAnalyticsRoute(pathname) }, [pathname])
  useEffect(watchAnalyticsChoice, [])
  useEffect(() => {
    const open = () => { returnFocus.current = document.activeElement; setEditing(true) }
    window.addEventListener('holalocal:privacy-settings', open)
    return () => window.removeEventListener('holalocal:privacy-settings', open)
  }, [])
  useLayoutEffect(() => {
    if (!visible) return
    const element = panel.current
    const resize = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--analytics-bar-height', `${element.getBoundingClientRect().height}px`)
    })
    resize.observe(element)
    if (editing) element.focus()
    return () => { resize.disconnect(); document.documentElement.style.removeProperty('--analytics-bar-height') }
  }, [visible, editing])
  const close = () => { setEditing(false); returnFocus.current?.focus() }
  const choose = value => { setAnalyticsChoice(value); close() }
  if (!visible) return null
  return (
    <aside className="analytics-choice" onKeyDown={event => { if (event.key === 'Escape' && editing && choice !== null) { event.stopPropagation(); close() } }} ref={panel} tabIndex={-1} aria-labelledby="analytics-heading">
      <div className="analytics-choice__copy">
        <h2 id="analytics-heading">{t('analytics.title')}</h2>
        <p>{t('analytics.summary')} <Link to="/privacy#optional-analytics">{t('analytics.privacy')}</Link></p>
        {editing && <p>{t('analytics.history')}</p>}
      </div>
      <div className="analytics-choice__actions">
        <button type="button" className="button button--secondary" onClick={() => choose('accepted')}>{t('analytics.accept')}</button>
        <button type="button" className="button button--secondary" onClick={() => choose('rejected')}>{t('analytics.reject')}</button>
        {editing && choice !== null && <button type="button" className="analytics-choice__close" onClick={close}>{t('analytics.close')}</button>}
      </div>
    </aside>
  )
}

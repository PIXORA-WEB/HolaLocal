import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const routeTitleKeys = {
  '/contact': 'footer.contact',
  '/forgot-password': 'auth.forgotPassword',
  '/login': 'auth.loginTitle',
  '/privacy': 'legalPages.privacy.title',
  '/register': 'auth.registration.title',
  '/terms': 'legalPages.terms.title',
  '/verify-email': 'auth.verification.title',
}

function setMetaContent(selector, content) {
  document.head.querySelector(selector)?.setAttribute('content', content)
}

function MetadataManager() {
  const { i18n, t } = useTranslation()
  const location = useLocation()

  useEffect(() => {
    const language = i18n.resolvedLanguage?.split('-')[0] ?? 'en'
    const routeTitleKey = routeTitleKeys[location.pathname]
    const title = routeTitleKey
      ? t('metadata.pageTitle', { page: t(routeTitleKey) })
      : t('metadata.title')
    const description = t('metadata.description')
    const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://holalocal.es').replace(/\/$/, '')
    const canonicalUrl = `${siteUrl}${location.pathname === '/' ? '/' : location.pathname}`

    document.documentElement.lang = language
    document.title = title
    setMetaContent('meta[name="description"]', description)
    setMetaContent('meta[property="og:title"]', title)
    setMetaContent('meta[property="og:description"]', description)
    setMetaContent('meta[property="og:url"]', canonicalUrl)
    setMetaContent('meta[property="og:locale"]', language)
    setMetaContent('meta[name="twitter:title"]', title)
    setMetaContent('meta[name="twitter:description"]', description)
    document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', canonicalUrl)
  }, [i18n.resolvedLanguage, location.pathname, t])

  return null
}

export default MetadataManager

import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import useAuthentication from '../../hooks/useAuthentication.js'
import { db } from '../../firebase/config.js'
import NoticeCoordinator from '../../../../../shared/legal-notice/NoticeCoordinator.jsx'
import { createLegalNoticeClient } from '../../../../../shared/legal-notice/client.js'
import { noticeLocales } from '../../../../../shared/legal-notice/locales.js'

const client = createLegalNoticeClient(db)
export default function LegalUpdateNotice() {
  const { user, userProfile, loading, profileLoading, emailVerified } = useAuthentication()
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const locale = i18n.resolvedLanguage?.split('-')[0] || 'en'
  if (!user) return null
  return <NoticeCoordinator key={user.uid} uid={user.uid} client={client}
    eligible={!loading && !profileLoading && emailVerified && userProfile?.accountStatus === 'active'} pathname={pathname}
    locale={locale} copy={noticeLocales[locale] || noticeLocales.en} />
}

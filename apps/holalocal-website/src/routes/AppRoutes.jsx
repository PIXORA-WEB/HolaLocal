import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import MetadataManager from '../components/common/MetadataManager.jsx'
import BusinessLayout from '../components/layout/BusinessLayout.jsx'
import AdminLayout from '../components/layout/AdminLayout.jsx'
import SiteLayout from '../components/layout/SiteLayout.jsx'
import BusinessRoute from './BusinessRoute.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import PublicRoute from './PublicRoute.jsx'
import AdminRoute from './AdminRoute.jsx'

const CompleteProfilePage = lazy(() => import('../pages/auth/CompleteProfilePage.jsx'))
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage.jsx'))
const LoginPage = lazy(() => import('../pages/auth/LoginPage.jsx'))
const OnboardingPage = lazy(() => import('../pages/auth/OnboardingPage.jsx'))
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage.jsx'))
const VerificationPendingPage = lazy(() => import('../pages/auth/VerificationPendingPage.jsx'))
const BusinessDashboardPage = lazy(() => import('../pages/business/BusinessDashboardPage.jsx'))
const EditBusinessPage = lazy(() => import('../pages/business/EditBusinessPage.jsx'))
const SubscriptionPage = lazy(() => import('../pages/business/SubscriptionPage.jsx'))
const ContactPage = lazy(() => import('../pages/ContactPage.jsx'))
const HomePage = lazy(() => import('../pages/HomePage.jsx'))
const ProfilePage = lazy(() => import('../pages/customer/ProfilePage.jsx'))
const MessagesPage = lazy(() => import('../pages/MessagesPage.jsx'))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage.jsx'))
const ServicesPage = lazy(() => import('../pages/ServicesPage.jsx'))
const TermsPage = lazy(() => import('../pages/TermsPage.jsx'))
const AdminOverviewPage = lazy(() => import('../pages/admin/AdminOverviewPage.jsx'))
const AdminBusinessesPage = lazy(() => import('../pages/admin/AdminBusinessesPage.jsx'))
const AdminBusinessReviewPage = lazy(() => import('../pages/admin/AdminBusinessReviewPage.jsx'))

function RouteLoadingFallback() {
  const { t } = useTranslation()
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading__skeleton" aria-hidden="true" />
      <span>{t('common.loadingAccount')}</span>
    </div>
  )
}

function SignInRedirect() {
  const location = useLocation()
  return <Navigate replace state={location.state} to={`/login${location.search}`} />
}

function LegacyBusinessRedirect() {
  const { businessId } = useParams()
  const location = useLocation()
  const target = businessId
    ? `/services/${encodeURIComponent(businessId)}${location.search}`
    : `/services${location.search}`

  return <Navigate replace to={target} />
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <MetadataManager />
      <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/:businessId" element={<ServicesPage />} />
          <Route path="businesses" element={<LegacyBusinessRedirect />} />
          <Route path="businesses/:businessId" element={<LegacyBusinessRedirect />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="profile" element={<ProfilePage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="messages/:conversationId" element={<MessagesPage />} />
            <Route element={<BusinessRoute />}>
              <Route path="business" element={<BusinessLayout />}>
                <Route index element={<Navigate replace to="dashboard" />} />
                <Route path="dashboard" element={<BusinessDashboardPage />} />
                <Route path="edit" element={<EditBusinessPage />} />
                <Route path="subscription" element={<SubscriptionPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route element={<PublicRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="sign-in" element={<SignInRedirect />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowIncompleteProfile />}>
          <Route element={<AuthLayout />}>
            <Route path="complete-profile" element={<CompleteProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowIncompleteOnboarding allowIncompleteProfile allowUnverified />}>
          <Route element={<AuthLayout />}>
            <Route path="verify-email" element={<VerificationPendingPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowIncompleteOnboarding />}>
          <Route element={<AuthLayout />}>
            <Route path="onboarding" element={<OnboardingPage />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="businesses" element={<AdminBusinessesPage />} />
            <Route path="businesses/:businessId" element={<AdminBusinessReviewPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default AppRoutes

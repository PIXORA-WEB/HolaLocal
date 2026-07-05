import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout.jsx'
import BusinessLayout from '../layouts/BusinessLayout.jsx'
import MainLayout from '../layouts/MainLayout.jsx'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.jsx'
import CompleteProfilePage from '../pages/auth/CompleteProfilePage.jsx'
import LoginPage from '../pages/auth/LoginPage.jsx'
import OnboardingPage from '../pages/auth/OnboardingPage.jsx'
import RegisterPage from '../pages/auth/RegisterPage.jsx'
import BusinessDashboardPage from '../pages/business/BusinessDashboardPage.jsx'
import EditBusinessPage from '../pages/business/EditBusinessPage.jsx'
import SubscriptionPage from '../pages/business/SubscriptionPage.jsx'
import FavouritesPage from '../pages/customer/FavouritesPage.jsx'
import MessagesPage from '../pages/customer/MessagesPage.jsx'
import ProfilePage from '../pages/customer/ProfilePage.jsx'
import BusinessDetailsPage from '../pages/public/BusinessDetailsPage.jsx'
import CategoriesPage from '../pages/public/CategoriesPage.jsx'
import HomePage from '../pages/public/HomePage.jsx'
import SearchPage from '../pages/public/SearchPage.jsx'
import BusinessRoute from './BusinessRoute.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import PublicRoute from './PublicRoute.jsx'

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="businesses/:businessId" element={<BusinessDetailsPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="messages" element={<MessagesPage />} />
            <Route path="favourites" element={<FavouritesPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route element={<PublicRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowIncompleteProfile />}>
          <Route element={<AuthLayout />}>
            <Route path="complete-profile" element={<CompleteProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowIncompleteOnboarding />}>
          <Route element={<AuthLayout />}>
            <Route path="onboarding" element={<OnboardingPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<BusinessRoute />}>
            <Route path="business" element={<BusinessLayout />}>
              <Route index element={<Navigate replace to="dashboard" />} />
              <Route path="dashboard" element={<BusinessDashboardPage />} />
              <Route path="edit" element={<EditBusinessPage />} />
              <Route path="subscription" element={<SubscriptionPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRoutes

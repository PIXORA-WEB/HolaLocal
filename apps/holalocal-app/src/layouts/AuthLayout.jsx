import { Outlet } from 'react-router-dom'
import BrandLockup from '../components/common/BrandLockup.jsx'
import LanguageSwitcher from '../components/common/LanguageSwitcher.jsx'

function AuthLayout() {
  return (
    <div className="focused-layout">
      <header className="focused-layout__header">
        <div className="app-header__inner">
          <BrandLockup />
          <LanguageSwitcher />
        </div>
      </header>
      <main className="focused-layout__content">
        <Outlet />
      </main>
    </div>
  )
}

export default AuthLayout

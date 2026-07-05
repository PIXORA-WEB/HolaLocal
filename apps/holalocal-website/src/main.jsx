import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { i18nReady } from './i18n/index.js'
import './styles/tokens.css'
import './styles/base.css'
import './styles/global.css'

void i18nReady.then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  const initializeAnalytics = () => {
    void import('./firebase/analyticsClient.js')
      .then((module) => module.initializeAnalytics())
      .catch(() => null)
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(initializeAnalytics)
  else window.setTimeout(initializeAnalytics, 1500)
})

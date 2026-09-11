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

})

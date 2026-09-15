import {createRoot} from 'react-dom/client'
import {BrowserRouter,Link,Route,Routes} from 'react-router-dom'
import MetadataManager from '../../../src/components/common/MetadataManager.jsx'
import LanguageSwitcher from '../../../src/components/common/LanguageSwitcher.jsx'
import EventsPage from '../../../src/pages/EventsPage.jsx'
import CommunityPage from '../../../src/pages/CommunityPage.jsx'
import {i18nReady} from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18nReady
createRoot(document.getElementById('root')).render(<BrowserRouter><MetadataManager/><LanguageSwitcher/><nav><Link to="/events">Events fixture route</Link><Link to="/community">Community fixture route</Link></nav><Routes><Route path="/events" element={<EventsPage/>}/><Route path="/community" element={<CommunityPage/>}/></Routes></BrowserRouter>)

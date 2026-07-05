import AuthenticationProvider from './context/AuthenticationProvider.jsx'
import AppRoutes from './routes/AppRoutes.jsx'
import ApplicationErrorBoundary from './components/common/ApplicationErrorBoundary.jsx'

function App() {
  return (
    <ApplicationErrorBoundary>
      <AuthenticationProvider>
        <AppRoutes />
      </AuthenticationProvider>
    </ApplicationErrorBoundary>
  )
}

export default App

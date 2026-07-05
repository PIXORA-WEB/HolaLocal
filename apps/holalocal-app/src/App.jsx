import AuthenticationProvider from './context/AuthenticationProvider.jsx'
import AppRoutes from './routes/AppRoutes.jsx'

function App() {
  return (
    <AuthenticationProvider>
      <AppRoutes />
    </AuthenticationProvider>
  )
}

export default App

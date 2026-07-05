function LoadingScreen({ message = 'Loading your account…' }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="loading-screen__spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}

export default LoadingScreen

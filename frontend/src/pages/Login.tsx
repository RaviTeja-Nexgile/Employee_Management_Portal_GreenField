// Placeholder for the Login page, built by its own task.

import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'

export function Login() {
  const { user } = useAuth()
  if (user) {
    return <Navigate to="/dashboard" replace />
  }
  return (
    <div className="boot">
      <div className="card">
        <h1 className="page-title">Welcome back</h1>
        <p className="page-subtitle">Sign in with your demo account.</p>
      </div>
    </div>
  )
}

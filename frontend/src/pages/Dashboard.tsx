// Placeholder for the Dashboard, built by its own task.

import { useAuth } from '../auth'

export function Dashboard() {
  const { user } = useAuth()
  return (
    <div>
      <h1 className="page-title">Hello, {user?.full_name ?? 'there'}</h1>
      <p className="page-subtitle">Your role's dashboard is on its way.</p>
    </div>
  )
}

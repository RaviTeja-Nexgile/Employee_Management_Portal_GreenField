import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="page-header">
      <h1 className="page-title">Page not found</h1>
      <p className="page-subtitle">
        The address you opened is not one of the app's pages.{' '}
        <Link to="/dashboard">Go to the dashboard</Link>.
      </p>
    </div>
  )
}

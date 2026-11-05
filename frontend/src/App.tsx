// Routes, the auth bootstrap gate, the protected shell, redirects and the
// Not found view. The five page routes are built by their own tasks; this
// file wires them in.

import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { Shell } from './components/Shell'
import { LoadingState } from './components/States'
import { Dashboard } from './pages/Dashboard'
import { EmployeeDetail } from './pages/EmployeeDetail'
import { Employees } from './pages/Employees'
import { Login } from './pages/Login'
import { MyProfile } from './pages/MyProfile'
import { NotFound } from './pages/NotFound'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="boot">
        <LoadingState label="Loading…" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="boot">
        <LoadingState label="Loading…" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/my-profile" element={<MyProfile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

// The signed-in shell: a 220 px sidebar and a top bar with the account name,
// the role and Logout. Below 768 px the sidebar becomes a compact top
// navigation.

import { LayoutDashboard, LogOut, UserRound, Users } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/my-profile', label: 'My Profile', icon: UserRound },
]

export function Shell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden="true">
            EMS
          </span>
          <span className="sidebar__name">Employee Management</span>
        </div>
        <nav className="sidebar__nav" aria-label="Main">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <div className="topbar__account">
            <span className="topbar__name">{user?.full_name ?? ''}</span>
            <span className="topbar__role">
              {user ? ROLE_LABELS[user.role] ?? user.role : ''}
            </span>
          </div>
          <button type="button" className="topbar__logout" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Role-aware dashboard: the greeting and subtitle, the cards for the signed-in
// person's role, skeleton placeholders while the figures load, and an error
// notice with Retry when the request fails.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Role } from '../api'
import { useAuth } from '../auth'
import { StatCard } from '../components/Card'
import { ErrorNotice, SkeletonCards } from '../components/States'
import styles from './Dashboard.module.css'

interface AdminSummary {
  role: 'ADMIN'
  total_employees: number
  active_employees: number
  inactive_employees: number
}

interface ManagerSummary {
  role: 'MANAGER'
  direct_report_count: number
  department: string
  job_title: string
}

interface EmployeeSummary {
  role: 'EMPLOYEE'
  department: string
  job_title: string
  is_active: boolean
}

type DashboardSummary = AdminSummary | ManagerSummary | EmployeeSummary

const SUBTITLES: Record<Role, string> = {
  ADMIN: 'Here is how the company looks today.',
  MANAGER: 'Here is your team at a glance.',
  EMPLOYEE: 'Here is your employment summary.',
}

const ACTIONS: Record<Role, { label: string; to: string }> = {
  ADMIN: { label: 'Open Employees', to: '/employees' },
  MANAGER: { label: 'Open my direct reports', to: '/employees?team_only=true' },
  EMPLOYEE: { label: 'Open My Profile', to: '/my-profile' },
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Try again.'
}

export function Dashboard() {
  const { user } = useAuth()
  const role: Role = user?.role ?? 'EMPLOYEE'
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<DashboardSummary>('/dashboard')
      if (mounted.current) setSummary(data)
    } catch (caught) {
      if (mounted.current) {
        setSummary(null)
        setError(errorMessage(caught))
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
    }
  }, [load])

  const action = ACTIONS[role]

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className="page-title">Hello, {user?.full_name ?? 'there'}</h1>
        <p className="page-subtitle">{SUBTITLES[role]}</p>
      </header>

      {loading ? (
        <SkeletonCards count={3} />
      ) : error ? (
        <ErrorNotice message={error} onRetry={() => void load()} />
      ) : summary ? (
        <div className={styles.cards}>
          {summary.role === 'ADMIN' ? (
            <>
              <StatCard label="Total records" value={summary.total_employees} />
              <StatCard label="Active records" value={summary.active_employees} />
              <StatCard label="Inactive records" value={summary.inactive_employees} />
            </>
          ) : summary.role === 'MANAGER' ? (
            <>
              <StatCard label="Active direct reports" value={summary.direct_report_count} />
              <StatCard label="Department" value={summary.department} />
              <StatCard label="Job title" value={summary.job_title} />
            </>
          ) : (
            <>
              <StatCard label="Department" value={summary.department} />
              <StatCard label="Job title" value={summary.job_title} />
              <StatCard label="Status" value={summary.is_active ? 'Active' : 'Inactive'} />
            </>
          )}
        </div>
      ) : null}

      <div className={styles.actions}>
        <Link className={`btn btn--primary ${styles.action}`} to={action.to}>
          {action.label}
        </Link>
      </div>
    </div>
  )
}

// Employee details at /employees/:id: the Back to employees link, the name,
// job title and department header, and an information card holding the fields
// the signed-in person's role may see. An Administrator also gets an Edit
// action on an active record. A missing, inactive (for non-Administrators) or
// non-numeric record shows "Employee unavailable".

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ErrorNotice, LoadingState } from '../components/States'
import styles from './EmployeeDetail.module.css'

type ViewKind = 'DIRECTORY' | 'TEAM' | 'SELF' | 'ADMIN'

interface EmployeeRecord {
  id: number
  employee_code: string
  full_name: string
  work_email: string
  job_title: string
  department: string
  date_of_joining?: string
  employment_type?: string
  manager_id?: number | null
  phone?: string | null
  version?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

interface DetailResponse {
  view_kind: ViewKind
  employee: EmployeeRecord
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full time',
  CONTRACT: 'Contract',
}

function employmentTypeLabel(value: string | undefined): string {
  if (!value) return '—'
  return EMPLOYMENT_TYPE_LABELS[value] ?? value
}

function formatDate(value: string | undefined): string {
  if (!value) return '—'
  // A joining date is YYYY-MM-DD; a timestamp is ISO-8601. Show the date part.
  return value.slice(0, 10)
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function textOrDash(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return value
}

interface Field {
  label: string
  value: string
}

function fieldsFor(record: EmployeeRecord, viewKind: ViewKind): Field[] {
  const fields: Field[] = [
    { label: 'Name', value: record.full_name },
    { label: 'Employee code', value: record.employee_code },
    { label: 'Work email', value: record.work_email },
    { label: 'Job title', value: record.job_title },
    { label: 'Department', value: record.department },
  ]

  if (viewKind === 'TEAM' || viewKind === 'SELF' || viewKind === 'ADMIN') {
    fields.push(
      { label: 'Joining date', value: formatDate(record.date_of_joining) },
      { label: 'Employment type', value: employmentTypeLabel(record.employment_type) },
      {
        label: 'Manager',
        value: record.manager_id === null || record.manager_id === undefined ? '—' : `EMP-${String(record.manager_id).padStart(4, '0')}`,
      },
    )
  }

  if (viewKind === 'SELF' || viewKind === 'ADMIN') {
    fields.push({ label: 'Phone', value: textOrDash(record.phone) })
  }

  if (viewKind === 'ADMIN') {
    fields.push(
      { label: 'Active status', value: record.is_active ? 'Active' : 'Inactive' },
      { label: 'Version', value: record.version === undefined ? '—' : String(record.version) },
      { label: 'Created', value: formatTimestamp(record.created_at) },
      { label: 'Updated', value: formatTimestamp(record.updated_at) },
    )
  }

  return fields
}

interface EditDialogProps {
  employee: EmployeeRecord
  onClose: () => void
}

// The edit modal itself (its fields, Save and Cancel, field errors, the
// duplicate-email and stale-version messages) is task 7.1's EmployeeForm. This
// dialog is the details page's own Edit action: it opens on click, moves focus
// inside, closes on Escape, Cancel or a backdrop click, and returns focus to
// the Edit button.
function EditDialog({ employee, onClose }: EditDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <h2 className={styles.dialogTitle} id={titleId}>
          Edit employee
        </h2>
        <form
          className={styles.dialogForm}
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          <label className={styles.dialogField}>
            <span className={styles.dialogLabel}>Full name</span>
            <input
              className={styles.dialogInput}
              ref={firstFieldRef}
              defaultValue={employee.full_name}
              name="full_name"
            />
          </label>
          <label className={styles.dialogField}>
            <span className={styles.dialogLabel}>Work email</span>
            <input
              className={styles.dialogInput}
              defaultValue={employee.work_email}
              name="work_email"
              type="email"
            />
          </label>
          <label className={styles.dialogField}>
            <span className={styles.dialogLabel}>Job title</span>
            <input
              className={styles.dialogInput}
              defaultValue={employee.job_title}
              name="job_title"
            />
          </label>
          <label className={styles.dialogField}>
            <span className={styles.dialogLabel}>Department</span>
            <input
              className={styles.dialogInput}
              defaultValue={employee.department}
              name="department"
            />
          </label>
          <div className={styles.dialogActions}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Unavailable() {
  return (
    <div className={styles.unavailable}>
      <h1 className="page-title">Employee unavailable</h1>
      <p className={styles.unavailableText}>
        This employee record does not exist or you cannot see it.
      </p>
      <Link to="/employees" className={styles.unavailableLink}>
        Back to employees
      </Link>
    </div>
  )
}

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()

  const numericId = id !== undefined && /^\d+$/.test(id) ? Number(id) : null

  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const mounted = useRef(true)
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    // Wait for the session to be known: a request sent before the bootstrap
    // finishes would answer 401 and show a failed request on the page.
    if (authLoading) return

    if (numericId === null) {
      setData(null)
      setError(null)
      setNotFound(true)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setNotFound(false)

    api
      .get<DetailResponse>(`/employees/${numericId}`, undefined, controller.signal)
      .then((response) => {
        if (!mounted.current) return
        setData(response)
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (!mounted.current) return
        if ((caught as Error).name === 'AbortError') return
        if (caught instanceof ApiError && caught.status === 404) {
          setData(null)
          setNotFound(true)
          setLoading(false)
          return
        }
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Something went wrong. Try again.',
        )
        setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [authLoading, numericId, reloadKey])

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  const closeEditor = useCallback(() => {
    setEditing(false)
    // Return focus to the trigger, as the design's modal rules require.
    pageRef.current
      ?.querySelector<HTMLButtonElement>('[data-edit-trigger]')
      ?.focus()
  }, [])

  if (loading) {
    return (
      <div className={styles.page}>
        <Link to="/employees" className={styles.backLink}>
          Back to employees
        </Link>
        <LoadingState label="Loading employee…" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <Unavailable />
      </div>
    )
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <Link to="/employees" className={styles.backLink}>
          Back to employees
        </Link>
        <ErrorNotice
          message={error ?? 'Something went wrong. Try again.'}
          onRetry={retry}
        />
      </div>
    )
  }

  const { employee, view_kind: viewKind } = data
  const fields = fieldsFor(employee, viewKind)
  const canEdit = user?.role === 'ADMIN' && employee.is_active === true

  return (
    <div className={styles.page} ref={pageRef}>
      <Link to="/employees" className={styles.backLink}>
        Back to employees
      </Link>

      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className="page-title">{employee.full_name}</h1>
          <p className={styles.headerMeta}>
            {employee.job_title} · {employee.department}
          </p>
        </div>
        {canEdit ? (
          <Button
            variant="primary"
            className={styles.editButton}
            data-edit-trigger=""
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        ) : null}
      </header>

      {editing ? <EditDialog employee={employee} onClose={closeEditor} /> : null}

      {error ? <ErrorNotice message={error} onRetry={retry} /> : null}

      <Card title="Information">
        <dl className={styles.grid}>
          {fields.map((field) => (
            <div className={styles.field} key={field.label}>
              <dt className={styles.label}>{field.label}</dt>
              <dd className={styles.value}>{field.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}

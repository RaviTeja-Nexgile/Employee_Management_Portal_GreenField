// The employee directory at /employees: the search box with its 250 ms
// debounce, the role-aware table, pagination kept in the address, the empty
// state, the loading placeholder and the error notice with Retry.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/Button'
import { EmptyState, ErrorNotice } from '../components/States'
import styles from './Employees.module.css'

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 250

export interface DirectoryItem {
  id: number
  employee_code: string
  full_name: string
  work_email: string
  job_title: string
  department: string
  is_active?: boolean
}

interface DirectoryResponse {
  items: DirectoryItem[]
  page: number
  page_size: number
  total: number
}

type LoadState = 'loading' | 'ready' | 'error'

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function pageNumbers(current: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  const start = Math.min(Math.max(current - 2, 1), totalPages - 4)
  return Array.from({ length: 5 }, (_, index) => start + index)
}

export function Employees() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const role = user?.role ?? 'EMPLOYEE'
  const isAdmin = role === 'ADMIN'
  const isManager = role === 'MANAGER'

  const q = searchParams.get('q') ?? ''
  const page = parsePage(searchParams.get('page'))
  const includeInactive = isAdmin && searchParams.get('include_inactive') === 'true'
  const teamOnly = isManager && searchParams.get('team_only') === 'true'

  const [searchText, setSearchText] = useState(q)
  const [data, setData] = useState<DirectoryResponse | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  // Keep the box in step when the address changes from elsewhere (a page
  // click, the Clear search button, the back button).
  useEffect(() => {
    committedSearch.current = q
    setSearchText(q)
  }, [q])

  // Debounce the typed text into the address, which resets the table to page 1.
  // Only text the person typed may touch the address: this effect also runs on
  // mount and whenever the address changes from elsewhere (a page click, the
  // back button), and rewriting it then would strip ?page and bounce the table
  // back to page 1. The ref holds the text the address already reflects.
  const committedSearch = useRef(q)
  useEffect(() => {
    const trimmed = searchText.trim()
    if (trimmed === committedSearch.current) return
    const timer = window.setTimeout(() => {
      committedSearch.current = trimmed
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (trimmed) next.set('q', trimmed)
          else next.delete('q')
          next.delete('page')
          return next
        },
        { replace: true },
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchText, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState('loading')
    setErrorMessage('')

    api
      .get<DirectoryResponse>(
        '/employees',
        {
          q: q || undefined,
          page,
          page_size: PAGE_SIZE,
          team_only: teamOnly || undefined,
          include_inactive: includeInactive || undefined,
        },
        controller.signal,
      )
      .then((response) => {
        if (!active) return
        setData(response)
        setState('ready')
      })
      .catch((error: unknown) => {
        if (!active || (error as Error).name === 'AbortError') return
        setErrorMessage(
          error instanceof ApiError && error.message
            ? error.message
            : 'The directory could not be loaded. Try again.',
        )
        setState('error')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [q, page, teamOnly, includeInactive, reloadKey])

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        if (value === null) next.delete(key)
        else next.set(key, value)
        next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  const goToPage = useCallback(
    (target: number) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        if (target <= 1) next.delete('page')
        else next.set('page', String(target))
        return next
      })
    },
    [setSearchParams],
  )

  const clearSearch = useCallback(() => {
    setSearchText('')
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('q')
      next.delete('page')
      return next
    })
  }, [setSearchParams])

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.items ?? []
  const hasFilters = Boolean(q) || includeInactive || teamOnly
  const pages = useMemo(() => pageNumbers(page, totalPages), [page, totalPages])

  const columnCount = isAdmin ? 7 : 6

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Find a colleague in the employee directory.</p>
        </div>
        {isAdmin ? (
          <Button className={styles.addButton} onClick={() => undefined}>
            Add employee
          </Button>
        ) : null}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <label className={styles.searchLabel} htmlFor="employee-search">
            Search
          </label>
          <input
            id="employee-search"
            className={styles.searchInput}
            type="search"
            placeholder="Search by name or work email"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>

        <div className={styles.filters}>
          {isAdmin ? (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) =>
                  updateParam('include_inactive', event.target.checked ? 'true' : null)
                }
              />
              <span>Include inactive</span>
            </label>
          ) : null}
          {isManager ? (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={teamOnly}
                onChange={(event) =>
                  updateParam('team_only', event.target.checked ? 'true' : null)
                }
              />
              <span>My direct reports</span>
            </label>
          ) : null}
        </div>
      </div>

      {state === 'error' ? (
        <ErrorNotice message={errorMessage} onRetry={retry} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Employee code</th>
                <th scope="col">Work email</th>
                <th scope="col">Job title</th>
                <th scope="col">Department</th>
                {isAdmin ? <th scope="col">Status</th> : null}
                {isAdmin ? (
                  <th scope="col" className={styles.actionsHeader}>
                    <span className={styles.visuallyHidden}>Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {state === 'loading' ? (
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`} className={styles.skeletonRow} aria-hidden="true">
                    {Array.from({ length: columnCount }).map((__, cellIndex) => (
                      <td key={cellIndex}>
                        <span className={styles.skeletonLine} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className={styles.emptyCell}>
                    <EmptyState>
                      <div className={styles.empty}>
                        <p className={styles.emptyTitle}>
                          {hasFilters ? 'No employees match your search.' : 'No employees yet.'}
                        </p>
                        {q ? (
                          <Button variant="secondary" onClick={clearSearch}>
                            Clear search
                          </Button>
                        ) : null}
                      </div>
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className={styles.nameLink} to={`/employees/${item.id}`}>
                        {item.full_name}
                      </Link>
                    </td>
                    <td className={styles.mono}>{item.employee_code}</td>
                    <td>{item.work_email}</td>
                    <td>{item.job_title}</td>
                    <td>{item.department}</td>
                    {isAdmin ? (
                      <td>
                        <span
                          className={
                            item.is_active === false
                              ? `${styles.status} ${styles.statusInactive}`
                              : `${styles.status} ${styles.statusActive}`
                          }
                        >
                          {item.is_active === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                    ) : null}
                    {isAdmin ? (
                      <td className={styles.actionsCell}>
                        <button
                          type="button"
                          className={styles.menuButton}
                          aria-label={`Actions for ${item.full_name}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === item.id}
                          onClick={() =>
                            setOpenMenuId((current) => (current === item.id ? null : item.id))
                          }
                        >
                          ⋯
                        </button>
                        {openMenuId === item.id ? (
                          <div className={styles.menu} role="menu">
                            <Link
                              role="menuitem"
                              className={styles.menuItem}
                              to={`/employees/${item.id}`}
                              onClick={() => setOpenMenuId(null)}
                            >
                              View details
                            </Link>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {state === 'ready' && total > 0 ? (
        <nav className={styles.pagination} aria-label="Pagination">
          <span className={styles.pageSummary}>
            Page {page} of {totalPages} · {total} {total === 1 ? 'employee' : 'employees'}
          </span>
          <div className={styles.pageButtons}>
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
            {pages.map((number) => (
              <button
                key={number}
                type="button"
                className={
                  number === page
                    ? `${styles.pageButton} ${styles.pageButtonActive}`
                    : styles.pageButton
                }
                aria-current={number === page ? 'page' : undefined}
                onClick={() => goToPage(number)}
              >
                {number}
              </button>
            ))}
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}

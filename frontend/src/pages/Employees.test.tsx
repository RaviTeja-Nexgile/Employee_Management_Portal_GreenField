import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, type Role } from '../api'
import { Employees } from './Employees'

const authState: { user: { id: number; email: string; role: Role; employee_id: number; full_name: string } | null } = {
  user: null,
}

vi.mock('../auth', () => ({
  useAuth: () => ({ user: authState.user, loading: false }),
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  }
})

const getMock = vi.mocked(api.get)

function makeItems(count: number, startId = 1) {
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index
    return {
      id,
      employee_code: `EMP-${String(id).padStart(4, '0')}`,
      full_name: `Employee ${id}`,
      work_email: `employee${id}@demo.test`,
      job_title: 'Engineer',
      department: 'Engineering',
      is_active: true,
    }
  })
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderPage(initialEntry = '/employees') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/employees"
          element={
            <>
              <Employees />
              <LocationProbe />
            </>
          }
        />
        <Route path="/employees/:id" element={<div>Detail page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function setRole(role: Role) {
  authState.user = {
    id: 1,
    email: `${role.toLowerCase()}@demo.test`,
    role,
    employee_id: 1,
    full_name: 'Signed In',
  }
}

beforeEach(() => {
  getMock.mockReset()
  setRole('EMPLOYEE')
})

describe('Employees directory', () => {
  it('shows the title, the search box, the columns and pagination', async () => {
    getMock.mockResolvedValue({ items: makeItems(2), page: 1, page_size: 25, total: 2 })
    renderPage()

    expect(screen.getByRole('heading', { name: 'Employees' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBeInTheDocument()

    const table = await screen.findByRole('table')
    for (const column of ['Name', 'Employee code', 'Work email', 'Job title', 'Department']) {
      expect(within(table).getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(within(table).getByText('Employee 1')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()

    const [, query] = getMock.mock.calls[0]
    expect(query).toMatchObject({ page: 1, page_size: 25 })
  })

  it('debounces the search into the address and resets to page 1', async () => {
    getMock.mockResolvedValue({ items: makeItems(1), page: 1, page_size: 25, total: 1 })
    const user = userEvent.setup()
    renderPage('/employees?page=3')

    await screen.findByRole('table')
    await user.type(screen.getByLabelText('Search'), 'priya')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/employees?q=priya')
    })
    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith(
        '/employees',
        expect.objectContaining({ q: 'priya', page: 1 }),
        expect.anything(),
      )
    })
  })

  it('keeps the search and page in the address when a page number is clicked', async () => {
    getMock.mockResolvedValue({ items: makeItems(25), page: 1, page_size: 25, total: 60 })
    const user = userEvent.setup()
    renderPage('/employees?q=ann')

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/employees?q=ann&page=2')
    })
    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith(
        '/employees',
        expect.objectContaining({ q: 'ann', page: 2 }),
        expect.anything(),
      )
    })
  })

  it('opens the detail page from an employee name', async () => {
    getMock.mockResolvedValue({ items: makeItems(1), page: 1, page_size: 25, total: 1 })
    renderPage()

    const link = await screen.findByRole('link', { name: 'Employee 1' })
    expect(link).toHaveAttribute('href', '/employees/1')
  })

  it('shows the empty state with Clear search and no error', async () => {
    getMock.mockResolvedValue({ items: [], page: 1, page_size: 25, total: 0 })
    const user = userEvent.setup()
    renderPage('/employees?q=nobody')

    expect(await screen.findByText('No employees match your search.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/employees')
    })
  })

  it('shows the Administrator controls and the Status column', async () => {
    setRole('ADMIN')
    getMock.mockResolvedValue({ items: makeItems(1), page: 1, page_size: 25, total: 1 })
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('button', { name: 'Add employee' })).toBeInTheDocument()
    const includeInactive = screen.getByRole('checkbox', { name: 'Include inactive' })
    expect(includeInactive).not.toBeChecked()

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions for Employee 1' })).toBeInTheDocument()

    await user.click(includeInactive)
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('include_inactive=true')
    })
    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith(
        '/employees',
        expect.objectContaining({ include_inactive: true }),
        expect.anything(),
      )
    })
  })

  it('shows the Manager direct reports checkbox and no Administrator controls', async () => {
    setRole('MANAGER')
    getMock.mockResolvedValue({ items: makeItems(1), page: 1, page_size: 25, total: 1 })
    const user = userEvent.setup()
    renderPage()

    expect(screen.queryByRole('button', { name: 'Add employee' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Include inactive' })).not.toBeInTheDocument()

    const teamOnly = screen.getByRole('checkbox', { name: 'My direct reports' })
    await user.click(teamOnly)
    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith(
        '/employees',
        expect.objectContaining({ team_only: true }),
        expect.anything(),
      )
    })
  })

  it('shows no Administrator controls or row actions for an Employee', async () => {
    setRole('EMPLOYEE')
    getMock.mockResolvedValue({ items: makeItems(1), page: 1, page_size: 25, total: 1 })
    renderPage()

    const table = await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Add employee' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument()
  })

  it('shows the loading placeholder in place of the rows', () => {
    getMock.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Employee 1')).not.toBeInTheDocument()
    expect(screen.getByRole('table').querySelectorAll('tbody tr').length).toBeGreaterThan(0)
  })

  it('shows an error notice with Retry that reloads the directory', async () => {
    getMock.mockRejectedValueOnce(new ApiError(503, 'unavailable', 'The service is temporarily unavailable. Try again.'))
    getMock.mockResolvedValueOnce({ items: makeItems(1), page: 1, page_size: 25, total: 1 })
    const user = userEvent.setup()
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The service is temporarily unavailable. Try again.')

    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Employee 1')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

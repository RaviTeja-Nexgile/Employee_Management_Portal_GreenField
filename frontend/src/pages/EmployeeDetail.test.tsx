import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, type Role } from '../api'
import { EmployeeDetail } from './EmployeeDetail'

const authState: {
  user: { id: number; email: string; role: Role; employee_id: number; full_name: string } | null
} = {
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

const DIRECTORY_FIELDS = ['Name', 'Employee code', 'Work email', 'Job title', 'Department']
const TEAM_FIELDS = ['Joining date', 'Employment type', 'Manager']

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    employee_code: 'EMP-0003',
    full_name: 'Priya Raman',
    work_email: 'priya.raman@demo.test',
    job_title: 'Software Engineer',
    department: 'Engineering',
    ...overrides,
  }
}

function renderPage(initialEntry = '/employees/3') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/employees" element={<div>Directory page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function setRole(role: Role, employeeId = 1) {
  authState.user = {
    id: 1,
    email: `${role.toLowerCase()}@demo.test`,
    role,
    employee_id: employeeId,
    full_name: 'Signed In',
  }
}

function labelsShown(): string[] {
  return screen
    .getAllByRole('term')
    .map((node) => node.textContent ?? '')
}

beforeEach(() => {
  getMock.mockReset()
  setRole('EMPLOYEE')
})

describe('Employee details', () => {
  it('shows the Back to employees link, the header and the information card', async () => {
    getMock.mockResolvedValue({ view_kind: 'DIRECTORY', employee: makeEmployee() })
    renderPage()

    expect(screen.getByRole('link', { name: 'Back to employees' })).toHaveAttribute(
      'href',
      '/employees',
    )
    expect(await screen.findByRole('heading', { name: 'Priya Raman' })).toBeInTheDocument()
    expect(screen.getByText('Software Engineer · Engineering')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Information' })).toBeInTheDocument()

    expect(getMock).toHaveBeenCalledWith('/employees/3', undefined, expect.anything())
  })

  it('shows only the directory fields for a colleague', async () => {
    getMock.mockResolvedValue({ view_kind: 'DIRECTORY', employee: makeEmployee() })
    renderPage()

    await screen.findByRole('heading', { name: 'Priya Raman' })
    expect(labelsShown()).toEqual(DIRECTORY_FIELDS)
    expect(screen.queryByText('Phone')).not.toBeInTheDocument()
    expect(screen.queryByText('Joining date')).not.toBeInTheDocument()
  })

  it('shows the team fields for a Manager viewing a direct report', async () => {
    setRole('MANAGER', 2)
    getMock.mockResolvedValue({
      view_kind: 'TEAM',
      employee: makeEmployee({
        date_of_joining: '2022-06-01',
        employment_type: 'FULL_TIME',
        manager_id: 2,
      }),
    })
    renderPage()

    await screen.findByRole('heading', { name: 'Priya Raman' })
    expect(labelsShown()).toEqual([...DIRECTORY_FIELDS, ...TEAM_FIELDS])
    expect(screen.getByText('2022-06-01')).toBeInTheDocument()
    expect(screen.getByText('Full time')).toBeInTheDocument()
    expect(screen.getByText('EMP-0002')).toBeInTheDocument()
    expect(screen.queryByText('Phone')).not.toBeInTheDocument()
  })

  it('shows the team fields and the phone for an Employee viewing their own record', async () => {
    setRole('EMPLOYEE', 3)
    getMock.mockResolvedValue({
      view_kind: 'SELF',
      employee: makeEmployee({
        date_of_joining: '2022-06-01',
        employment_type: 'CONTRACT',
        manager_id: 2,
        phone: '+1 202 555 0100',
        version: 4,
      }),
    })
    renderPage()

    await screen.findByRole('heading', { name: 'Priya Raman' })
    expect(labelsShown()).toEqual([...DIRECTORY_FIELDS, ...TEAM_FIELDS, 'Phone'])
    expect(screen.getByText('+1 202 555 0100')).toBeInTheDocument()
    expect(screen.getByText('Contract')).toBeInTheDocument()
    expect(screen.queryByText('Active status')).not.toBeInTheDocument()
  })

  it('shows every field for an Administrator, with the Edit action', async () => {
    setRole('ADMIN')
    getMock.mockResolvedValue({
      view_kind: 'ADMIN',
      employee: makeEmployee({
        date_of_joining: '2022-06-01',
        employment_type: 'FULL_TIME',
        manager_id: 2,
        phone: '+1 202 555 0100',
        version: 4,
        is_active: true,
        created_at: '2022-06-01T09:00:00Z',
        updated_at: '2026-01-02T10:30:00Z',
      }),
    })
    renderPage()

    await screen.findByRole('heading', { name: 'Priya Raman' })
    expect(labelsShown()).toEqual([
      ...DIRECTORY_FIELDS,
      ...TEAM_FIELDS,
      'Phone',
      'Active status',
      'Version',
      'Created',
      'Updated',
    ])
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('opens the edit dialog when an Administrator clicks Edit, and closes it on Escape', async () => {
    setRole('ADMIN')
    getMock.mockResolvedValue({
      view_kind: 'ADMIN',
      employee: makeEmployee({
        date_of_joining: '2022-06-01',
        employment_type: 'FULL_TIME',
        manager_id: 2,
        phone: '+1 202 555 0100',
        version: 4,
        is_active: true,
        created_at: '2022-06-01T09:00:00Z',
        updated_at: '2026-01-02T10:30:00Z',
      }),
    })
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: 'Priya Raman' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Edit employee' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Full name')).toHaveValue('Priya Raman')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
  })

  it('closes the edit dialog from Cancel', async () => {
    setRole('ADMIN')
    getMock.mockResolvedValue({
      view_kind: 'ADMIN',
      employee: makeEmployee({
        date_of_joining: '2022-06-01',
        employment_type: 'FULL_TIME',
        manager_id: 2,
        phone: null,
        version: 4,
        is_active: true,
        created_at: '2022-06-01T09:00:00Z',
        updated_at: '2026-01-02T10:30:00Z',
      }),
    })
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: 'Priya Raman' })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows no Edit action for an inactive record', async () => {
    setRole('ADMIN')
    getMock.mockResolvedValue({
      view_kind: 'ADMIN',
      employee: makeEmployee({
        date_of_joining: '2022-06-01',
        employment_type: 'FULL_TIME',
        manager_id: null,
        phone: null,
        version: 5,
        is_active: false,
        created_at: '2022-06-01T09:00:00Z',
        updated_at: '2026-01-02T10:30:00Z',
      }),
    })
    renderPage()

    await screen.findByRole('heading', { name: 'Priya Raman' })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('shows no Edit action for a Manager or an Employee', async () => {
    setRole('MANAGER', 2)
    getMock.mockResolvedValue({
      view_kind: 'TEAM',
      employee: makeEmployee({
        date_of_joining: '2022-06-01',
        employment_type: 'FULL_TIME',
        manager_id: 2,
      }),
    })
    renderPage()

    await screen.findByRole('heading', { name: 'Priya Raman' })
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('shows Employee unavailable with a link back for a missing record', async () => {
    getMock.mockRejectedValue(new ApiError(404, 'not_found', 'Not found.'))
    renderPage()

    expect(await screen.findByText('Employee unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to employees' })).toHaveAttribute(
      'href',
      '/employees',
    )
  })

  it('shows Employee unavailable for an id that is not a number, without a request', async () => {
    renderPage('/employees/abc')

    expect(await screen.findByText('Employee unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to employees' })).toHaveAttribute(
      'href',
      '/employees',
    )
    expect(getMock).not.toHaveBeenCalled()
  })

  it('shows a loading placeholder while the record loads', () => {
    getMock.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading employee…')
    expect(screen.queryByRole('heading', { name: 'Information' })).not.toBeInTheDocument()
  })

  it('shows an error notice with Retry that loads the record again', async () => {
    getMock.mockRejectedValueOnce(
      new ApiError(503, 'unavailable', 'The service is temporarily unavailable. Try again.'),
    )
    getMock.mockResolvedValueOnce({ view_kind: 'DIRECTORY', employee: makeEmployee() })
    const user = userEvent.setup()
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The service is temporarily unavailable. Try again.')

    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Priya Raman' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

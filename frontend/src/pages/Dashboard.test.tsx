import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, type User } from '../api'
import { useAuth } from '../auth'
import { Dashboard } from './Dashboard'

vi.mock('../auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  }
})

const mockedUseAuth = vi.mocked(useAuth)
const mockedGet = vi.mocked(api.get)

function userFor(role: User['role']): User {
  return {
    id: 1,
    email: `${role.toLowerCase()}@demo.test`,
    role,
    employee_id: 1,
    full_name: 'Avery Stone',
  }
}

function renderDashboard(role: User['role']) {
  mockedUseAuth.mockReturnValue({
    user: userFor(role),
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
  })
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the Administrator summary cards and the Open Employees action', async () => {
    mockedGet.mockResolvedValue({
      role: 'ADMIN',
      total_employees: 6,
      active_employees: 5,
      inactive_employees: 1,
    })

    renderDashboard('ADMIN')

    expect(screen.getByRole('heading', { name: 'Hello, Avery Stone' })).toBeInTheDocument()
    expect(await screen.findByText('Total records')).toBeInTheDocument()
    expect(screen.getByText('Active records')).toBeInTheDocument()
    expect(screen.getByText('Inactive records')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    const action = screen.getByRole('link', { name: 'Open Employees' })
    expect(action).toHaveAttribute('href', '/employees')
    expect(mockedGet).toHaveBeenCalledWith('/dashboard')
  })

  it('shows the Manager cards and the direct reports action without a company total', async () => {
    mockedGet.mockResolvedValue({
      role: 'MANAGER',
      direct_report_count: 3,
      department: 'Engineering',
      job_title: 'Engineering Manager',
    })

    renderDashboard('MANAGER')

    expect(await screen.findByText('Active direct reports')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('Engineering Manager')).toBeInTheDocument()
    expect(screen.queryByText('Total records')).not.toBeInTheDocument()

    const action = screen.getByRole('link', { name: 'Open my direct reports' })
    expect(action).toHaveAttribute('href', '/employees?team_only=true')
  })

  it('shows the Employee cards and the My Profile action without a company total', async () => {
    mockedGet.mockResolvedValue({
      role: 'EMPLOYEE',
      department: 'Engineering',
      job_title: 'Software Engineer',
      is_active: true,
    })

    renderDashboard('EMPLOYEE')

    expect(await screen.findByText('Department')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.queryByText('Total records')).not.toBeInTheDocument()

    const action = screen.getByRole('link', { name: 'Open My Profile' })
    expect(action).toHaveAttribute('href', '/my-profile')
  })

  it('shows skeleton placeholders while the figures load', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))

    const { container } = renderDashboard('ADMIN')

    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(3)
    expect(screen.queryByText('Total records')).not.toBeInTheDocument()
  })

  it('shows an error notice whose Retry sends the request again', async () => {
    mockedGet.mockRejectedValueOnce(
      new ApiError(503, 'unavailable', 'The service is temporarily unavailable. Try again.'),
    )
    mockedGet.mockResolvedValueOnce({
      role: 'ADMIN',
      total_employees: 6,
      active_employees: 5,
      inactive_employees: 1,
    })

    renderDashboard('ADMIN')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The service is temporarily unavailable. Try again.')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByText('Total records')).toBeInTheDocument())
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })
})

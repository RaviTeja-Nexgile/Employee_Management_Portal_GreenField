import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  SESSION_HINT_COOKIE,
  clearSessionHint,
  getCsrfToken,
  hasSessionHint,
  markSessionStarted,
  onUnauthorized,
  probeSession,
  setCsrfToken,
} from '../api'
import { useAuth } from '../auth'
import { Login } from './Login'

vi.mock('../auth', () => ({
  useAuth: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)

const ADMIN_USER = {
  id: 1,
  email: 'admin@demo.test',
  role: 'ADMIN' as const,
  employee_id: 1,
  full_name: 'Ada Administrator',
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<h1>Dashboard screen</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  const signIn = vi.fn()
  useAuthMock.mockReturnValue({
    user: null,
    loading: false,
    signIn,
    signOut: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  })
  return { signIn }
}

describe('Login page', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('shows the email, password, Show password control and Sign in button', () => {
    mockAuth()
    renderLogin()

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })

  it('has no sign-up, role selector or password-reset control', () => {
    mockAuth()
    renderLogin()

    expect(screen.queryByRole('link', { name: /sign up|register|create account/i })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('link', { name: /forgot|reset/i })).toBeNull()
  })

  it('shows a text error beside each empty field and sends no request', async () => {
    const { signIn } = mockAuth()
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('toggles the password between hidden and shown', async () => {
    mockAuth()
    const user = userEvent.setup()
    renderLogin()

    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('signs in and opens the dashboard', async () => {
    const { signIn } = mockAuth()
    signIn.mockResolvedValue(ADMIN_USER)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'admin@demo.test')
    await user.type(screen.getByLabelText('Password'), 'DemoOnly-Admin-2026!')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard screen' })).toBeInTheDocument()
    })
    expect(signIn).toHaveBeenCalledWith('admin@demo.test', 'DemoOnly-Admin-2026!')
  })

  it('disables the button and shows a submitting indicator while the answer is pending', async () => {
    const { signIn } = mockAuth()
    let resolveSignIn: (value: typeof ADMIN_USER) => void = () => {}
    signIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve
        }),
    )
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'admin@demo.test')
    await user.type(screen.getByLabelText('Password'), 'DemoOnly-Admin-2026!')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const button = screen.getByRole('button', { name: /Signing in/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    resolveSignIn(ADMIN_USER)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard screen' })).toBeInTheDocument()
    })
  })

  it('shows the shared message and stays on the page when the credentials are rejected', async () => {
    const { signIn } = mockAuth()
    signIn.mockRejectedValue(
      new ApiError(401, 'unauthorized', 'Email or password is incorrect.'),
    )
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'nobody@demo.test')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(screen.queryByRole('heading', { name: 'Dashboard screen' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('redirects a signed-in person to the dashboard', () => {
    mockAuth({ user: ADMIN_USER })
    renderLogin()

    expect(screen.getByRole('heading', { name: 'Dashboard screen' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).toBeNull()
  })
})

describe('session probe', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  function clearCookies() {
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0].trim()
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
  }

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setCsrfToken(null)
    onUnauthorized(null)
    clearCookies()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCookies()
  })

  it('sends no request at all when the person is signed out', async () => {
    expect(hasSessionHint()).toBe(false)

    await expect(probeSession('/auth/me')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('records a readable hint on sign-in, since the session cookie is HttpOnly', () => {
    expect(hasSessionHint()).toBe(false)
    markSessionStarted()
    expect(hasSessionHint()).toBe(true)
    expect(document.cookie).toContain(`${SESSION_HINT_COOKIE}=`)
  })

  it('forgets the hint on sign-out', () => {
    markSessionStarted()
    expect(hasSessionHint()).toBe(true)
    clearSessionHint()
    expect(hasSessionHint()).toBe(false)
  })

  it('restores the session after a page load when the hint is present', async () => {
    markSessionStarted()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: ADMIN_USER, csrf_token: 'csrf-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(probeSession('/auth/me')).resolves.toEqual({
      user: ADMIN_USER,
      csrf_token: 'csrf-123',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('resolves a stale 401 to null and drops the hint', async () => {
    markSessionStarted()
    const handler = vi.fn()
    onUnauthorized(handler)
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'unauthorized', message: 'Email or password is incorrect.' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(probeSession('/auth/me')).resolves.toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(getCsrfToken()).toBeNull()
    expect(hasSessionHint()).toBe(false)
  })

  it('still reports a server failure as an error', async () => {
    markSessionStarted()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'unavailable', message: 'The service is temporarily unavailable. Try again.' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(probeSession('/auth/me')).rejects.toMatchObject({ status: 503 })
  })
})

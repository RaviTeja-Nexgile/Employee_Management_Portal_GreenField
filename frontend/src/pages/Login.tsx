// The Login page: a centered card with the wordmark, the email and password
// fields, a Show/Hide password control, a full-width Sign in button, field
// errors for empty values, the shared "Email or password is incorrect."
// message, the submitting state and the redirect of a signed-in person.

import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/Button'
import styles from './Login.module.css'

const INVALID_CREDENTIALS = 'Email or password is incorrect.'

interface FieldErrors {
  email?: string
  password?: string
}

export function Login() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (!email.trim()) errors.email = 'Enter your email address.'
    if (!password) errors.password = 'Enter your password.'
    return errors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const errors = validate()
    setFieldErrors(errors)
    setFormError(null)
    if (errors.email || errors.password) {
      return
    }

    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError(INVALID_CREDENTIALS)
      } else if (error instanceof ApiError && error.status === 422) {
        setFieldErrors({
          email: error.fields.email,
          password: error.fields.password,
        })
      } else {
        setFormError(
          error instanceof ApiError
            ? error.message
            : 'The service is temporarily unavailable. Try again.',
        )
      }
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            EMS
          </span>
          <span className={styles.wordmark}>Employee Management</span>
        </div>

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to continue.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {formError ? (
            <div className={`notice notice--error ${styles.formError}`} role="alert">
              {formError}
            </div>
          ) : null}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              className={`${styles.input}${fieldErrors.email ? ` ${styles.inputInvalid}` : ''}`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              disabled={submitting}
            />
            {fieldErrors.email ? (
              <p className={styles.fieldError} id="login-email-error">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">
              Password
            </label>
            <div className={styles.passwordRow}>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={`${styles.input}${fieldErrors.password ? ` ${styles.inputInvalid}` : ''}`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                disabled={submitting}
              />
              <button
                type="button"
                className={styles.toggle}
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={submitting}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className={styles.fieldError} id="login-password-error">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <Button type="submit" fullWidth loading={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>

      <p className={styles.demoNote}>
        Local demo accounts: <code>admin@demo.test</code>, <code>manager@demo.test</code> and{' '}
        <code>employee@demo.test</code>.
      </p>
    </div>
  )
}

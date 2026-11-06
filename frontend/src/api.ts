// One small same-origin fetch helper: credentials, CSRF header, the
// X-EMS-Request header, error parsing and 401 handling.

export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

export interface User {
  id: number
  email: string
  role: Role
  employee_id: number
  full_name: string
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type UnauthorizedHandler = () => void

let csrfToken: string | null = null
let unauthorizedHandler: UnauthorizedHandler | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export function getCsrfToken(): string | null {
  return csrfToken
}

export function onUnauthorized(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = path.startsWith('/api') ? path : `/api${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue
    params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `${url}?${search}` : url
}

interface RawResponse {
  status: number
  ok: boolean
  payload: unknown
}

async function send(path: string, options: RequestOptions = {}): Promise<RawResponse> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-EMS-Request': '1',
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (method !== 'GET' && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError(0, 'network_error', 'The service is temporarily unavailable. Try again.')
  }

  if (response.status === 401) {
    csrfToken = null
    if (unauthorizedHandler) unauthorizedHandler()
  }

  if (response.status === 204) {
    return { status: 204, ok: true, payload: undefined }
  }

  let payload: unknown = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  return { status: response.status, ok: response.ok, payload }
}

function toApiError({ status, payload }: RawResponse): ApiError {
  const body = payload as ApiErrorBody | null
  const error = body?.error
  return new ApiError(
    status,
    error?.code ?? 'error',
    error?.message ?? 'Something went wrong. Try again.',
    error?.fields ?? {},
  )
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await send(path, options)
  if (!result.ok) throw toApiError(result)
  return result.payload as T
}

/**
 * Read the current session without treating a signed-out answer as a failure.
 *
 * `GET /api/auth/me` answers 401 to a person who is not signed in, which is the
 * normal answer on the Login page. A 401 is still a failed request in the
 * browser, so the probe first checks whether a session could exist at all: with
 * no session hint there is nothing to restore and no request is sent. When a
 * hint is present the probe still clears the CSRF token and notifies the 401
 * handler, but resolves to `null` instead of throwing.
 */
export async function probeSession<T>(path: string): Promise<T | null> {
  if (!hasSessionHint()) return null
  const result = await send(path, { method: 'GET' })
  if (result.status === 401) {
    clearSessionHint()
    return null
  }
  if (!result.ok) throw toApiError(result)
  return result.payload as T
}

/**
 * Return True when a page load should ask the API who is signed in.
 *
 * The session cookie is HttpOnly, so page script cannot see it. The readable
 * hint is set on sign-in and cleared on sign-out and on a 401, so its absence
 * means no session was started in this browser and the request would only
 * answer 401 — a failed request on the Login page. A page load therefore asks
 * only when the hint is present.
 */
export function shouldProbeSession(): boolean {
  return hasSessionHint()
}

/** The session cookie the API sets on sign-in. */
export const SESSION_COOKIE = 'ems_session'

/**
 * The readable marker the app sets beside the session cookie.
 *
 * The session cookie itself is HttpOnly, so page script cannot see it. This
 * marker holds no secret: it only records that a session was started in this
 * browser, so a page load can decide whether asking `GET /api/auth/me` is
 * worthwhile. It is cleared on sign-out and on a 401.
 */
export const SESSION_HINT_COOKIE = 'ems_session_hint'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}

/** Record that a session was started, so the next page load restores it. */
export function markSessionStarted(): void {
  // Eight hours, matching the server-side session lifetime.
  writeCookie(SESSION_HINT_COOKIE, '1', 8 * 60 * 60)
}

/** Forget the session hint, after sign-out or a 401. */
export function clearSessionHint(): void {
  writeCookie(SESSION_HINT_COOKIE, '', 0)
}

/**
 * Return True when the browser may hold a session.
 *
 * The HttpOnly session cookie cannot be read from page script, so the readable
 * hint cookie is checked instead. A signed-out person has no hint, so the app
 * sends no session request at all and the Login page loads without a failed
 * request.
 */
export function hasSessionHint(): boolean {
  return readCookie(SESSION_HINT_COOKIE) !== null
}

/**
 * Return True when the browser holds the session cookie.
 *
 * The cookie is HttpOnly, so its value cannot be read; only its presence is
 * checked, and page script cannot see it at all. Kept for callers that only
 * need to know whether a session cookie was ever set.
 */
export function hasSessionCookie(): boolean {
  return readCookie(SESSION_COOKIE) !== null
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
}

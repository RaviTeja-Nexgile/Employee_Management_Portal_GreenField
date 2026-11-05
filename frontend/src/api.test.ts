import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  api,
  getCsrfToken,
  onUnauthorized,
  request,
  setCsrfToken,
} from './api'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api helper', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setCsrfToken(null)
    onUnauthorized(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the request header and same-origin credentials on a GET', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))
    const result = await api.get<{ ok: boolean }>('/health')

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/health')
    expect(init.credentials).toBe('same-origin')
    expect(init.headers['X-EMS-Request']).toBe('1')
    expect(init.headers['X-CSRF-Token']).toBeUndefined()
  })

  it('sends the CSRF token and JSON body on an unsafe request', async () => {
    setCsrfToken('csrf-123')
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    await api.post('/auth/logout', {})

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['X-CSRF-Token']).toBe('csrf-123')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{}')
  })

  it('builds the query string and skips empty values', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [] }))

    await api.get('/employees', { q: 'ann', page: 2, team_only: undefined, empty: '' })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/employees?q=ann&page=2')
  })

  it('turns an error answer into an ApiError with its fields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        error: {
          code: 'validation_error',
          message: 'Please check the highlighted fields.',
          fields: { work_email: 'Enter a valid email address.' },
        },
      }),
    )

    await expect(api.post('/employees', {})).rejects.toMatchObject({
      status: 422,
      code: 'validation_error',
      message: 'Please check the highlighted fields.',
      fields: { work_email: 'Enter a valid email address.' },
    })
  })

  it('clears the signed-in state and calls the handler on 401', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)
    setCsrfToken('csrf-123')
    fetchMock.mockResolvedValue(
      jsonResponse(401, {
        error: { code: 'unauthorized', message: 'Email or password is incorrect.' },
      }),
    )

    await expect(request('/dashboard')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(getCsrfToken()).toBeNull()
  })

  it('returns undefined for a 204 answer', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api.post('/auth/logout', {})).resolves.toBeUndefined()
  })

  it('reports a network failure with the shared message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.get('/dashboard')).rejects.toMatchObject({
      code: 'network_error',
      message: 'The service is temporarily unavailable. Try again.',
    })
  })
})

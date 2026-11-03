const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://10.195.49.18:3001').replace(/\/$/, '')
const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000)
let authToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('fx-auth-token') || '' : ''

export function setAuthToken(token) {
  authToken = typeof token === 'string' ? token.trim() : ''
  if (typeof sessionStorage !== 'undefined') {
    if (authToken) sessionStorage.setItem('fx-auth-token', authToken)
    else sessionStorage.removeItem('fx-auth-token')
  }
}

export function clearAuthToken() {
  setAuthToken('')
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Shared HTTP client. Never put privileged secrets in browser environment variables. */
export async function apiRequest(path, { method = 'GET', headers = {}, body, signal, ...options } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    const response = await fetch(`${baseUrl}/${String(path).replace(/^\/+/, '')}`, {
      ...options,
      credentials: 'include',
      method,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined || (typeof FormData !== 'undefined' && body instanceof FormData) ? {} : { 'Content-Type': 'application/json' }), ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...headers },
      ...(body === undefined ? {} : { body: typeof body === 'string' || (typeof FormData !== 'undefined' && body instanceof FormData) ? body : JSON.stringify(body) }),
    })
    if (response.status === 204) return null
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json') ? await response.json() : await response.text()
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && payload.message ? payload.message : `Request failed (${response.status})`
      throw new ApiError(message, { status: response.status, code: payload?.code || 'HTTP_ERROR', details: payload })
    }
    return payload
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error?.name === 'AbortError') throw new ApiError('The request timed out or was cancelled.', { code: 'REQUEST_ABORTED' })
    throw new ApiError('Unable to reach the API. Check your connection and try again.', { code: 'NETWORK_ERROR' })
  } finally {
    clearTimeout(timer)
  }
}

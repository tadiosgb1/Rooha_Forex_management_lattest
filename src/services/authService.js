import { apiRequest } from './apiClient'
export const authService = {
  login: (credentials) => apiRequest('auth/login', { method: 'POST', body: credentials }),
  logout: () => apiRequest('auth/logout', { method: 'POST' }),
  me: () => apiRequest('auth/me'),
  refresh: () => apiRequest('auth/refresh', { method: 'POST' }),
}

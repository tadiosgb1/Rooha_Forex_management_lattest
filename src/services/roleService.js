import { apiRequest } from './apiClient'

export const roleService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `roles?${query}` : 'roles')
  },
  get: (id) => apiRequest(`roles/${encodeURIComponent(id)}`),
  create: (payload) => apiRequest('roles', { method: 'POST', body: payload }),
  update: (id, payload) => apiRequest(`roles/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  remove: (id) => apiRequest(`roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

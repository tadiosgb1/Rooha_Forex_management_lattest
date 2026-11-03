import { apiRequest } from './apiClient'

export const permissionService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `permissions?${query}` : 'permissions')
  },
  get: (id) => apiRequest(`permissions/${encodeURIComponent(id)}`),
  create: (payload) => apiRequest('permissions', { method: 'POST', body: payload }),
  update: (id, payload) => apiRequest(`permissions/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  remove: (id) => apiRequest(`permissions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

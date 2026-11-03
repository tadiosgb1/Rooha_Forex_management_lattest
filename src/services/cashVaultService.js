import { apiRequest } from './apiClient'

const endpoint = 'cash-vaults'

export const cashVaultService = {
  openTillSession: (payload) => apiRequest('till-sessions/open', { method: 'POST', body: payload }),
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `${endpoint}?${query}` : endpoint)
  },
  get: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`),
  create: (payload) => apiRequest(endpoint, { method: 'POST', body: payload }),
  update: (id, payload) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  approve: (id, payload = {}) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/approve`, { method: 'PATCH', body: payload }),
  reject: (id, payload = {}) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/reject`, { method: 'PATCH', body: payload }),
  reactivate: (id, payload = {}) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/reactivate`, { method: 'PATCH', body: payload }),
  suspend: (id, payload = {}) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/suspend`, { method: 'PATCH', body: payload }),
  close: (id, payload = {}) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/close`, { method: 'PATCH', body: payload }),
  remove: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

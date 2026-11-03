import { apiRequest } from './apiClient'

const endpoint = 'vault-transfers'

export const vaultTransferService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `${endpoint}?${query}` : endpoint)
  },
  get: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`),
  create: (payload) => apiRequest(endpoint, { method: 'POST', body: payload }),
  approve: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/approve`, { method: 'PATCH', body: {} }),
  reject: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/reject`, { method: 'PATCH', body: {} }),
}

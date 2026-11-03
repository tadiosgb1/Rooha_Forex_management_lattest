import { apiRequest } from './apiClient'

const endpoint = 'exchange-rates'

export const rateService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `${endpoint}?${query}` : endpoint)
  },
  latest: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `${endpoint}/latest?${query}` : `${endpoint}/latest`)
  },
  get: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`),
  create: (payload) => apiRequest(endpoint, { method: 'POST', body: payload }),
  update: (id, payload) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  approve: (id, payload) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/approve`, { method: 'PATCH', body: payload }),
  reject: (id, payload) => apiRequest(`${endpoint}/${encodeURIComponent(id)}/reject`, { method: 'PATCH', body: payload }),
  remove: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

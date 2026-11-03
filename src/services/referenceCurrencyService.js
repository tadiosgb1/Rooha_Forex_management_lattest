import { apiRequest } from './apiClient'

const endpoint = 'reference-currencies'

export const referenceCurrencyService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `${endpoint}?${query}` : endpoint)
  },
  get: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`),
  create: (payload) => apiRequest(endpoint, { method: 'POST', body: payload }),
  update: (id, payload) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  remove: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

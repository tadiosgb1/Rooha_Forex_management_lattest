import { apiRequest } from './apiClient'
export const customerService = {
  list: (params = {}) => apiRequest(`customers?${new URLSearchParams(params)}`),
  get: (id) => apiRequest(`customers/${encodeURIComponent(id)}`),
  create: (customer) => apiRequest('customers', { method: 'POST', body: customer }),
  update: (id, patch) => apiRequest(`customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
}

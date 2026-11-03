import { apiRequest } from './apiClient'
export const reconciliationService = {
  list: (params = {}) => apiRequest(`reconciliations?${new URLSearchParams(params)}`),
  get: (id) => apiRequest(`reconciliations/${encodeURIComponent(id)}`),
  submitCount: (id, count) => apiRequest(`reconciliations/${encodeURIComponent(id)}/counts`, { method: 'POST', body: count }),
  resolveVariance: (id, resolution) => apiRequest(`reconciliations/${encodeURIComponent(id)}/resolution`, { method: 'POST', body: resolution }),
}

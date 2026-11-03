import { apiRequest } from './apiClient'

const endpoint = 'forex-transactions'

export const forexTransactionService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `${endpoint}?${query}` : endpoint)
  },
  get: (id) => apiRequest(`${endpoint}/${encodeURIComponent(id)}`),
  create: (payload) => apiRequest(endpoint, { method: 'POST', body: payload }),
}

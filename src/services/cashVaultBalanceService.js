import { apiRequest } from './apiClient'

const endpoint = 'cash-vault-balances'

export const cashVaultBalanceService = {
  list(params = {}) {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? endpoint + '?' + query : endpoint)
  },
  get(id) {
    return apiRequest(`${endpoint}/${encodeURIComponent(id)}`)
  },
  create(payload) {
    return apiRequest(endpoint, { method: 'POST', body: payload })
  },
  update(id, payload) {
    return apiRequest(`${endpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
  },
}

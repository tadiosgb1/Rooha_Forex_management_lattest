import { apiRequest } from './apiClient'
export const treasuryService = {
  balances: () => apiRequest('treasury/balances'),
  transfers: (params = {}) => apiRequest(`treasury/transfers?${new URLSearchParams(params)}`),
  createTransfer: (transfer) => apiRequest('treasury/transfers', { method: 'POST', body: transfer }),
  submitTillCount: (count) => apiRequest('treasury/till-counts', { method: 'POST', body: count }),
}

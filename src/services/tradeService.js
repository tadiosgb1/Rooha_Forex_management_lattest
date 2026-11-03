import { apiRequest } from './apiClient'
export const tradeService = {
  list: (params = {}) => apiRequest(`trades?${new URLSearchParams(params)}`),
  get: (id) => apiRequest(`trades/${encodeURIComponent(id)}`),
  create: (trade, idempotencyKey) => apiRequest('trades', { method: 'POST', body: trade, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} }),
  submitForApproval: (id) => apiRequest(`trades/${encodeURIComponent(id)}/submit`, { method: 'POST' }),
  reverse: (id, reason) => apiRequest(`trades/${encodeURIComponent(id)}/reversals`, { method: 'POST', body: { reason } }),
}

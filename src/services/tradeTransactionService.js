import { apiRequest } from './apiClient'

const EP = 'trade-transactions'

/**
 * trade-transactions API service
 *
 * POST   /trade-transactions              create()
 * GET    /trade-transactions              list(params)
 * GET    /trade-transactions/:id          get(id)
 * POST   /trade-transactions/:id/approve  approve(id)
 * POST   /trade-transactions/:id/reject   reject(id, reason)
 * POST   /trade-transactions/:id/reverse  reverse(id, reason)
 */
export const tradeTransactionService = {
  create(payload) {
    return apiRequest(EP, { method: 'POST', body: payload })
  },

  list(params = {}) {
    const q = new URLSearchParams(params).toString()
    return apiRequest(q ? `${EP}?${q}` : EP)
  },

  get(id) {
    return apiRequest(`${EP}/${encodeURIComponent(id)}`)
  },

  approve(id) {
    return apiRequest(`${EP}/${encodeURIComponent(id)}/approve`, { method: 'POST' })
  },

  reject(id, reason = '') {
    return apiRequest(`${EP}/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: { reason },
    })
  },

  reverse(id, reason = '') {
    return apiRequest(`${EP}/${encodeURIComponent(id)}/reverse`, {
      method: 'POST',
      body: { reason },
    })
  },
}

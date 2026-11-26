import { apiRequest } from './apiClient'

const EP = 'bank-accounts'

/**
 * Bank Accounts API service
 *
 * POST   /bank-accounts                                create()
 * GET    /bank-accounts                                list()
 * GET    /bank-accounts/summary                        summary()
 * GET    /bank-accounts/:id                            get(id)
 * PATCH  /bank-accounts/:id                            update(id, payload)
 * GET    /bank-accounts/:id/transactions               transactions(id, params)
 * POST   /bank-accounts/:id/deposits                   deposit(id, payload)
 * POST   /bank-accounts/:id/withdrawals                withdraw(id, payload)
 * POST   /bank-accounts/transactions/:txId/approve     approve(txId)
 * POST   /bank-accounts/transactions/:txId/reject      reject(txId, reason)
 */
export const bankAccountService = {
  create(payload) {
    return apiRequest(EP, { method: 'POST', body: payload })
  },

  list(params = {}) {
    const q = new URLSearchParams(params).toString()
    return apiRequest(q ? `${EP}?${q}` : EP)
  },

  summary() {
    return apiRequest(`${EP}/summary`)
  },

  get(id) {
    return apiRequest(`${EP}/${encodeURIComponent(id)}`)
  },

  update(id, payload) {
    return apiRequest(`${EP}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
  },

  transactions(id, params = {}) {
    const q = new URLSearchParams(params).toString()
    return apiRequest(q
      ? `${EP}/${encodeURIComponent(id)}/transactions?${q}`
      : `${EP}/${encodeURIComponent(id)}/transactions`
    )
  },

  deposit(id, payload) {
    return apiRequest(`${EP}/${encodeURIComponent(id)}/deposits`, { method: 'POST', body: payload })
  },

  withdraw(id, payload) {
    return apiRequest(`${EP}/${encodeURIComponent(id)}/withdrawals`, { method: 'POST', body: payload })
  },

  approveTransaction(txId) {
    return apiRequest(`${EP}/transactions/${encodeURIComponent(txId)}/approve`, { method: 'POST' })
  },

  rejectTransaction(txId, reason) {
    return apiRequest(`${EP}/transactions/${encodeURIComponent(txId)}/reject`, {
      method: 'POST',
      body: { reason },
    })
  },
}

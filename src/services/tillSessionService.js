import { apiRequest } from './apiClient'

const endpoint = 'till-sessions'

export const tillSessionService = {
  listBalances: (sessionId) => apiRequest(`till-session-balances?session_id=${encodeURIComponent(sessionId)}`),
  createBalance: (payload) => apiRequest('till-session-balances', {
    method: 'POST',
    body: payload,
  }),
  close: (sessionId, payload) => apiRequest(`${endpoint}/${encodeURIComponent(sessionId)}/close`, {
    method: 'POST',
    body: payload,
  }),
  reconcile: (sessionId) => apiRequest(`${endpoint}/${encodeURIComponent(sessionId)}/reconcile`, {
    method: 'POST',
    body: {},
  }),
  list: (params = {}) => {
    const queryParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )
    const query = new URLSearchParams(queryParams).toString()
    return apiRequest(query ? endpoint + '?' + query : endpoint)
  },
}

import { apiRequest } from './apiClient'
export const reportService = {
  dashboard: (params = {}) => apiRequest(`reports/dashboard?${new URLSearchParams(params)}`),
  transactions: (params = {}) => apiRequest(`reports/transactions?${new URLSearchParams(params)}`),
  auditEvents: (params = {}) => apiRequest(`audit-events?${new URLSearchParams(params)}`),
}

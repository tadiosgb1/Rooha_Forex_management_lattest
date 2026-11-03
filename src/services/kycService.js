import { apiRequest } from './apiClient'

// KYC operations are keyed by customer profile ID, not the KYC document record ID.
const byCustomerProfileId = (id) => `kyc/${encodeURIComponent(id)}`

function toMultipart(payload) {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null && value !== '') form.append(key, value)
  }
  return form
}

export const kycService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `kyc?${query}` : 'kyc')
  },
  get: (customerProfileId) => apiRequest(byCustomerProfileId(customerProfileId)),
  create: (payload) => apiRequest('kyc', { method: 'POST', body: toMultipart(payload) }),
  update: (customerProfileId, payload) => apiRequest(byCustomerProfileId(customerProfileId), { method: 'PATCH', body: toMultipart(payload) }),
  remove: (customerProfileId) => apiRequest(byCustomerProfileId(customerProfileId), { method: 'DELETE' }),
  verify: (customerProfileId) => apiRequest(`${byCustomerProfileId(customerProfileId)}/verify`, { method: 'PATCH', body: {} }),
  unverify: (customerProfileId) => apiRequest(`${byCustomerProfileId(customerProfileId)}/unverify`, { method: 'PATCH', body: {} }),
}

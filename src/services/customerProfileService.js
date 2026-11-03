import { apiRequest } from './apiClient'

const collection = 'customer-profiles'
const byId = (id) => `${collection}/${encodeURIComponent(id)}`

function assertSuccess(response, fallbackMessage) {
  if (response?.status && response.status !== 'success') {
    throw new Error(response.message || fallbackMessage)
  }
  return response
}

export const customerProfileService = {
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString()
    const response = await apiRequest(query ? `${collection}?${query}` : collection)
    return assertSuccess(response, 'Unable to load customer profiles.')
  },
  get: async (id) => {
    const response = await apiRequest(byId(id))
    return assertSuccess(response, 'Unable to load this customer profile.')
  },
  create: async (payload) => assertSuccess(
    await apiRequest(collection, { method: 'POST', body: payload }),
    'Unable to create customer profile.',
  ),
  update: async (id, payload) => assertSuccess(
    await apiRequest(byId(id), { method: 'PATCH', body: payload }),
    'Unable to update customer profile.',
  ),
  remove: async (id) => assertSuccess(
    await apiRequest(byId(id), { method: 'DELETE' }),
    'Unable to delete customer profile.',
  ),
}

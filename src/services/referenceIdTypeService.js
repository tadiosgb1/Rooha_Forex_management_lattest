import { apiRequest } from './apiClient'

const collection = 'reference-id-types'
const byCode = (code) => `${collection}/${encodeURIComponent(code)}`

export const referenceIdTypeService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(query ? `${collection}?${query}` : collection)
  },
  get: (code) => apiRequest(byCode(code)),
  create: (payload) => apiRequest(collection, { method: 'POST', body: payload }),
  update: (code, payload) => {
    const { code: _immutableCode, ...updatePayload } = payload
    return apiRequest(byCode(code), { method: 'PATCH', body: updatePayload })
  },
  remove: (code) => apiRequest(byCode(code), { method: 'DELETE' }),
}

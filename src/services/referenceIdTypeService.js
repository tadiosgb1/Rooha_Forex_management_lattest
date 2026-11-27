import { apiRequest } from './apiClient'

const EP = 'reference-id-types'

export const referenceIdTypeService = {
  list()              { return apiRequest(EP) },
  get(code)           { return apiRequest(`${EP}/${encodeURIComponent(code)}`) },
  create(payload)     { return apiRequest(EP, { method: 'POST',  body: payload }) },
  update(code, patch) { return apiRequest(`${EP}/${encodeURIComponent(code)}`, { method: 'PATCH', body: patch }) },
  remove(code)        { return apiRequest(`${EP}/${encodeURIComponent(code)}`, { method: 'DELETE' }) },
}

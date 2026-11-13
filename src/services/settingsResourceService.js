import { apiRequest } from './apiClient'

function assertSuccess(response, fallback) {
  if (response?.status && response.status !== 'success') throw new Error(response.message || fallback)
  return response
}

export function unwrapResourceList(response, resource) {
  assertSuccess(response, `Unable to load ${resource}.`)
  let value = response?.data ?? response
  for (let i = 0; i < 2 && value && !Array.isArray(value) && typeof value === 'object'; i += 1) {
    if (Array.isArray(value.items)) value = value.items
    else if (Array.isArray(value.results)) value = value.results
    else if (Array.isArray(value.records)) value = value.records
    else if (value.data !== undefined) value = value.data
    else break
  }
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object' && (value.id != null || value._id != null || value.key != null)) return [value]
  throw new Error(response?.message || `Unexpected ${resource} response from server.`)
}

export async function listSettingsResource(resource) {
  return unwrapResourceList(await apiRequest(resource), resource)
}
export async function createSettingsResource(resource, payload) {
  return assertSuccess(await apiRequest(resource, { method: 'POST', body: payload }), `Unable to create ${resource} record.`)
}
export async function updateSettingsResource(resource, id, payload) {
  return assertSuccess(await apiRequest(`${resource}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }), `Unable to update ${resource} record.`)
}
export async function deleteSettingsResource(resource, id) {
  return assertSuccess(await apiRequest(`${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' }), `Unable to delete ${resource} record.`)
}

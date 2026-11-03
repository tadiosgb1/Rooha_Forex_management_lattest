import { apiRequest } from './apiClient'

function assertSuccess(response, fallbackMessage) {
  if (response?.status && response.status !== 'success') {
    throw new Error(response.message || fallbackMessage)
  }
  return response
}

export async function listBranches({ page = 1, pageSize = 10, search = '', sortBy = 'created_at', isActive = true } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search: search.trim(),
    sortBy,
    is_active: String(isActive),
  })
  const response = await apiRequest(`branches?${query.toString()}`)
  if (response?.status !== 'success' || !Array.isArray(response?.data)) {
    throw new Error(response?.message || 'The server returned an unexpected branches response.')
  }
  return response
}

export async function getBranch(id) {
  const response = await apiRequest(`branches/${encodeURIComponent(id)}`)
  assertSuccess(response, 'Unable to load this branch.')
  return response?.data ?? response
}

export async function createBranch(payload) {
  return assertSuccess(
    await apiRequest('branches', { method: 'POST', body: payload }),
    'The server could not create this branch.',
  )
}

export async function updateBranch(id, payload) {
  return assertSuccess(
    await apiRequest(`branches/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
    'The server could not update this branch.',
  )
}

export async function deleteBranch(id) {
  return assertSuccess(
    await apiRequest(`branches/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    'The server could not delete this branch.',
  )
}

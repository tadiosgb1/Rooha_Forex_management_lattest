import { apiRequest } from './apiClient'

export const userRoleService = {
  assign: (userId, roleId) => apiRequest('user-roles', {
    method: 'POST',
    body: { user_id: Number(userId), role_id: Number(roleId) },
  }),
  // Assumes the API supports DELETE /user-roles with this user/role pair.
  unassign: (userId, roleId) => apiRequest('user-roles', {
    method: 'DELETE',
    body: { user_id: Number(userId), role_id: Number(roleId) },
  }),
  listForUser: async (userId) => {
    try {
      return await apiRequest(`user-roles/user/${encodeURIComponent(userId)}/roles`)
    } catch (error) {
      if (error?.status === 404) return { status: 'success', count: 0, data: [] }
      throw error
    }
  },
}

import { apiRequest } from './apiClient'

export const rolePermissionService = {
  listForRole: async (roleId) => {
    try {
      return await apiRequest(`role-permissions/role/${encodeURIComponent(roleId)}/permissions`)
    } catch (error) {
      // The API uses 404 to mean that a role currently has no permissions.
      // Treat that as an empty assignment list so the system permissions can
      // still render unchecked and be selected for this role.
      const message = String(error?.message ?? '').toLowerCase()
      const detailMessage = String(error?.details?.message ?? '').toLowerCase()
      if (
        error?.status === 404 &&
        (message.includes('no permissions found for this role') ||
          detailMessage.includes('no permissions found for this role'))
      ) {
        return { status: 'success', count: 0, data: [] }
      }
      throw error
    }
  },
  updateForRole: (payload) => apiRequest('role-permissions/manage', { method: 'PATCH', body: payload }),
}

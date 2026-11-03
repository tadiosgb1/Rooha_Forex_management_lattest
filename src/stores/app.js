import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clearAuthToken } from '../services/apiClient'
import { savePermissions, clearPermissions } from '../utils/permissions'

export const useAppStore = defineStore('app', () => {
  const loginRole = ref('')
  const loginUser = ref(localStorage.getItem('fx-user-email') || '')
  const loginPassword = ref('')
  const userId = ref(localStorage.getItem('userId') || '')
  const authenticatedUser = ref(null)
  const session = ref(Boolean(localStorage.getItem('fx-session')))
  const page = ref('dashboard')

  function login(user) {
    if (!user || typeof user.email !== 'string') {
      throw new Error('A valid authenticated user is required.')
    }
    if (user.id === undefined || user.id === null || String(user.id).trim() === '') {
      throw new Error('The login response did not include a user ID.')
    }
    authenticatedUser.value = user
    savePermissions(user.permissions)
    userId.value = String(user.id)
    loginUser.value = user.email
    loginPassword.value = ''
    loginRole.value = Array.isArray(user.roles) ? user.roles.map((role) => typeof role === 'string' ? role : role?.name).filter(Boolean).join(', ') : ''
    session.value = true
    localStorage.setItem('userId', userId.value)
    localStorage.setItem('fx-user-email', user.email)
    localStorage.setItem('fx-session', 'active')
    localStorage.removeItem('fx-demo-session')
    page.value = 'dashboard'
  }

  function logout() {
    clearAuthToken()
    session.value = false
    authenticatedUser.value = null
    userId.value = ''
    loginUser.value = ''
    loginPassword.value = ''
    loginRole.value = ''
    localStorage.removeItem('userId')
    localStorage.removeItem('fx-user-email')
    localStorage.removeItem('fx-session')
    localStorage.removeItem('fx-demo-session')
    clearPermissions()
    page.value = 'dashboard'
  }

  function navigate(nextPage) {
    page.value = nextPage
  }

  return {
    loginRole,
    loginUser,
    loginPassword,
    userId,
    authenticatedUser,
    session,
    page,
    login,
    logout,
    navigate,
  }
})

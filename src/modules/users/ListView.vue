<script setup>
import { hasPermission, hasAnyPermission } from '../../utils/permissions'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../../services/apiClient'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import AssignRoleModal from './AssignRoleModal.vue'

const router = useRouter()
const users = ref([])
const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const currentPage = ref(1)
const pageSize = 10
const totalCount = ref(0)
const totalPages = ref(1)
const assignmentUser = ref(null)
const successMessage = ref('')

function roleNames(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : []
  return roles.map(role => role?.name).filter(Boolean).join(', ') || 'No roles assigned'
}
function dismissError() { errorMessage.value = '' }
function dismissSuccess() { successMessage.value = '' }

const filteredUsers = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return users.value
  return users.value.filter((user) =>
    [user.id, user.first_name, user.last_name, user.email, user.phone_number, user.branch_name, roleNames(user)]
      .some((value) => String(value ?? '').toLowerCase().includes(query)),
  )
})

async function loadUsers() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await apiRequest(`users?page=${currentPage.value}&page_size=${pageSize}`)
    if (response?.status !== 'success' || !Array.isArray(response?.data)) {
      throw new Error(response?.message || 'The server returned an unexpected users response.')
    }
    users.value = response.data
    totalCount.value = Number(response.count ?? response.data.length)
    totalPages.value = Math.max(1, Number(response.total_pages ?? 1))
    currentPage.value = Number(response.current_page ?? currentPage.value)
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load users.'
    users.value = []
  } finally {
    loading.value = false
  }
}

function changePage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === currentPage.value) return
  currentPage.value = nextPage
}
function openAssignRole(user) { assignmentUser.value = user }
function closeAssignRole() { assignmentUser.value = null }
function roleAssigned() {
  successMessage.value = 'Role assignment saved.'
  errorMessage.value = ''
  loadUsers()
}
watch(currentPage, loadUsers)
onMounted(loadUsers)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Users &amp; Roles</h2><p class="module-description">Manage registered platform users and assign their roles.</p></div>
      <BaseButton v-if="hasPermission('users:create')" class="module-primary-btn" @click="router.push('/users/new')">＋ Add User</BaseButton>
    </div>
    <div v-if="errorMessage" class="alert alert-danger users-inline-alert" role="alert" aria-live="assertive">
      <span>{{ errorMessage }}</span>
      <button type="button" class="users-alert-close" aria-label="Close error alert" @click="dismissError">×</button>
    </div>
    <div v-if="successMessage" class="alert alert-success users-inline-alert" role="status" aria-live="polite">
      <span>{{ successMessage }}</span>
      <button type="button" class="users-alert-close" aria-label="Close success alert" @click="dismissSuccess">×</button>
    </div>
    <div class="module-stat-row">
      <div class="module-stat-card"><span>Total users</span><strong>{{ totalCount }}</strong></div>
      <div class="module-stat-card"><span>Users on this page</span><strong>{{ users.length }}</strong></div>
      <div class="module-stat-card"><span>Page</span><strong>{{ currentPage }} / {{ totalPages }}</strong></div>
    </div>

    <section class="module-panel">
      <div class="module-panel-header">
        <h3>User register</h3>
        <label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search users..." aria-label="Search users" size="sm" /></label>
      </div>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead><tr><th>ID</th><th>First name</th><th>Last name</th><th>Email</th><th>Phone</th><th>Branch</th><th>Roles</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="9" class="module-empty-state">Loading users…</td></tr>
            <tr v-else-if="filteredUsers.length === 0"><td colspan="9" class="module-empty-state">{{ search ? 'No users match your search.' : 'No users found.' }}</td></tr>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>{{ user.id }}</td><td>{{ user.first_name || '—' }}</td><td>{{ user.last_name || '—' }}</td><td>{{ user.email || '—' }}</td><td>{{ user.phone_number || '—' }}</td><td>{{ user.branch_name || user.branch_id || '—' }}</td><td>{{ roleNames(user) }}</td>
              <td><span class="module-status-chip" :class="user.is_active ? 'active' : 'blocked'">{{ user.is_active ? 'Active' : 'Inactive' }}</span></td>
              <td class="module-row-actions"><button v-if="hasPermission('users:update')" @click="router.push(`/users/${encodeURIComponent(user.id)}/edit`)">Edit</button><button v-if="hasAnyPermission(['user-roles:assign', 'user-roles:revoke', 'user-roles:update'])" @click="openAssignRole(user)">Assign role</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">
        <span>Showing {{ filteredUsers.length }} of {{ totalCount }} users</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <BaseButton variant="secondary" size="sm" :disabled="loading || currentPage <= 1" @click="changePage(currentPage - 1)">Previous</BaseButton>
          <span>Page {{ currentPage }} of {{ totalPages }}</span>
          <BaseButton variant="secondary" size="sm" :disabled="loading || currentPage >= totalPages" @click="changePage(currentPage + 1)">Next</BaseButton>
        </div>
      </div>
    </section>
    <AssignRoleModal v-if="assignmentUser" :user="assignmentUser" @close="closeAssignRole" @saved="roleAssigned" />
  </section>
</template>

<style scoped>
.users-inline-alert { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin:12px 0 16px; padding:12px 16px; border:1px solid #f1aeb5; border-radius:6px; background:#f8d7da; color:#842029; font-size:.9rem; line-height:1.5; }
.users-inline-alert.alert-success { border-color:#a3cfbb; background:#d1e7dd; color:#0f5132; }
.users-alert-close { flex:0 0 auto; padding:0 2px; border:0; background:transparent; color:inherit; font-size:1.4rem; line-height:1; cursor:pointer; opacity:.7; }
.users-alert-close:hover { opacity:1; }
</style>

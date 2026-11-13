<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '../../composables/toast'
import { apiRequest } from '../../services/apiClient'
import { roleService } from '../../services/roleService'
import BaseButton from '../../components/ui/BaseButton.vue'

const router = useRouter()
const toast = useToast()
const loading = ref(false)
const branchesLoading = ref(false)
const errorMessage = ref('')
const branchError = ref('')
const branches = ref([])
const roles = ref([])
const rolesLoading = ref(false)
const roleError = ref('')
const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone_number: '',
  password: '',
  branch_id: '',
  role_id: '',
})

async function loadBranches() {
  branchesLoading.value = true
  branchError.value = ''
  try {
    const pageSize = 10
    const firstPage = await apiRequest('branches?page=1&pageSize=10&search=&sortBy=created_at')
    if (firstPage?.status !== 'success' || !Array.isArray(firstPage?.data)) {
      throw new Error(firstPage?.message || 'The server returned an unexpected branches response.')
    }

    const allBranches = [...firstPage.data]
    const totalPages = Math.max(1, Number(firstPage.total_pages ?? 1))
    for (let page = 2; page <= totalPages; page += 1) {
      const response = await apiRequest(`branches?page=${page}&pageSize=${pageSize}&search=&sortBy=created_at`)
      if (response?.status !== 'success' || !Array.isArray(response?.data)) {
        throw new Error(response?.message || `Unable to load branches page ${page}.`)
      }
      allBranches.push(...response.data)
    }

    branches.value = allBranches.filter((branch) => {
      if (!branch?.id || branch?.is_active === false) return false
      const status = String(branch?.status ?? '').trim().toUpperCase()
      if (status) return ['APPROVED', 'ACTIVE'].includes(status)
      return branch?.is_active === true
    })
  } catch (error) {
    branchError.value = error?.message || 'Unable to load active branches.'
    branches.value = []
  } finally {
    branchesLoading.value = false
  }
}


async function loadRoles() {
  rolesLoading.value = true
  roleError.value = ''
  try {
    const allRoles = new Map()
    for (let page = 1; page <= 100; page += 1) {
      const response = await roleService.list({ page, page_size: 100 })
      const rows = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.roles)
          ? response.roles
          : Array.isArray(response?.results)
            ? response.results
            : Array.isArray(response)
              ? response
              : []
      rows.forEach((role) => {
        const id = role?.id ?? role?.role_id
        if (id !== undefined && id !== null && String(id).trim() !== '') {
          allRoles.set(String(id), { ...role, id })
        }
      })
      if (rows.length < 100 || rows.length === 0) break
    }
    roles.value = [...allRoles.values()].sort((a, b) =>
      String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)),
    )
    if (roles.value.length === 0) throw new Error('No roles are available to assign.')
  } catch (error) {
    roleError.value = error?.message || 'Unable to load roles.'
    roles.value = []
  } finally {
    rolesLoading.value = false
  }
}

async function createUser() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    if (!roles.value.some((role) => String(role.id) === String(form.role_id))) {
      throw new Error('Please select a role.')
    }
    if (!branches.value.some((branch) => String(branch.id) === String(form.branch_id))) {
      throw new Error('Please select an active branch.')
    }
    const createdBy = localStorage.getItem('userId') || ''
    if (!createdBy) throw new Error('Your user ID was not found in local storage. Please sign in again.')
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim(),
      password: form.password,
      branch_id: form.branch_id,
      role_id: form.role_id,
      created_by: createdBy,
    }
    const response = await apiRequest('users', { method: 'POST', body: payload })
    if (response?.status && response.status !== 'success') {
      throw new Error(response?.message || 'The server could not create this user.')
    }
    toast.success('User created successfully.')
    router.push('/users')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to create user. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadBranches(); loadRoles() })
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Create User</h2><p class="module-description">Register a user with their contact details and branch/audit references.</p></div>
      <BaseButton variant="secondary" class="module-secondary-btn" @click="router.push('/users')">← Back to users</BaseButton>
    </div>

    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>User information</h3></div>
      <form @submit.prevent="createUser">
        <div class="module-form-grid">
          <label class="module-form-field"><span>First name <b>*</b></span><input v-model="form.first_name" class="ui-input" autocomplete="given-name" required /></label>
          <label class="module-form-field"><span>Last name <b>*</b></span><input v-model="form.last_name" class="ui-input" autocomplete="family-name" required /></label>
          <label class="module-form-field"><span>Email <b>*</b></span><input v-model="form.email" class="ui-input" type="email" autocomplete="email" required /></label>
          <label class="module-form-field"><span>Phone number <b>*</b></span><input v-model="form.phone_number" class="ui-input" type="tel" autocomplete="tel" placeholder="+251911234567" required /></label>
          <label class="module-form-field"><span>Password <b>*</b></span><input v-model="form.password" class="ui-input" type="password" autocomplete="new-password" required /></label>
          <label class="module-form-field">
            <span>Role <b>*</b></span>
            <select v-model="form.role_id" class="ui-input" required :disabled="rolesLoading || roles.length === 0">
              <option value="" disabled>{{ rolesLoading ? 'Loading roles…' : 'Select a role' }}</option>
              <option v-for="role in roles" :key="role.id" :value="String(role.id)">{{ role.name || `Role #${role.id}` }}</option>
            </select>
            <small v-if="roleError" role="alert" style="color:#b43f4a;">{{ roleError }}</small>
          </label>
          <label class="module-form-field">
            <span>Branch <b>*</b></span>
            <select v-model="form.branch_id" class="ui-input" required :disabled="branchesLoading || branches.length === 0">
              <option value="" disabled>{{ branchesLoading ? 'Loading active branches…' : 'Select a branch' }}</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.branch_code }} — {{ branch.branch_name }}</option>
            </select>
            <small v-if="branchError" role="alert" style="color:#b43f4a;">{{ branchError }}</small>
            <small v-else-if="!branchesLoading && branches.length === 0" style="color:#b43f4a;">No active branches available. Refresh or contact an administrator.</small>
          </label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin: 0 24px 16px; color: #b43f4a; font-size: 12px;">{{ errorMessage }}</p>
        <div class="module-form-footer">
          <span></span>
          <div>
            <BaseButton type="button" variant="secondary" class="module-secondary-btn" :disabled="loading" @click="router.push('/users')">Cancel</BaseButton>
            <BaseButton type="submit" class="module-primary-btn" :disabled="loading || branchesLoading || branches.length === 0 || rolesLoading || roles.length === 0">{{ loading ? 'Creating…' : 'Create User' }}</BaseButton>
          </div>
        </div>
      </form>
    </section>
  </section>
</template>

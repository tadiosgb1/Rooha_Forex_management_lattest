<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../../composables/toast'
import { apiRequest } from '../../services/apiClient'
import { roleService } from '../../services/roleService'
import BaseButton from '../../components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const loading = ref(false)
const loadingData = ref(true)
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
  branch_id: '',
  role_id: '',
  is_active: true,
})

async function loadUser() {
  const response = await apiRequest(`users/${encodeURIComponent(route.params.id)}`)
  const user = response?.data?.user ?? response?.data ?? response?.user ?? response
  if (!user || typeof user !== 'object') throw new Error('The server returned an unexpected user response.')
  form.first_name = user.first_name ?? ''
  form.last_name = user.last_name ?? ''
  form.email = user.email ?? ''
  form.phone_number = user.phone_number ?? ''
  form.branch_id = user.branch_id ?? ''
  const assignedRole = user.role_id ?? user.role?.id ?? user.roles?.[0]?.id ?? user.roles?.[0]?.role_id ?? ''
  form.role_id = assignedRole === '' || assignedRole === null ? '' : String(assignedRole)
  form.is_active = user.is_active ?? true
}

async function loadBranches() {
  try {
    const response = await apiRequest('branches?page=1&pageSize=100&search=&sortBy=created_at&is_active=true')
    if (response?.status !== 'success' || !Array.isArray(response?.data)) {
      throw new Error(response?.message || 'Unable to load branches.')
    }
    branches.value = response.data.filter(branch => branch?.is_active === true && branch?.id)
  } catch (error) {
    branchError.value = error?.message || 'Unable to load active branches.'
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

async function updateUser() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    if (!branches.value.some(branch => String(branch.id) === String(form.branch_id))) {
      throw new Error('Please select an active branch.')
    }
    if (!roles.value.some(role => String(role.id) === String(form.role_id))) {
      throw new Error('Please select a role.')
    }
    const approvedBy = localStorage.getItem('userId') || ''
    if (!approvedBy) throw new Error('Your user ID was not found in local storage. Please sign in again.')
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim(),
      branch_id: form.branch_id,
      role_id: form.role_id,
      is_active: form.is_active,
      approved_by: approvedBy,
    }
    const response = await apiRequest(`users/${encodeURIComponent(route.params.id)}`, { method: 'PATCH', body: payload })
    if (response?.status && response.status !== 'success') {
      throw new Error(response?.message || 'The server could not update this user.')
    }
    toast.success('User updated successfully.')
    router.push('/users')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to update user. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loadingData.value = true
  try {
    await Promise.all([loadUser(), loadBranches(), loadRoles()])
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load user details.'
  } finally {
    loadingData.value = false
  }
})
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Update User</h2><p class="module-description">Update user details, role, and branch assignment.</p></div>
      <BaseButton variant="secondary" class="module-secondary-btn" @click="router.push('/users')">← Back to users</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>User information</h3><span class="module-record-id">ID: {{ route.params.id }}</span></div>
      <p v-if="loadingData" class="module-description" style="padding:20px 24px">Loading user details…</p>
      <form v-else @submit.prevent="updateUser">
        <div class="module-form-grid">
          <label class="module-form-field"><span>First name <b>*</b></span><input v-model="form.first_name" class="ui-input" autocomplete="given-name" required /></label>
          <label class="module-form-field"><span>Last name <b>*</b></span><input v-model="form.last_name" class="ui-input" autocomplete="family-name" required /></label>
          <label class="module-form-field"><span>Email <b>*</b></span><input v-model="form.email" class="ui-input" type="email" autocomplete="email" required /></label>
          <label class="module-form-field"><span>Phone number <b>*</b></span><input v-model="form.phone_number" class="ui-input" type="tel" autocomplete="tel" required /></label>
          <label class="module-form-field"><span>Branch <b>*</b></span><select v-model="form.branch_id" class="ui-input" required :disabled="branches.length === 0"><option value="" disabled>Select a branch</option><option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.branch_code }} — {{ branch.branch_name }}</option></select><small v-if="branchError" role="alert" style="color:#b43f4a">{{ branchError }}</small></label>
          <label class="module-form-field"><span>Role <b>*</b></span><select v-model="form.role_id" class="ui-input" required :disabled="rolesLoading || roles.length === 0"><option value="" disabled>{{ rolesLoading ? 'Loading roles…' : 'Select a role' }}</option><option v-for="role in roles" :key="role.id" :value="String(role.id)">{{ role.name || `Role #${role.id}` }}</option></select><small v-if="roleError" role="alert" style="color:#b43f4a">{{ roleError }}</small></label>
          <label class="module-form-field"><span>Status</span><select v-model="form.is_active" class="ui-input"><option :value="true">Active</option><option :value="false">Inactive</option></select></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a;font-size:12px">{{ errorMessage }}</p>
        <div class="module-form-footer"><span></span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" :disabled="loading" @click="router.push('/users')">Cancel</BaseButton><BaseButton type="submit" class="module-primary-btn" :disabled="loading || loadingData || rolesLoading || roles.length === 0">{{ loading ? 'Saving…' : 'Save changes' }}</BaseButton></div></div>
      </form>
    </section>
  </section>
</template>

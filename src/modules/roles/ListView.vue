<script setup>
import { hasPermission, hasAnyPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { confirmAction } from '../../composables/confirmAction'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { roleService } from '../../services/roleService'
import ManagePermissionsModal from './ManagePermissionsModal.vue'

const router = useRouter()
const rows = ref([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const permissionRole = ref(null)

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q
    ? rows.value.filter(row =>
        [row.name, row.description]
          .some(value => String(value ?? '').toLowerCase().includes(q)),
      )
    : rows.value
})

async function loadRows() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await roleService.list()
    rows.value = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : []
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load roles.'
  } finally {
    loading.value = false
  }
}

async function removeRow(row) {
  const confirmed = await confirmAction({
    title: 'Delete role',
    message: `Delete role "${row.name}"? This action cannot be undone.`,
  })
  if (!confirmed) return

  errorMessage.value = ''
  successMessage.value = ''
  try {
    await roleService.remove(row.id)
    rows.value = rows.value.filter(item => item.id !== row.id)
    successMessage.value = 'Role deleted successfully.'
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to delete role.'
  }
}

function openPermissions(row) {
  permissionRole.value = row
}

function closePermissions() {
  permissionRole.value = null
}

function permissionsSaved() {
  successMessage.value = 'Role permissions updated successfully.'
}

onMounted(loadRows)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Roles</h2>
        <p class="module-description">View and manage system roles and their permissions.</p>
      </div>
      <BaseButton v-if="hasPermission('roles:create')" @click="router.push('/roles/new')">＋ Add Role</BaseButton>
    </div>

    <p v-if="errorMessage" role="alert" style="color:#b43f4a;margin-bottom:12px">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status" style="color:var(--brand-base-color);margin-bottom:12px">{{ successMessage }}</p>

    <section class="module-panel">
      <div class="module-panel-header">
        <h3>Role register</h3>
        <label class="module-search">
          <span>⌕</span>
          <BaseInput v-model="search" placeholder="Search roles…" size="sm" />
        </label>
      </div>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Description</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="4" class="module-empty-state">Loading…</td></tr>
            <tr v-else-if="!filteredRows.length"><td colspan="4" class="module-empty-state">No roles found.</td></tr>
            <tr v-for="row in filteredRows" :key="row.id">
              <td>{{ row.id }}</td>
              <td><strong>{{ row.name }}</strong></td>
              <td>{{ row.description || '—' }}</td>
              <td class="module-row-actions">
                <button v-if="hasPermission('roles:update')" @click="router.push(`/roles/${row.id}/edit`)">Edit</button>
                <button v-if="hasAnyPermission(['role-permissions:manage', 'role-permissions:assign', 'role-permissions:revoke', 'role-permissions:update'])" @click="openPermissions(row)">Manage permissions</button>
                <button v-if="hasPermission('roles:delete')" class="module-delete-action" @click="removeRow(row)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">Showing {{ filteredRows.length }} roles</div>
    </section>
    <ManagePermissionsModal
      v-if="permissionRole"
      :role="permissionRole"
      @close="closePermissions"
      @saved="permissionsSaved"
    />
  </section>
</template>

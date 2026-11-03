<script setup>
import { hasAnyPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { permissionService } from '../../services/permissionService'
import { rolePermissionService } from '../../services/rolePermissionService'

const props = defineProps({ role: { type: Object, required: true } })
const emit = defineEmits(['close', 'saved'])
const permissions = ref([])
const initialIds = ref([])
const selectedIds = ref([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const roleId = computed(() => Number(props.role.id))
const canAssignPermissions = computed(() => hasAnyPermission(['role-permissions:manage', 'role-permissions:assign', 'role-permissions:update']))
const canRevokePermissions = computed(() => hasAnyPermission(['role-permissions:manage', 'role-permissions:revoke', 'role-permissions:update']))
const visiblePermissions = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return permissions.value
  return permissions.value.filter(permission =>
    [permission.name, permission.codename, permission.content_type, permission.id]
      .some(value => String(value ?? '').toLowerCase().includes(term)),
  )
})
const allVisibleSelected = computed(() =>
  visiblePermissions.value.length > 0 &&
  visiblePermissions.value.every(permission => selectedIds.value.includes(Number(permission.id))),
)
function rowsFrom(response) {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object') return []
  for (const key of ['permissions', 'results', 'items', 'data']) {
    if (Array.isArray(response[key])) return response[key]
    if (response[key] && typeof response[key] === 'object') {
      const nested = rowsFrom(response[key])
      if (nested.length) return nested
    }
  }
  return []
}
function idFrom(item) {
  const value = typeof item === 'object' && item !== null
    ? (item.permission_id ?? item.permissionId ?? item.permission?.id ?? item.id ?? item.pk)
    : item
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}
async function loadAllPermissions() {
  const all = new Map()
  // Walk the API's page/page_size interface so the selector includes the whole system,
  // rather than only the first page of permissions.
  for (let page = 1; page <= 100; page += 1) {
    const response = await permissionService.list({ page, page_size: 100 })
    const rows = rowsFrom(response)
    let added = 0
    rows.forEach(item => {
      const id = idFrom(item)
      if (id !== null && !all.has(id)) {
        all.set(id, { ...item, id })
        added += 1
      }
    })
    if (rows.length < 100 || added === 0) break
  }
  return [...all.values()].sort((a, b) => String(a.name ?? a.codename ?? a.id).localeCompare(String(b.name ?? b.codename ?? b.id)))
}
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [allPermissions, assignedResponse] = await Promise.all([
      loadAllPermissions(),
      rolePermissionService.listForRole(roleId.value),
    ])
    permissions.value = allPermissions
    const assignedRows = rowsFrom(assignedResponse)
    const assigned = assignedRows.map(idFrom).filter(id => id !== null)
    initialIds.value = [...new Set(assigned)]
    // Start with only the permissions returned by the role's assignments checked.
    // Unassigned system permissions remain visible and unchecked.
    selectedIds.value = permissions.value
      .filter(permission => initialIds.value.includes(Number(permission.id)))
      .map(permission => Number(permission.id))
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load system permissions and this role’s assignments.'
  } finally {
    loading.value = false
  }
}
function toggle(id, checked) {
  if (checked && !canAssignPermissions.value) return
  if (!checked && !canRevokePermissions.value) return
  const next = new Set(selectedIds.value)
  if (checked) next.add(Number(id))
  else next.delete(Number(id))
  selectedIds.value = [...next]
}
function selectAllVisible() {
  if (!canAssignPermissions.value) return
  const next = new Set(selectedIds.value)
  visiblePermissions.value.forEach(permission => next.add(Number(permission.id)))
  selectedIds.value = [...next]
}
function unselectAllVisible() {
  if (!canRevokePermissions.value) return
  const visibleIds = new Set(visiblePermissions.value.map(permission => Number(permission.id)))
  selectedIds.value = selectedIds.value.filter(id => !visibleIds.has(Number(id)))
}
async function save() {
  errorMessage.value = ''
  successMessage.value = ''
  const current = new Set(selectedIds.value.map(Number))
  const original = new Set(initialIds.value.map(Number))
  const additions = [...current].filter(id => !original.has(id))
  const removals = [...original].filter(id => !current.has(id))
  if ((additions.length && !canAssignPermissions.value) || (removals.length && !canRevokePermissions.value)) {
    errorMessage.value = 'You do not have permission to assign and/or revoke the selected permissions.'
    return
  }
  if (!additions.length && !removals.length) {
    errorMessage.value = 'No permission changes to save.'
    return
  }
  saving.value = true
  try {
    await rolePermissionService.updateForRole({
      role_id: roleId.value,
      add_permission_ids: additions,
      remove_permission_ids: removals,
    })
    successMessage.value = 'Role permissions updated.'
    initialIds.value = [...selectedIds.value]
    emit('saved')
    setTimeout(() => emit('close'), 500)
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to update role permissions.'
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="assignment-modal-backdrop" role="presentation" @click.self="emit('close')">
    <section class="assignment-modal assignment-modal--wide" role="dialog" aria-modal="true" :aria-label="`Manage permissions for ${role.name}`">
      <header class="assignment-modal-header"><div><h3>Manage permissions</h3><p>Role: <strong>{{ role.name }}</strong> · {{ permissions.length }} system permissions</p></div><button type="button" class="assignment-modal-close" aria-label="Close" @click="emit('close')">×</button></header>
      <p class="assignment-modal-help">All system permissions are loaded across pages. Checked permissions are currently assigned to this role.</p>
      <p v-if="errorMessage" class="assignment-error" role="alert">{{ errorMessage }}</p>
      <p v-if="successMessage" class="assignment-success" role="status">{{ successMessage }}</p>
      <div v-if="loading" class="assignment-loading">Loading all system permissions and current assignments…</div>
      <div v-else class="assignment-permission-content">
        <div class="assignment-toolbar">
          <label class="assignment-search"><span class="sr-only">Search permissions</span><input v-model="search" type="search" placeholder="Search by name, codename, content type or ID…" /></label>
          <div class="assignment-bulk-actions"><button type="button" class="assignment-secondary-button" :disabled="!canAssignPermissions || !visiblePermissions.length || allVisibleSelected" @click="selectAllVisible">Check all shown</button><button type="button" class="assignment-secondary-button" :disabled="!canRevokePermissions || !visiblePermissions.some(item => selectedIds.includes(Number(item.id)))" @click="unselectAllVisible">Uncheck all shown</button></div>
        </div>
        <div class="assignment-selection-summary">{{ selectedIds.length }} assigned/selected · {{ visiblePermissions.filter(item => selectedIds.includes(Number(item.id))).length }} of {{ visiblePermissions.length }} shown selected</div>
        <div class="assignment-permission-list">
          <label v-for="permission in visiblePermissions" :key="permission.id" class="assignment-permission-row">
            <input type="checkbox" :checked="selectedIds.includes(Number(permission.id))" :disabled="selectedIds.includes(Number(permission.id)) ? !canRevokePermissions : !canAssignPermissions" @change="toggle(permission.id, $event.target.checked)" />
            <span><strong>{{ permission.name || permission.codename || `Permission #${permission.id}` }}</strong><small>{{ permission.codename || 'No codename' }}<template v-if="permission.content_type"> · {{ typeof permission.content_type === 'object' ? (permission.content_type.app_label ? permission.content_type.app_label + '.' + permission.content_type.model : JSON.stringify(permission.content_type)) : permission.content_type }}</template></small></span>
            <code>#{{ permission.id }}</code>
          </label>
          <p v-if="!visiblePermissions.length" class="assignment-loading">No matching permissions found.</p>
        </div>
      </div>
      <footer class="assignment-modal-footer"><span>{{ selectedIds.length }} selected</span><div><button type="button" class="assignment-secondary-button" @click="emit('close')">Cancel</button><button v-if="canAssignPermissions || canRevokePermissions" type="button" class="assignment-primary-button" :disabled="loading || saving" @click="save">{{ saving ? 'Saving…' : 'Save permissions' }}</button></div></footer>
    </section>
  </div>
</template>

<style scoped>
.assignment-modal-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(10,20,34,.58);display:flex;align-items:center;justify-content:center;padding:16px}
.assignment-modal{background:var(--surface-card,#fff);color:var(--text-primary,#172335);width:min(920px,94vw);max-height:90vh;display:flex;flex-direction:column;border-radius:14px;box-shadow:0 24px 80px #07132645;overflow:hidden}
.assignment-modal--wide{width:min(920px,94vw);height:min(780px,88vh)}
.assignment-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 26px 14px;border-bottom:1px solid var(--border-color,#e5eaf0);flex:0 0 auto}
.assignment-modal-header h3{margin:0 0 5px;font-size:18px}.assignment-modal-header p,.assignment-modal-help{margin:0;color:var(--text-secondary,#667386);font-size:13px}
.assignment-modal-close{border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:inherit}
.assignment-modal-help{padding:13px 26px;flex:0 0 auto}.assignment-permission-content{display:flex;flex-direction:column;min-height:0;flex:1;padding:0 26px}
.assignment-toolbar{display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;padding:4px 0 12px}
.assignment-search{flex:1 1 300px;min-width:200px}.assignment-search input{width:100%;padding:10px 12px;border:1px solid var(--border-color,#d8e0e9);border-radius:8px;background:transparent;color:inherit}
.assignment-bulk-actions{display:flex;gap:8px;flex-wrap:wrap}.assignment-selection-summary{font-size:12px;color:var(--text-secondary,#667386);padding:0 0 8px}
.assignment-permission-list{overflow:auto;min-height:0;flex:1;border-top:1px solid var(--border-color,#e5eaf0)}
.assignment-permission-row{display:flex;gap:12px;align-items:center;padding:12px 4px;border-bottom:1px solid var(--border-color,#e5eaf0);cursor:pointer}
.assignment-permission-row input{width:17px;height:17px;flex:0 0 17px;accent-color:var(--brand-base-color,#16a34a)}
.assignment-permission-row span{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.assignment-permission-row small{color:var(--text-secondary,#667386);font-size:12px;overflow-wrap:anywhere}.assignment-permission-row code{font-size:11px;color:var(--text-secondary,#667386)}
.assignment-loading{padding:24px;color:var(--text-secondary,#667386);font-size:13px}.assignment-error,.assignment-success{margin:0 26px 10px;font-size:13px}.assignment-error{color:#b43f4a}.assignment-success{color:#16803d}
.assignment-modal-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 26px;border-top:1px solid var(--border-color,#e5eaf0);font-size:12px;color:var(--text-secondary,#667386);flex:0 0 auto}
.assignment-modal-footer>div{display:flex;gap:8px}.assignment-primary-button,.assignment-secondary-button{border-radius:7px;padding:9px 13px;font-weight:600;cursor:pointer;border:1px solid transparent}
.assignment-primary-button{background:var(--brand-base-color,#16a34a);color:#fff}.assignment-primary-button:disabled,.assignment-secondary-button:disabled{opacity:.5;cursor:not-allowed}
.assignment-secondary-button{background:transparent;border-color:var(--border-color,#d8e0e9);color:inherit}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:600px){.assignment-modal-backdrop{padding:8px}.assignment-modal--wide{width:100%;height:94vh;max-height:94vh}.assignment-modal-header,.assignment-modal-help{padding-left:16px;padding-right:16px}.assignment-permission-content{padding:0 16px}.assignment-modal-footer{padding:12px 16px}.assignment-toolbar{align-items:stretch}.assignment-bulk-actions{width:100%}.assignment-bulk-actions button{flex:1}.assignment-modal-footer{align-items:flex-start;flex-direction:column}.assignment-modal-footer>div{width:100%}.assignment-modal-footer button{flex:1}}
</style>

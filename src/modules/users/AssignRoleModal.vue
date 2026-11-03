<script setup>
import { hasAnyPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { roleService } from '../../services/roleService'
import { userRoleService } from '../../services/userRoleService'

const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['close', 'saved'])
const roles = ref([])
const assignedRoles = ref([])
const selectedIds = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const userLabel = computed(() => [props.user.first_name, props.user.last_name].filter(Boolean).join(' ') || props.user.email || `User #${props.user.id}`)
const assignedIds = computed(() => new Set(assignedRoles.value.map(roleKey).filter(Number.isFinite)))
const canAssignRoles = computed(() => hasAnyPermission(['user-roles:assign', 'user-roles:update']))
const canRevokeRoles = computed(() => hasAnyPermission(['user-roles:revoke', 'user-roles:update']))
const visibleRoles = computed(() => {
  const term = search.value.trim().toLowerCase()
  return roles.value.filter(role => !term || [role.name, role.description, role.id].some(value => String(value ?? '').toLowerCase().includes(term)))
})
const allVisibleSelected = computed(() => visibleRoles.value.length > 0 && visibleRoles.value.every(role => selectedIds.value.includes(Number(role.id))))
function rowsFrom(response) {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object') return []
  for (const key of ['roles', 'results', 'items', 'data']) {
    if (Array.isArray(response[key])) return response[key]
    if (response[key] && typeof response[key] === 'object') {
      const nested = rowsFrom(response[key])
      if (nested.length) return nested
    }
  }
  return []
}
function roleKey(role) {
  const value = typeof role === 'object' && role !== null
    ? (role.role_id ?? role.roleId ?? role.role?.id ?? role.id ?? role.pk)
    : role
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}
function normalizeAssignedRoles(response, allRoles) {
  const roleRows = rowsFrom(response)
  const byId = new Map(allRoles.map(role => [Number(role.id), role]))
  const byName = new Map(allRoles.map(role => [String(role.name ?? '').trim().toLowerCase(), role]))
  return roleRows.map(item => {
    const id = roleKey(item)
    if (id !== null && byId.has(id)) return byId.get(id)
    const name = typeof item === 'object' && item !== null
      ? (item.role_name ?? item.name ?? item.role?.name ?? (typeof item.role === 'string' ? item.role : ''))
      : ''
    return byName.get(String(name).trim().toLowerCase()) ?? (id !== null ? { id } : null)
  }).filter(Boolean)
}
async function loadAllRoles() {
  const all = new Map()
  for (let page = 1; page <= 100; page += 1) {
    const response = await roleService.list({ page, page_size: 100 })
    const rows = rowsFrom(response)
    let added = 0
    rows.forEach(item => {
      const id = roleKey(item)
      if (id !== null && !all.has(id)) {
        all.set(id, { ...item, id })
        added += 1
      }
    })
    if (rows.length < 100 || added === 0) break
  }
  return [...all.values()].sort((a, b) => String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)))
}
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [allRoles, assignedResponse] = await Promise.all([
      loadAllRoles(),
      userRoleService.listForUser(props.user.id),
    ])
    roles.value = allRoles
    assignedRoles.value = normalizeAssignedRoles(assignedResponse, allRoles)
    // Existing assignments start checked; unchecking one revokes it on save.
    selectedIds.value = [...assignedIds.value]
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load system roles and this user’s assignments.'
  } finally {
    loading.value = false
  }
}
function toggle(id, checked) {
  if (checked && !canAssignRoles.value) return
  if (!checked && !canRevokeRoles.value) return
  const next = new Set(selectedIds.value)
  if (checked) next.add(Number(id))
  else next.delete(Number(id))
  selectedIds.value = [...next]
}
function selectAllVisible() {
  if (!canAssignRoles.value) return
  const next = new Set(selectedIds.value)
  visibleRoles.value.forEach(role => next.add(Number(role.id)))
  selectedIds.value = [...next]
}
function unselectAllVisible() {
  if (!canRevokeRoles.value) return
  const visibleIds = new Set(visibleRoles.value.map(role => Number(role.id)))
  selectedIds.value = selectedIds.value.filter(id => !visibleIds.has(Number(id)))
}
async function saveRoleChanges() {
  errorMessage.value = ''
  successMessage.value = ''
  const selected = new Set(selectedIds.value.map(Number))
  const existing = new Set(assignedIds.value)
  const toAdd = [...selected].filter(id => !existing.has(id))
  const toRemove = [...existing].filter(id => !selected.has(id))
  if ((toAdd.length && !canAssignRoles.value) || (toRemove.length && !canRevokeRoles.value)) {
    errorMessage.value = 'You do not have permission to assign and/or revoke the selected roles.'
    return
  }
  if (!toAdd.length && !toRemove.length) {
    errorMessage.value = 'No role assignment changes to save.'
    return
  }
  saving.value = true
  let added = 0
  let removed = 0
  try {
    for (const id of toAdd) { await userRoleService.assign(props.user.id, id); added += 1 }
    for (const id of toRemove) { await userRoleService.unassign(props.user.id, id); removed += 1 }
    assignedRoles.value = roles.value.filter(role => selected.has(Number(role.id)))
    selectedIds.value = [...selected]
    successMessage.value = `Role assignments updated: ${added} added, ${removed} revoked.`
    emit('saved')
  } catch (error) {
    errorMessage.value = error?.message || `Unable to save all role changes. ${added} added and ${removed} revoked before the error.`
    try {
      assignedRoles.value = normalizeAssignedRoles(await userRoleService.listForUser(props.user.id), roles.value)
      selectedIds.value = [...assignedIds.value]
    } catch {}
  } finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <div class="assignment-modal-backdrop" role="presentation" @click.self="emit('close')">
    <section class="assignment-modal assignment-modal--wide" role="dialog" aria-modal="true" :aria-label="`Assign roles to ${userLabel}`">
      <header class="assignment-modal-header"><div><h3>Assign roles</h3><p>User: <strong>{{ userLabel }}</strong> · #{{ user.id }}</p></div><button type="button" class="assignment-modal-close" aria-label="Close" @click="emit('close')">×</button></header>
      <p class="assignment-modal-help">All system roles are loaded across pages. Roles already assigned are checked. Uncheck any role to revoke it; check an unassigned role to add it.</p>
      <p v-if="errorMessage" class="assignment-error" role="alert">{{ errorMessage }}</p><p v-if="successMessage" class="assignment-success" role="status">{{ successMessage }}</p>
      <div v-if="loading" class="assignment-loading">Loading all system roles and current assignments…</div>
      <div v-else class="assignment-role-content">
        <div class="assignment-toolbar"><label class="assignment-search"><span class="sr-only">Search roles</span><input v-model="search" type="search" placeholder="Search roles by name, description or ID…" /></label><div class="assignment-bulk-actions"><button type="button" class="assignment-secondary-button" :disabled="!canAssignRoles || !visibleRoles.length || allVisibleSelected" @click="selectAllVisible">Check all shown</button><button type="button" class="assignment-secondary-button" :disabled="!canRevokeRoles || !selectedIds.some(id => visibleRoles.some(role => Number(role.id) === Number(id)))" @click="unselectAllVisible">Uncheck all shown</button></div></div>
        <div class="assignment-selection-summary">{{ assignedRoles.length }} currently assigned · {{ selectedIds.length }} selected · {{ roles.length }} system roles</div>
        <div class="assignment-role-list">
          <label v-for="role in visibleRoles" :key="role.id" class="assignment-role-row">
            <input type="checkbox" :checked="selectedIds.includes(Number(role.id))" :disabled="selectedIds.includes(Number(role.id)) ? !canRevokeRoles : !canAssignRoles" @change="toggle(role.id, $event.target.checked)" />
            <span><strong>{{ role.name || `Role #${role.id}` }}</strong><small>{{ role.description || 'No description' }}</small></span>
            <code v-if="assignedIds.has(Number(role.id))" class="assignment-assigned-label">{{ selectedIds.includes(Number(role.id)) ? 'Assigned' : 'Will revoke' }}</code><code v-else>#{{ role.id }}</code>
          </label>
          <p v-if="!visibleRoles.length" class="assignment-loading">No matching roles found.</p>
        </div>
      </div>
      <footer class="assignment-modal-footer"><span>POST to assign · DELETE to revoke</span><div><button type="button" class="assignment-secondary-button" @click="emit('close')">Close</button><button v-if="canAssignRoles || canRevokeRoles" type="button" class="assignment-primary-button" :disabled="loading || saving || (selectedIds.length === assignedIds.size && [...assignedIds].every(id => selectedIds.includes(id)))" @click="saveRoleChanges">{{ saving ? 'Saving…' : 'Save role changes' }}</button></div></footer>
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
.assignment-modal-help{padding:13px 26px;flex:0 0 auto}.assignment-role-content{display:flex;flex-direction:column;min-height:0;flex:1;padding:0 26px}
.assignment-toolbar{display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;padding:4px 0 12px}
.assignment-search{flex:1 1 300px;min-width:200px}.assignment-search input{width:100%;padding:10px 12px;border:1px solid var(--border-color,#d8e0e9);border-radius:8px;background:transparent;color:inherit}
.assignment-bulk-actions{display:flex;gap:8px;flex-wrap:wrap}.assignment-selection-summary{font-size:12px;color:var(--text-secondary,#667386);padding:0 0 8px}
.assignment-role-list{overflow:auto;min-height:0;flex:1;border-top:1px solid var(--border-color,#e5eaf0)}
.assignment-role-row{display:flex;gap:12px;align-items:center;padding:12px 4px;border-bottom:1px solid var(--border-color,#e5eaf0);cursor:pointer}
.assignment-role-row input{width:17px;height:17px;flex:0 0 17px;accent-color:var(--brand-base-color,#16a34a)}.assignment-role-row input:disabled{cursor:not-allowed}
.assignment-role-row span{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.assignment-role-row small{color:var(--text-secondary,#667386);font-size:12px;overflow-wrap:anywhere}.assignment-role-row code{font-size:11px;color:var(--text-secondary,#667386)}.assignment-role-row .assignment-assigned-label{color:var(--brand-base-color,#16a34a)}
.assignment-loading{padding:24px;color:var(--text-secondary,#667386);font-size:13px}.assignment-error,.assignment-success{margin:0 26px 10px;font-size:13px}.assignment-error{color:#b43f4a}.assignment-success{color:#16803d}
.assignment-modal-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 26px;border-top:1px solid var(--border-color,#e5eaf0);font-size:12px;color:var(--text-secondary,#667386);flex:0 0 auto}
.assignment-modal-footer>div{display:flex;gap:8px}.assignment-primary-button,.assignment-secondary-button{border-radius:7px;padding:9px 13px;font-weight:600;cursor:pointer;border:1px solid transparent}
.assignment-primary-button{background:var(--brand-base-color,#16a34a);color:#fff}.assignment-primary-button:disabled,.assignment-secondary-button:disabled{opacity:.5;cursor:not-allowed}
.assignment-secondary-button{background:transparent;border-color:var(--border-color,#d8e0e9);color:inherit}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:600px){.assignment-modal-backdrop{padding:8px}.assignment-modal--wide{width:100%;height:94vh;max-height:94vh}.assignment-modal-header,.assignment-modal-help{padding-left:16px;padding-right:16px}.assignment-role-content{padding:0 16px}.assignment-modal-footer{padding:12px 16px}.assignment-toolbar{align-items:stretch}.assignment-bulk-actions{width:100%}.assignment-bulk-actions button{flex:1}.assignment-modal-footer{align-items:flex-start;flex-direction:column}.assignment-modal-footer>div{width:100%}.assignment-modal-footer button{flex:1}}
</style>

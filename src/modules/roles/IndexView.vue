<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { roleService } from '../../services/roleService'

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const editingId = ref(null)
const form = ref({ name: '', description: '' })
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? rows.value.filter((row) => [row.name, row.description].some((v) => String(v ?? '').toLowerCase().includes(q))) : rows.value
})
function resetForm() { editingId.value = null; form.value = { name: '', description: '' } }
async function loadRows() {
  loading.value = true; errorMessage.value = ''
  try {
    const response = await roleService.list()
    rows.value = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []
  } catch (error) { errorMessage.value = error?.message || 'Unable to load roles.' }
  finally { loading.value = false }
}
function editRow(row) { editingId.value = row.id; form.value = { name: row.name || '', description: row.description || '' }; errorMessage.value = ''; successMessage.value = '' }
async function saveRow() {
  errorMessage.value = ''; successMessage.value = ''
  if (!form.value.name.trim() || !form.value.description.trim()) { errorMessage.value = 'Name and description are required.'; return }
  saving.value = true
  try {
    const payload = { name: form.value.name.trim(), description: form.value.description.trim() }
    if (editingId.value !== null) { await roleService.update(editingId.value, payload); successMessage.value = 'Role updated.' }
    else { await roleService.create(payload); successMessage.value = 'Role created.' }
    resetForm(); await loadRows()
  } catch (error) { errorMessage.value = error?.message || 'Unable to save role.' }
  finally { saving.value = false }
}
async function deleteRow(row) {
  if (!window.confirm(`Delete role "${row.name}"?`)) return
  errorMessage.value = ''; successMessage.value = ''
  try { await roleService.remove(row.id); successMessage.value = 'Role deleted.'; if (editingId.value === row.id) resetForm(); await loadRows() }
  catch (error) { errorMessage.value = error?.message || 'Unable to delete role.' }
}
onMounted(loadRows)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro"><div><h2>Roles</h2><p class="module-description">Create and manage system roles using the roles API.</p></div></div>
    <p v-if="errorMessage" role="alert" style="color:#b43f4a;margin:0 0 14px">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status" style="color:var(--brand-base-color);margin:0 0 14px">{{ successMessage }}</p>
    <section class="module-panel" style="margin-bottom:20px">
      <div class="module-panel-header"><h3>{{ editingId !== null ? 'Edit role' : 'Create role' }}</h3></div>
      <form class="module-form-grid" @submit.prevent="saveRow">
        <label class="module-form-field"><span>Name <b>*</b></span><BaseInput v-model="form.name" placeholder="Administrator" required /></label>
        <label class="module-form-field" style="grid-column:1/-1"><span>Description <b>*</b></span><textarea v-model="form.description" required rows="3" placeholder="Describe the access and responsibilities for this role." /></label>
        <div class="module-form-footer" style="grid-column:1/-1"><span>Role data is stored by the backend.</span><div style="display:flex;gap:8px"><BaseButton v-if="editingId !== null" type="button" variant="secondary" @click="resetForm">Cancel</BaseButton><BaseButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : editingId !== null ? 'Save changes' : 'Create role' }}</BaseButton></div></div>
      </form>
    </section>
    <section class="module-panel">
      <div class="module-panel-header"><h3>Role register</h3><label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search roles…" aria-label="Search roles" size="sm" /></label></div>
      <div class="module-table-wrap"><table class="module-table"><thead><tr><th>ID</th><th>Name</th><th>Description</th><th class="module-actions-head">Actions</th></tr></thead><tbody>
        <tr v-if="loading"><td colspan="4" class="module-empty-state">Loading roles…</td></tr><tr v-else-if="!filteredRows.length"><td colspan="4" class="module-empty-state">No roles found.</td></tr>
        <tr v-for="row in filteredRows" :key="row.id"><td>{{ row.id ?? '—' }}</td><td><strong>{{ row.name }}</strong></td><td style="white-space:normal;min-width:280px">{{ row.description || '—' }}</td><td class="module-row-actions"><button type="button" @click="editRow(row)">Edit</button><button type="button" class="module-delete-action" @click="deleteRow(row)">Delete</button></td></tr>
      </tbody></table></div>
      <div class="module-table-footer">Showing {{ filteredRows.length }} roles</div>
    </section>
  </section>
</template>

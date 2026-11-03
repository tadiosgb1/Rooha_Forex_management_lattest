<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { referenceIdTypeService } from '../../services/referenceIdTypeService'

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const editingCode = ref('')
const form = ref({ code: '', display_label: '', is_active: true })

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? rows.value.filter((row) => [row.code, row.display_label].some((v) => String(v ?? '').toLowerCase().includes(q))) : rows.value
})
function resetForm() {
  editingCode.value = ''
  form.value = { code: '', display_label: '', is_active: true }
}
async function loadRows() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await referenceIdTypeService.list()
    rows.value = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load reference ID types.'
  } finally { loading.value = false }
}
function editRow(row) {
  editingCode.value = row.code
  form.value = { code: row.code, display_label: row.display_label || '', is_active: Boolean(row.is_active) }
  successMessage.value = ''
  errorMessage.value = ''
}
async function saveRow() {
  errorMessage.value = ''
  successMessage.value = ''
  if (!form.value.code.trim() || !form.value.display_label.trim()) {
    errorMessage.value = 'Code and display label are required.'
    return
  }
  saving.value = true
  const payload = { code: form.value.code.trim().toUpperCase(), display_label: form.value.display_label.trim(), is_active: Boolean(form.value.is_active) }
  try {
    if (editingCode.value) {
      await referenceIdTypeService.update(editingCode.value, payload)
      successMessage.value = 'Reference ID type updated.'
    } else {
      await referenceIdTypeService.create(payload)
      successMessage.value = 'Reference ID type created.'
    }
    resetForm()
    await loadRows()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to save reference ID type.'
  } finally { saving.value = false }
}
async function deleteRow(row) {
  if (!window.confirm(`Delete reference ID type "${row.code}"?`)) return
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await referenceIdTypeService.remove(row.code)
    successMessage.value = 'Reference ID type deleted.'
    if (editingCode.value === row.code) resetForm()
    await loadRows()
  } catch (error) { errorMessage.value = error?.message || 'Unable to delete reference ID type.' }
}
onMounted(loadRows)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Reference ID Types</h2><p class="module-description">Manage identity document types used in customer KYC. Changes are saved to the backend.</p></div>
    </div>
    <p v-if="errorMessage" role="alert" style="color:#b43f4a;margin:0 0 14px">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status" style="color:var(--brand-base-color);margin:0 0 14px">{{ successMessage }}</p>
    <section class="module-panel" style="margin-bottom:20px">
      <div class="module-panel-header"><h3>{{ editingCode ? 'Edit reference ID type' : 'Add reference ID type' }}</h3></div>
      <form class="module-form-grid" @submit.prevent="saveRow">
        <label class="module-form-field"><span>Code <b>*</b></span><BaseInput v-model="form.code" placeholder="PASSPORT" required :disabled="Boolean(editingCode)" /></label>
        <label class="module-form-field"><span>Display label <b>*</b></span><BaseInput v-model="form.display_label" placeholder="Passport" required /></label>
        <label class="module-form-field" style="flex-direction:row;align-items:center;gap:10px"><input v-model="form.is_active" type="checkbox" style="width:auto;min-height:0" /> <span>Active</span></label>
        <div class="module-form-footer" style="grid-column:1/-1">
          <span>Example: PASSPORT / Passport / active</span>
          <div style="display:flex;gap:8px"><BaseButton v-if="editingCode" type="button" variant="secondary" @click="resetForm">Cancel</BaseButton><BaseButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : editingCode ? 'Save changes' : 'Create type' }}</BaseButton></div>
        </div>
      </form>
    </section>
    <section class="module-panel">
      <div class="module-panel-header"><h3>Reference ID type register</h3><label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search types…" aria-label="Search reference ID types" size="sm" /></label></div>
      <div class="module-table-wrap"><table class="module-table">
        <thead><tr><th>Code</th><th>Display label</th><th>Status</th><th class="module-actions-head">Actions</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="4" class="module-empty-state">Loading reference ID types…</td></tr>
          <tr v-else-if="!filteredRows.length"><td colspan="4" class="module-empty-state">No reference ID types found.</td></tr>
          <tr v-for="row in filteredRows" :key="row.code"><td><strong>{{ row.code }}</strong></td><td>{{ row.display_label }}</td><td><span class="module-status-chip" :class="row.is_active ? 'active' : 'blocked'">{{ row.is_active ? 'Active' : 'Inactive' }}</span></td><td class="module-row-actions"><button type="button" @click="editRow(row)">Edit</button><button type="button" class="module-delete-action" @click="deleteRow(row)">Delete</button></td></tr>
        </tbody>
      </table></div>
      <div class="module-table-footer">Showing {{ filteredRows.length }} reference ID types</div>
    </section>
  </section>
</template>

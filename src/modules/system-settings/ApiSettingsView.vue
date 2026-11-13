<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import { listSettingsResource, createSettingsResource, updateSettingsResource, deleteSettingsResource } from '../../services/settingsResourceService'

const route = useRoute()
const resource = computed(() => route.meta.resource === 'settings' ? 'settings' : 'banks')
const dynamic = computed(() => resource.value === 'settings')
const config = computed(() => dynamic.value ? {
  title: 'Dynamic Settings',
  description: 'Manage key/value settings persisted by the backend.',
  defaults: { key: 'vat_rate', value: '15', description: 'Value Added Tax rate percentage applied to transactions', is_active: true },
  fields: [
    { key: 'key', label: 'Setting key', required: true },
    { key: 'value', label: 'Value', required: true },
    { key: 'description', label: 'Description' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { key: 'key', label: 'Key' }, { key: 'value', label: 'Value' },
    { key: 'description', label: 'Description' }, { key: 'is_active', label: 'Status' },
  ],
} : {
  title: 'Banks List',
  description: 'Manage bank records used by foreign exchange operations.',
  defaults: { bank_name: 'Dashen Bank', bank_code: 'DASH', swift_code: 'DASHETAA', settlement_account: '015582150401', currency: 'ETB', status: 'Active', description: 'Leading financial institution in Ethiopia' },
  fields: [
    { key: 'bank_name', label: 'Bank name', required: true },
    { key: 'bank_code', label: 'Bank code', required: true },
    { key: 'swift_code', label: 'SWIFT code' },
    { key: 'settlement_account', label: 'Settlement account' },
    { key: 'currency', label: 'Currency', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
    { key: 'description', label: 'Description' },
  ],
  columns: [
    { key: 'bank_name', label: 'Bank name' }, { key: 'bank_code', label: 'Bank code' },
    { key: 'swift_code', label: 'SWIFT code' }, { key: 'settlement_account', label: 'Settlement account' },
    { key: 'currency', label: 'Currency' }, { key: 'status', label: 'Status' },
  ],
})
const rows = ref([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const modalOpen = ref(false)
const editingId = ref(null)
const form = reactive({})
const filteredRows = computed(() => rows.value.filter(row =>
  config.value.columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(search.value.toLowerCase())),
))
function recordId(row) { return row.id ?? row._id ?? row.setting_id ?? row.key }
function isActive(row) {
  return dynamic.value ? row.is_active === true || row.is_active === 'true' : row.status === 'Active'
}
async function loadRows() {
  loading.value = true
  error.value = ''
  try { rows.value = await listSettingsResource(resource.value) }
  catch (cause) { rows.value = []; error.value = cause?.message || 'Unable to load records.' }
  finally { loading.value = false }
}
watch(resource, () => { search.value = ''; modalOpen.value = false; loadRows() })
onMounted(loadRows)
function openForm(row = null) {
  editingId.value = row ? recordId(row) : null
  Object.keys(form).forEach(key => delete form[key])
  config.value.fields.forEach(field => {
    const value = row?.[field.key] ?? config.value.defaults?.[field.key]
    form[field.key] = field.type === 'checkbox'
      ? value === true || value === 'true'
      : value ?? (field.type === 'select' ? field.options[0] : '')
  })
  modalOpen.value = true
}
function payloadFromForm() {
  const payload = {}
  config.value.fields.forEach(field => {
    payload[field.key] = field.type === 'checkbox' ? Boolean(form[field.key]) : form[field.key]
  })
  return payload
}
async function saveRow() {
  saving.value = true
  error.value = ''
  try {
    const payload = payloadFromForm()
    if (editingId.value === null) await createSettingsResource(resource.value, payload)
    else await updateSettingsResource(resource.value, editingId.value, payload)
    modalOpen.value = false
    await loadRows()
  } catch (cause) { error.value = cause?.message || 'Unable to save record.' }
  finally { saving.value = false }
}
async function deleteRow(row) {
  if (!window.confirm(`Delete this ${config.value.title.toLowerCase()} record?`)) return
  error.value = ''
  try { await deleteSettingsResource(resource.value, recordId(row)); await loadRows() }
  catch (cause) { error.value = cause?.message || 'Unable to delete record.' }
}
function displayValue(row, key) {
  if (key === 'is_active') return isActive(row) ? 'Active' : 'Inactive'
  return row[key] ?? '—'
}
function tone(value) { return value === 'Active' ? 'success' : value === 'Inactive' ? 'danger' : 'warning' }
</script>

<template>
  <section class="module-page settings-page">
    <div class="module-page-intro">
      <div><h2>{{ config.title }}</h2><p class="settings-subtitle">{{ config.description }} <span>Records are loaded from the API.</span></p></div>
      <BaseButton class="module-primary-btn" @click="openForm()">＋ Add {{ dynamic ? 'setting' : 'bank' }}</BaseButton>
    </div>
    <p v-if="error" class="settings-error" role="alert">{{ error }}</p>
    <div class="settings-stats">
      <BaseCard class="module-stat-card"><span>Total records</span><strong>{{ rows.length }}</strong><small>{{ config.title }}</small></BaseCard>
      <BaseCard class="module-stat-card"><span>Active records</span><strong>{{ rows.filter(isActive).length }}</strong><small>From API data</small></BaseCard>
    </div>
    <BaseCard class="module-panel">
      <div class="module-panel-header"><div><h3>{{ config.title }} register</h3><p>Search, add, edit or delete backend records.</p></div><label class="module-search"><span>⌕</span><input v-model="search" placeholder="Search records…" /></label></div>
      <div v-if="loading" class="module-empty-state">Loading records…</div>
      <div v-else class="module-table-wrap"><table class="module-table">
        <thead><tr><th v-for="column in config.columns" :key="column.key">{{ column.label }}</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="row in filteredRows" :key="recordId(row)">
            <td v-for="column in config.columns" :key="column.key">
              <BaseBadge v-if="column.key === 'status' || column.key === 'is_active'" :tone="tone(displayValue(row, column.key))">{{ displayValue(row, column.key) }}</BaseBadge>
              <strong v-else-if="['bank_name', 'bank_code', 'key'].includes(column.key)">{{ row[column.key] }}</strong>
              <span v-else>{{ displayValue(row, column.key) }}</span>
            </td>
            <td class="settings-actions"><button type="button" @click="openForm(row)">Edit</button><button type="button" class="danger" @click="deleteRow(row)">Delete</button></td>
          </tr>
          <tr v-if="!filteredRows.length"><td :colspan="config.columns.length + 1" class="module-empty-state">{{ loading ? 'Loading…' : 'No records found.' }}</td></tr>
        </tbody>
      </table></div>
      <div class="module-table-footer">Showing {{ filteredRows.length }} of {{ rows.length }} records</div>
    </BaseCard>
    <div v-if="modalOpen" class="settings-modal-backdrop" @click.self="modalOpen = false">
      <section class="settings-modal" role="dialog" aria-modal="true" :aria-label="config.title + ' form'">
        <header><h3>{{ editingId === null ? 'Add' : 'Edit' }} {{ dynamic ? 'setting' : 'bank' }}</h3><button type="button" aria-label="Close" @click="modalOpen = false">×</button></header>
        <form class="settings-form" @submit.prevent="saveRow">
          <label v-for="field in config.fields" :key="field.key" :class="{ 'checkbox-field': field.type === 'checkbox' }">
            <template v-if="field.type === 'checkbox'"><input v-model="form[field.key]" type="checkbox" /><span>{{ field.label }}</span></template>
            <template v-else>{{ field.label }}
              <select v-if="field.type === 'select'" v-model="form[field.key]"><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select>
              <input v-else v-model="form[field.key]" type="text" :required="field.required" />
            </template>
          </label>
          <footer><BaseButton type="button" variant="secondary" @click="modalOpen = false">Cancel</BaseButton><BaseButton type="submit" class="module-primary-btn" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</BaseButton></footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-subtitle{margin:6px 0 0;color:#77879b;font-size:12px}.settings-subtitle span{display:block;margin-top:4px;font-size:11px}.settings-error{margin:12px 0;padding:10px 12px;border:1px solid #efb6b6;border-radius:8px;color:#a32929;background:#fff5f5;font-size:12px}.settings-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:16px;max-width:620px}.settings-actions{white-space:nowrap}.settings-actions button{border:0;background:transparent;color:#167d72;font-size:11px;font-weight:700;padding:5px 7px}.settings-actions button.danger{color:#b43f4a}.settings-modal-backdrop{position:fixed;inset:0;z-index:1000;background:#17253680;display:grid;place-items:center;padding:20px}.settings-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--surface,#fff);border-radius:14px;box-shadow:0 20px 70px #10203040;padding:22px}.settings-modal>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.settings-modal h3{margin:0;color:var(--text-primary,#203750);font-size:17px}.settings-modal>header button{border:0;background:transparent;font-size:25px;color:var(--text-secondary,#718096)}.settings-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.settings-form label{display:grid;gap:7px;color:var(--text-secondary,#4b5f76);font-size:12px;font-weight:650}.settings-form input,.settings-form select{height:42px;width:100%;border:1px solid #dce5ee;border-radius:8px;padding:0 11px;background:var(--surface,#fff);color:var(--text-primary,#203750);font:inherit;font-weight:400}.settings-form label.checkbox-field{display:flex;align-items:center;gap:9px}.settings-form label.checkbox-field input{width:17px;height:17px}.settings-form footer{grid-column:1/-1;display:flex;justify-content:flex-end;gap:9px;margin-top:8px}@media(max-width:620px){.settings-form,.settings-stats{grid-template-columns:1fr}.settings-form footer{grid-column:auto}}
</style>

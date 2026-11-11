<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'

const route = useRoute()
const configs = {
  banks: {
    title: 'Banks List', description: 'Maintain the banks used by the foreign exchange operation.',
    fields: [{ key: 'bankName', label: 'Bank name', required: true }, { key: 'bankCode', label: 'Bank code', required: true }, { key: 'swiftCode', label: 'SWIFT code' }, { key: 'accountNumber', label: 'Settlement account' }, { key: 'currency', label: 'Currency' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }],
    columns: [{ key: 'bankName', label: 'Bank name' }, { key: 'bankCode', label: 'Bank code' }, { key: 'swiftCode', label: 'SWIFT code' }, { key: 'accountNumber', label: 'Settlement account' }, { key: 'currency', label: 'Currency' }, { key: 'status', label: 'Status' }],
    seed: [
      { id: 1, bankName: 'Commercial Bank of Ethiopia', bankCode: 'CBE', swiftCode: 'CBETETAA', accountNumber: '1000000000001', currency: 'ETB', status: 'Active' },
      { id: 2, bankName: 'Dashen Bank', bankCode: 'DASH', swiftCode: 'DASHETAA', accountNumber: '0155821504011', currency: 'ETB', status: 'Active' },
      { id: 3, bankName: 'Awash Bank', bankCode: 'AWASH', swiftCode: 'AWINETAA', accountNumber: '013041539986600', currency: 'ETB', status: 'Active' },
    ],
  },
  'fiscal-year': { title: 'Fiscal Year', description: 'Configure financial reporting periods.', fields: [{ key: 'yearName', label: 'Fiscal year', required: true }, { key: 'startDate', label: 'Start date', type: 'date', required: true }, { key: 'endDate', label: 'End date', type: 'date', required: true }, { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Closed'] }], columns: [{ key: 'yearName', label: 'Fiscal year' }, { key: 'startDate', label: 'Start date' }, { key: 'endDate', label: 'End date' }, { key: 'status', label: 'Status' }], seed: [{ id: 1, yearName: '2026/2027', startDate: '2026-07-08', endDate: '2027-07-07', status: 'Open' }, { id: 2, yearName: '2025/2026', startDate: '2025-07-08', endDate: '2026-07-07', status: 'Closed' }] },
  'permit-number': { title: 'Permit Number', description: 'Sample permit number register and status.', fields: [{ key: 'permitNumber', label: 'Permit number', required: true }, { key: 'description', label: 'Description' }, { key: 'issuedDate', label: 'Issued date', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Used', 'Expired'] }], columns: [{ key: 'permitNumber', label: 'Permit number' }, { key: 'description', label: 'Description' }, { key: 'issuedDate', label: 'Issued date' }, { key: 'status', label: 'Status' }], seed: [{ id: 1, permitNumber: 'FXP-2026-00125', description: 'Foreign currency allocation', issuedDate: '2026-10-12', status: 'Active' }, { id: 2, permitNumber: 'FXP-2026-00124', description: 'Import settlement', issuedDate: '2026-10-08', status: 'Used' }] },
  'reversed-pn': { title: 'Reversed PN', description: 'Track payment or permit numbers that have been reversed.', fields: [{ key: 'referenceNumber', label: 'Reference number', required: true }, { key: 'originalNumber', label: 'Original PN' }, { key: 'reversalDate', label: 'Reversal date', type: 'date' }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status', type: 'select', options: ['Reversed', 'Pending review'] }], columns: [{ key: 'referenceNumber', label: 'Reference number' }, { key: 'originalNumber', label: 'Original PN' }, { key: 'reversalDate', label: 'Reversal date' }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status' }], seed: [{ id: 1, referenceNumber: 'RPN-2026-0041', originalNumber: 'PN-2026-0138', reversalDate: '2026-10-20', reason: 'Duplicate settlement', status: 'Reversed' }] },
  vat: { title: 'VAT Settings', description: 'Maintain VAT rates and effective dates.', fields: [{ key: 'settingName', label: 'Setting name', required: true }, { key: 'rate', label: 'VAT rate (%)', type: 'number', required: true }, { key: 'effectiveDate', label: 'Effective date', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }], columns: [{ key: 'settingName', label: 'Setting name' }, { key: 'rate', label: 'VAT rate (%)' }, { key: 'effectiveDate', label: 'Effective date' }, { key: 'status', label: 'Status' }], seed: [{ id: 1, settingName: 'Standard VAT', rate: 15, effectiveDate: '2026-07-08', status: 'Active' }] },
  spread: { title: 'Spread Settings', description: 'Sample spread configuration by currency pair and transaction side.', fields: [{ key: 'currencyPair', label: 'Currency pair', required: true }, { key: 'buySpread', label: 'Buy spread (%)', type: 'number' }, { key: 'sellSpread', label: 'Sell spread (%)', type: 'number' }, { key: 'effectiveDate', label: 'Effective date', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }], columns: [{ key: 'currencyPair', label: 'Currency pair' }, { key: 'buySpread', label: 'Buy spread (%)' }, { key: 'sellSpread', label: 'Sell spread (%)' }, { key: 'effectiveDate', label: 'Effective date' }, { key: 'status', label: 'Status' }], seed: [{ id: 1, currencyPair: 'USD / ETB', buySpread: 1.5, sellSpread: 1.25, effectiveDate: '2026-11-01', status: 'Active' }, { id: 2, currencyPair: 'EUR / ETB', buySpread: 1.75, sellSpread: 1.5, effectiveDate: '2026-11-01', status: 'Active' }] },
  'capital-management': { title: 'Capital Mgt', description: 'Sample capital allocation and utilization register.', fields: [{ key: 'capitalName', label: 'Capital name', required: true }, { key: 'currency', label: 'Currency', required: true }, { key: 'allocatedAmount', label: 'Allocated amount', type: 'number' }, { key: 'usedAmount', label: 'Used amount', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'On hold', 'Closed'] }], columns: [{ key: 'capitalName', label: 'Capital name' }, { key: 'currency', label: 'Currency' }, { key: 'allocatedAmount', label: 'Allocated amount' }, { key: 'usedAmount', label: 'Used amount' }, { key: 'status', label: 'Status' }], seed: [{ id: 1, capitalName: 'FX Working Capital', currency: 'ETB', allocatedAmount: 25000000, usedAmount: 12850000, status: 'Active' }, { id: 2, capitalName: 'USD Allocation Pool', currency: 'USD', allocatedAmount: 500000, usedAmount: 185000, status: 'Active' }] },
}
const config = computed(() => configs[route.meta.settingKey] || configs.banks)
const rows = ref([])
const search = ref('')
const modalOpen = ref(false)
const editingId = ref(null)
const form = reactive({})
const storageKey = computed(() => 'rooha-system-setting-' + route.meta.settingKey)
const filteredRows = computed(() => rows.value.filter(row => config.value.columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(search.value.toLowerCase()))))
function loadRows() {
  try {
    const saved = localStorage.getItem(storageKey.value)
    rows.value = saved ? JSON.parse(saved) : config.value.seed.map(row => ({ ...row }))
  } catch { rows.value = config.value.seed.map(row => ({ ...row })) }
}
function persist() { localStorage.setItem(storageKey.value, JSON.stringify(rows.value)) }
watch(() => route.meta.settingKey, loadRows)
onMounted(loadRows)
function openForm(row = null) {
  editingId.value = row?.id ?? null
  Object.keys(form).forEach(key => delete form[key])
  config.value.fields.forEach(field => { form[field.key] = row?.[field.key] ?? (field.type === 'select' ? field.options[0] : '') })
  modalOpen.value = true
}
function saveRow() {
  const payload = { ...form, id: editingId.value ?? Math.max(0, ...rows.value.map(row => Number(row.id) || 0)) + 1 }
  rows.value = editingId.value === null ? [...rows.value, payload] : rows.value.map(row => row.id === editingId.value ? payload : row)
  persist()
  modalOpen.value = false
}
function deleteRow(row) {
  if (window.confirm('Delete this ' + config.value.title.toLowerCase() + ' record?')) {
    rows.value = rows.value.filter(item => item.id !== row.id)
    persist()
  }
}
function statusTone(value) { return ['Active', 'Open', 'Reversed'].includes(value) ? 'success' : ['Inactive', 'Closed', 'Expired'].includes(value) ? 'danger' : 'warning' }
</script>

<template>
  <section class="module-page settings-page">
    <div class="module-page-intro">
      <div><h2>{{ config.title }}</h2><p class="settings-subtitle">{{ config.description }} <span>Sample data is stored in this browser only.</span></p></div>
      <BaseButton class="module-primary-btn" @click="openForm()">＋ Add {{ config.title === 'Banks List' ? 'bank' : 'record' }}</BaseButton>
    </div>
    <div class="settings-stats">
      <BaseCard class="module-stat-card"><span>Total records</span><strong>{{ rows.length }}</strong><small>{{ config.title }}</small></BaseCard>
      <BaseCard class="module-stat-card"><span>Active records</span><strong>{{ rows.filter(row => ['Active', 'Open', 'Reversed'].includes(row.status)).length }}</strong><small>Based on sample status</small></BaseCard>
    </div>
    <BaseCard class="module-panel">
      <div class="module-panel-header"><div><h3>{{ config.title }} register</h3><p>Search, add, edit or remove records.</p></div><label class="module-search"><span>⌕</span><input v-model="search" placeholder="Search records…" /></label></div>
      <div class="module-table-wrap"><table class="module-table">
        <thead><tr><th v-for="column in config.columns" :key="column.key">{{ column.label }}</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="row in filteredRows" :key="row.id">
            <td v-for="column in config.columns" :key="column.key">
              <BaseBadge v-if="column.key === 'status'" :tone="statusTone(row[column.key])">{{ row[column.key] }}</BaseBadge>
              <strong v-else-if="column.key === 'bankName' || column.key === 'bankCode'">{{ row[column.key] }}</strong>
              <span v-else>{{ row[column.key] ?? '—' }}</span>
            </td>
            <td class="settings-actions"><button @click="openForm(row)">Edit</button><button class="danger" @click="deleteRow(row)">Delete</button></td>
          </tr>
          <tr v-if="!filteredRows.length"><td :colspan="config.columns.length + 1" class="module-empty-state">No records found.</td></tr>
        </tbody>
      </table></div>
      <div class="module-table-footer">Showing {{ filteredRows.length }} of {{ rows.length }} records</div>
    </BaseCard>
    <div v-if="modalOpen" class="settings-modal-backdrop" @click.self="modalOpen = false">
      <section class="settings-modal" role="dialog" aria-modal="true" :aria-label="config.title + ' form'">
        <header><h3>{{ editingId === null ? 'Add' : 'Edit' }} {{ config.title === 'Banks List' ? 'bank' : 'record' }}</h3><button type="button" aria-label="Close" @click="modalOpen = false">×</button></header>
        <form class="settings-form" @submit.prevent="saveRow">
          <label v-for="field in config.fields" :key="field.key">{{ field.label }}
            <select v-if="field.type === 'select'" v-model="form[field.key]"><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select>
            <input v-else v-model="form[field.key]" :type="field.type || 'text'" :required="field.required" :step="field.type === 'number' ? '0.01' : undefined" />
          </label>
          <footer><BaseButton type="button" variant="secondary" @click="modalOpen = false">Cancel</BaseButton><BaseButton type="submit" class="module-primary-btn">Save changes</BaseButton></footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-subtitle{margin:6px 0 0;color:#77879b;font-size:12px}.settings-subtitle span{display:block;margin-top:4px;font-size:11px}.settings-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:16px;max-width:620px}.settings-actions{white-space:nowrap}.settings-actions button{border:0;background:transparent;color:#167d72;font-size:11px;font-weight:700;padding:5px 7px}.settings-actions button.danger{color:#b43f4a}.settings-modal-backdrop{position:fixed;inset:0;z-index:1000;background:#17253680;display:grid;place-items:center;padding:20px}.settings-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--surface,#fff);border-radius:14px;box-shadow:0 20px 70px #10203040;padding:22px}.settings-modal>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.settings-modal h3{margin:0;color:var(--text-primary,#203750);font-size:17px}.settings-modal>header button{border:0;background:transparent;font-size:25px;color:var(--text-secondary,#718096)}.settings-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.settings-form label{display:grid;gap:7px;color:var(--text-secondary,#4b5f76);font-size:12px;font-weight:650}.settings-form input,.settings-form select{height:42px;width:100%;border:1px solid #dce5ee;border-radius:8px;padding:0 11px;background:var(--surface,#fff);color:var(--text-primary,#203750);font:inherit;font-weight:400}.settings-form footer{grid-column:1/-1;display:flex;justify-content:flex-end;gap:9px;margin-top:8px}@media(max-width:620px){.settings-form,.settings-stats{grid-template-columns:1fr}.settings-form footer{grid-column:auto}}
</style>

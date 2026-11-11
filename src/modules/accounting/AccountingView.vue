<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseModal from '../../components/ui/BaseModal.vue'

const props = defineProps({ section: { type: String, required: true } })
const accountSeed = [
  { id: 1, accountCode: '1000-04', accountName: 'Bunna Bank', accountNumber: '202960100264', type: 'Asset', subtype: 'Cash', currency: 'ETB', status: 'ACTIVE' },
  { id: 2, accountCode: '1000-05', accountName: 'Dashen Bank', accountNumber: '0155821504011', type: 'Asset', subtype: 'Cash', currency: 'ETB', status: 'ACTIVE' },
  { id: 3, accountCode: '1000-07', accountName: 'Awash Bank', accountNumber: '013041539986600', type: 'Asset', subtype: 'Cash', currency: 'ETB', status: 'ACTIVE' },
]
const journalSeed = [
  { id: 1, reference: 'JV-2026-001', date: '2026-11-01', description: 'Opening bank balances', accountCode: '1000-04', accountName: 'Bunna Bank', debit: 250000, credit: 0, status: 'POSTED' },
  { id: 2, reference: 'JV-2026-001', date: '2026-11-01', description: 'Opening bank balances', accountCode: '3000-01', accountName: 'Opening Balance Equity', debit: 0, credit: 250000, status: 'POSTED' },
  { id: 3, reference: 'JV-2026-002', date: '2026-11-04', description: 'Cash transfer to Dashen Bank', accountCode: '1000-05', accountName: 'Dashen Bank', debit: 75000, credit: 0, status: 'DRAFT' },
  { id: 4, reference: 'JV-2026-002', date: '2026-11-04', description: 'Cash transfer from Bunna Bank', accountCode: '1000-04', accountName: 'Bunna Bank', debit: 0, credit: 75000, status: 'DRAFT' },
]
const accounts = ref([...accountSeed])
const journals = ref([...journalSeed])
const search = ref('')
const modalOpen = ref(false)
const editingId = ref(null)
const accountForm = reactive({ accountCode: '', accountName: '', accountNumber: '', type: 'Asset', subtype: 'Cash', currency: 'ETB', status: 'ACTIVE' })
const journalForm = reactive({ reference: '', date: new Date().toISOString().slice(0, 10), description: '', accountCode: '', debit: '', credit: '', status: 'DRAFT' })
const title = computed(() => ({ accounts: 'Charts of accounts', journal: 'Journal entries', reports: 'Accounting reports' })[props.section])
const filteredAccounts = computed(() => accounts.value.filter(row => [row.accountCode, row.accountName, row.accountNumber, row.type, row.subtype, row.currency].some(value => String(value).toLowerCase().includes(search.value.toLowerCase()))))
const filteredJournals = computed(() => journals.value.filter(row => [row.reference, row.date, row.description, row.accountName, row.status].some(value => String(value).toLowerCase().includes(search.value.toLowerCase()))))
const totalDebit = computed(() => journals.value.reduce((sum, row) => sum + Number(row.debit || 0), 0))
const totalCredit = computed(() => journals.value.reduce((sum, row) => sum + Number(row.credit || 0), 0))
const activeAccounts = computed(() => accounts.value.filter(row => row.status === 'ACTIVE').length)
const accountTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']
function loadLocal() {
  try {
    const savedAccounts = localStorage.getItem('rooha-accounting-chart')
    const savedJournals = localStorage.getItem('rooha-accounting-journals')
    if (savedAccounts) accounts.value = JSON.parse(savedAccounts)
    if (savedJournals) journals.value = JSON.parse(savedJournals)
  } catch { /* Keep the built-in sample data when local browser data is invalid. */ }
}
function persist() {
  localStorage.setItem('rooha-accounting-chart', JSON.stringify(accounts.value))
  localStorage.setItem('rooha-accounting-journals', JSON.stringify(journals.value))
}
onMounted(loadLocal)
function resetAccountForm() { Object.assign(accountForm, { accountCode: '', accountName: '', accountNumber: '', type: 'Asset', subtype: 'Cash', currency: 'ETB', status: 'ACTIVE' }) }
function openAccount(row = null) {
  editingId.value = row?.id ?? null
  resetAccountForm()
  if (row) Object.assign(accountForm, row)
  modalOpen.value = true
}
function saveAccount() {
  const payload = { ...accountForm, id: editingId.value ?? Math.max(0, ...accounts.value.map(row => Number(row.id) || 0)) + 1 }
  if (editingId.value !== null) accounts.value = accounts.value.map(row => row.id === editingId.value ? payload : row)
  else accounts.value.push(payload)
  persist(); modalOpen.value = false
}
function deleteAccount(row) {
  if (journals.value.some(entry => entry.accountCode === row.accountCode)) { window.alert('This account is used by journal entries and cannot be deleted.'); return }
  if (window.confirm('Delete ' + row.accountName + '?')) { accounts.value = accounts.value.filter(item => item.id !== row.id); persist() }
}
function resetJournalForm() { Object.assign(journalForm, { reference: '', date: new Date().toISOString().slice(0, 10), description: '', accountCode: accounts.value[0]?.accountCode || '', debit: '', credit: '', status: 'DRAFT' }) }
function openJournal(row = null) {
  editingId.value = row?.id ?? null
  resetJournalForm()
  if (row) Object.assign(journalForm, { ...row, debit: row.debit || '', credit: row.credit || '' })
  modalOpen.value = true
}
function saveJournal() {
  const account = accounts.value.find(row => row.accountCode === journalForm.accountCode)
  if (!account) return
  const debit = Number(journalForm.debit || 0)
  const credit = Number(journalForm.credit || 0)
  if (debit < 0 || credit < 0 || (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) { window.alert('Enter a positive debit or credit amount, not both.'); return }
  const payload = { ...journalForm, debit, credit, accountName: account.accountName, id: editingId.value ?? Math.max(0, ...journals.value.map(row => Number(row.id) || 0)) + 1 }
  if (editingId.value !== null) journals.value = journals.value.map(row => row.id === editingId.value ? payload : row)
  else journals.value.push(payload)
  persist(); modalOpen.value = false
}
function deleteJournal(row) {
  if (window.confirm('Delete journal line ' + row.reference + '?')) { journals.value = journals.value.filter(item => item.id !== row.id); persist() }
}
function formatMoney(value) { return Number(value || 0).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
</script>

<template>
  <section class="module-page accounting-page">
    <div class="module-page-intro">
      <div><h2>{{ title }}</h2><p class="accounting-subtitle">Sample accounting workspace. Data is stored in this browser only; no accounting API is called.</p></div>
      <BaseButton v-if="section !== 'reports'" class="module-primary-btn" @click="section === 'accounts' ? openAccount() : openJournal()">＋ {{ section === 'accounts' ? 'Add account' : 'New journal line' }}</BaseButton>
    </div>

    <div v-if="section === 'accounts'" class="module-stat-row">
      <BaseCard class="module-stat-card"><span>Total accounts</span><strong>{{ accounts.length }}</strong><small>Chart of accounts</small></BaseCard>
      <BaseCard class="module-stat-card"><span>Active accounts</span><strong>{{ activeAccounts }}</strong><small>Available for posting</small></BaseCard>
      <BaseCard class="module-stat-card"><span>Account categories</span><strong>{{ new Set(accounts.map(row => row.type)).size }}</strong><small>Across the chart</small></BaseCard>
    </div>
    <div v-if="section === 'journal'" class="module-stat-row">
      <BaseCard class="module-stat-card"><span>Journal lines</span><strong>{{ journals.length }}</strong><small>Sample register</small></BaseCard>
      <BaseCard class="module-stat-card"><span>Total debits</span><strong>{{ formatMoney(totalDebit) }}</strong><small>ETB equivalent</small></BaseCard>
      <BaseCard class="module-stat-card"><span>Total credits</span><strong>{{ formatMoney(totalCredit) }}</strong><small>ETB equivalent</small></BaseCard>
    </div>

    <BaseCard v-if="section === 'accounts'" class="module-panel">
      <div class="module-panel-header"><h3>Account register</h3><label class="module-search"><span>⌕</span><input v-model="search" placeholder="Search accounts…" /></label></div>
      <div class="module-table-wrap"><table class="module-table"><thead><tr><th>Account code</th><th>Account name</th><th>Account number</th><th>Type</th><th>Subtype</th><th>Currency</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody><tr v-for="row in filteredAccounts" :key="row.id"><td><strong>{{ row.accountCode }}</strong></td><td>{{ row.accountName }}</td><td>{{ row.accountNumber }}</td><td>{{ row.type }}</td><td>{{ row.subtype }}</td><td>{{ row.currency }}</td><td><BaseBadge tone="success">{{ row.status }}</BaseBadge></td><td class="accounting-actions"><button @click="openAccount(row)">Edit</button><button class="danger" @click="deleteAccount(row)">Delete</button></td></tr><tr v-if="!filteredAccounts.length"><td colspan="8" class="module-empty-state">No accounts match your search.</td></tr></tbody>
      </table></div><div class="module-table-footer">Showing {{ filteredAccounts.length }} of {{ accounts.length }} accounts</div>
    </BaseCard>

    <BaseCard v-else-if="section === 'journal'" class="module-panel">
      <div class="module-panel-header"><div><h3>Journal register</h3><p>Each row is a sample debit or credit line. Add, edit or delete lines locally.</p></div><label class="module-search"><span>⌕</span><input v-model="search" placeholder="Search journal…" /></label></div>
      <div class="module-table-wrap"><table class="module-table"><thead><tr><th>Reference</th><th>Date</th><th>Description</th><th>Account</th><th>Debit (ETB)</th><th>Credit (ETB)</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody><tr v-for="row in filteredJournals" :key="row.id"><td><strong>{{ row.reference }}</strong></td><td>{{ row.date }}</td><td>{{ row.description }}</td><td>{{ row.accountName }}</td><td>{{ formatMoney(row.debit) }}</td><td>{{ formatMoney(row.credit) }}</td><td><BaseBadge :tone="row.status === 'POSTED' ? 'success' : 'warning'">{{ row.status }}</BaseBadge></td><td class="accounting-actions"><button @click="openJournal(row)">Edit</button><button class="danger" @click="deleteJournal(row)">Delete</button></td></tr><tr v-if="!filteredJournals.length"><td colspan="8" class="module-empty-state">No journal lines match your search.</td></tr></tbody>
      </table></div><div class="module-table-footer"><span>{{ journals.length }} journal lines</span><strong>Debit {{ formatMoney(totalDebit) }} · Credit {{ formatMoney(totalCredit) }}</strong></div>
    </BaseCard>

    <template v-else>
      <div class="module-stat-row accounting-report-stats">
        <BaseCard class="module-stat-card"><span>Total debits</span><strong>{{ formatMoney(totalDebit) }}</strong><small>ETB · sample journal</small></BaseCard>
        <BaseCard class="module-stat-card"><span>Total credits</span><strong>{{ formatMoney(totalCredit) }}</strong><small>ETB · sample journal</small></BaseCard>
        <BaseCard class="module-stat-card"><span>Trial balance</span><strong :class="{ 'accounting-balanced': Math.abs(totalDebit - totalCredit) < 0.001, 'accounting-unbalanced': Math.abs(totalDebit - totalCredit) >= 0.001 }">{{ Math.abs(totalDebit - totalCredit) < 0.001 ? 'Balanced' : 'Difference' }}</strong><small>{{ formatMoney(Math.abs(totalDebit - totalCredit)) }} ETB difference</small></BaseCard>
      </div>
      <BaseCard class="module-panel"><div class="module-panel-header"><div><h3>Trial balance by account</h3><p>Calculated from the sample journal lines in this browser.</p></div></div>
        <div class="module-table-wrap"><table class="module-table"><thead><tr><th>Account code</th><th>Account name</th><th>Debit (ETB)</th><th>Credit (ETB)</th><th>Net balance</th></tr></thead>
          <tbody><tr v-for="account in accounts" :key="account.id"><td><strong>{{ account.accountCode }}</strong></td><td>{{ account.accountName }}</td><td>{{ formatMoney(journals.filter(row => row.accountCode === account.accountCode).reduce((sum,row) => sum + Number(row.debit || 0),0)) }}</td><td>{{ formatMoney(journals.filter(row => row.accountCode === account.accountCode).reduce((sum,row) => sum + Number(row.credit || 0),0)) }}</td><td>{{ formatMoney(journals.filter(row => row.accountCode === account.accountCode).reduce((sum,row) => sum + Number(row.debit || 0) - Number(row.credit || 0),0)) }}</td></tr></tbody>
        </table></div></BaseCard>
      <BaseCard class="module-panel accounting-report-journal"><div class="module-panel-header"><h3>Recent journal activity</h3></div><div class="module-table-wrap"><table class="module-table"><thead><tr><th>Reference</th><th>Date</th><th>Account</th><th>Debit</th><th>Credit</th><th>Status</th></tr></thead><tbody><tr v-for="row in journals.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0,6)" :key="row.id"><td>{{ row.reference }}</td><td>{{ row.date }}</td><td>{{ row.accountName }}</td><td>{{ formatMoney(row.debit) }}</td><td>{{ formatMoney(row.credit) }}</td><td>{{ row.status }}</td></tr></tbody></table></div></BaseCard>
    </template>

    <BaseModal v-model="modalOpen" :title="section === 'accounts' ? (editingId ? 'Edit account' : 'Add account') : (editingId ? 'Edit journal line' : 'New journal line')" size="lg">
      <form v-if="section === 'accounts'" class="accounting-form" @submit.prevent="saveAccount">
        <label>Account code<input v-model.trim="accountForm.accountCode" required /></label><label>Account name<input v-model.trim="accountForm.accountName" required /></label>
        <label>Account number<input v-model.trim="accountForm.accountNumber" required /></label><label>Account type<select v-model="accountForm.type"><option v-for="type in accountTypes" :key="type">{{ type }}</option></select></label>
        <label>Subtype<input v-model.trim="accountForm.subtype" required /></label><label>Currency<input v-model.trim="accountForm.currency" maxlength="3" required /></label>
        <label>Status<select v-model="accountForm.status"><option>ACTIVE</option><option>INACTIVE</option></select></label>
        <div class="accounting-form-actions"><BaseButton type="button" variant="secondary" @click="modalOpen = false">Cancel</BaseButton><BaseButton type="submit" class="module-primary-btn">Save account</BaseButton></div>
      </form>
      <form v-else class="accounting-form" @submit.prevent="saveJournal">
        <label>Journal reference<input v-model.trim="journalForm.reference" required placeholder="JV-2026-003" /></label><label>Date<input v-model="journalForm.date" type="date" required /></label>
        <label class="accounting-wide">Description<input v-model.trim="journalForm.description" required /></label>
        <label>Account<select v-model="journalForm.accountCode" required><option v-for="account in accounts" :key="account.id" :value="account.accountCode">{{ account.accountCode }} — {{ account.accountName }}</option></select></label>
        <label>Debit (ETB)<input v-model.number="journalForm.debit" type="number" min="0" step="0.01" /></label><label>Credit (ETB)<input v-model.number="journalForm.credit" type="number" min="0" step="0.01" /></label>
        <label>Status<select v-model="journalForm.status"><option>DRAFT</option><option>POSTED</option></select></label>
        <div class="accounting-form-actions"><BaseButton type="button" variant="secondary" @click="modalOpen = false">Cancel</BaseButton><BaseButton type="submit" class="module-primary-btn">Save journal line</BaseButton></div>
      </form>
    </BaseModal>
  </section>
</template>

<style scoped>
.accounting-subtitle{margin:6px 0 0;color:#77879b;font-size:12px}.accounting-actions{white-space:nowrap}.accounting-actions button{border:0;background:transparent;color:#167d72;font-size:11px;font-weight:700;padding:5px 7px}.accounting-actions button.danger{color:#b43f4a}.accounting-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.accounting-form label{display:grid;gap:7px;color:#4b5f76;font-size:12px;font-weight:650}.accounting-form input,.accounting-form select{width:100%;height:42px;border:1px solid #dce5ee;border-radius:8px;padding:0 11px;background:#fff;color:#203750;font:inherit;font-weight:400}.accounting-wide,.accounting-form-actions{grid-column:1/-1}.accounting-form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:8px}.accounting-balanced{color:#16774e!important}.accounting-unbalanced{color:#b43f4a!important}@media(max-width:600px){.accounting-form{grid-template-columns:1fr}.accounting-wide,.accounting-form-actions{grid-column:auto}}
</style>

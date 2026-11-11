<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { forexTransactionService } from '../../services/forexTransactionService'
import { hasAnyPermission } from '../../utils/permissions'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseTable from '../../components/ui/BaseTable.vue'

const props = defineProps({ transactionType: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const transactions = ref([])
const search = ref('')
const statuses = ['all', 'pending', 'approved', 'rejected']
const status = computed(() => statuses.includes(String(route.query.status || 'all').toLowerCase()) ? String(route.query.status || 'all').toLowerCase() : 'all')
const canCreate = computed(() => hasAnyPermission(['forex_transactions.create', 'forex_transactions:create']))
const title = computed(() => props.transactionType === 'BUY' ? 'Buy transactions report' : 'Sell transactions report')
const columns = [
  { key: 'reference', label: 'Transaction' }, { key: 'customer', label: 'Customer' },
  { key: 'currency', label: 'Currency' }, { key: 'amount', label: 'Foreign amount' },
  { key: 'rate', label: 'Applied rate' }, { key: 'etbAmount', label: 'ETB equivalent' },
  { key: 'status', label: 'Status' }, { key: 'created', label: 'Created' },
]
function unwrap(response) {
  let value = response
  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []
    const next = value.data ?? value.results ?? value.items ?? value.records ?? value.transactions ?? value.forex_transactions
    if (next === undefined || next === value) return []
    value = next
  }
  return Array.isArray(value) ? value : []
}
function first(...values) { return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') }
function personName(person) {
  if (!person || typeof person !== 'object') return person
  return first(person.fullname, person.full_name, person.customer_name, person.name, [person.first_name, person.last_name].filter(Boolean).join(' '), person.display_name, '—')
}
function normalize(row, index) {
  const trades = Array.isArray(row.trades) ? row.trades : []
  const amount = trades.length ? trades.reduce((sum, trade) => sum + (Number(trade.fcy_amount ?? trade.amount) || 0), 0) : Number(first(row.fcy_amount, row.foreign_amount, row.amount, row.transaction_amount))
  const rate = Number(first(row.applied_rate, row.exchange_rate, row.rate, trades[0]?.rate))
  const currency = trades.length ? [...new Set(trades.map(t => t.currency?.code ?? t.currency?.currency_code ?? t.currency_code).filter(Boolean))].join(', ') : first(row.currency?.code, row.currency?.currency_code, row.currency_code, row.currency_name, row.currency_id, '—')
  const customer = first(personName(row.customer_profile), personName(row.customer), row.customer_name, row.customer_full_name, row.customer_profile_name, '—')
  const id = first(row.id, row.forex_transaction_id, row.transaction_id, row.uuid, `transaction-${index}`)
  return {
    id: String(id),
    reference: first(row.reference, row.reference_number, row.transaction_reference, row.transaction_code, row.receipt_number, row.code, row.id, '—'),
    customer, currency, amount: Number.isFinite(amount) ? amount : null,
    rate: Number.isFinite(rate) ? rate : null,
    etbAmount: Number(first(row.etb_amount, row.local_amount, row.total_etb)) || (Number.isFinite(amount) && Number.isFinite(rate) ? amount * rate : null),
    status: first(row.status, row.transaction_status, '—'),
    created: first(row.created_at, row.createdAt, row.transaction_date, row.created_date, row.date, '—'),
  }
}
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return transactions.value
    .filter(row => String(first(row.transaction_type, row.direction, row.type, '')).toUpperCase() === props.transactionType)
    .map(normalize)
    .filter(row => !q || [row.reference, row.customer, row.currency, row.amount, row.rate, row.status, row.created].some(value => String(value ?? '').toLowerCase().includes(q)))
})
function formatNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function formatDate(value) {
  if (!value || value === '—') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}
async function loadTransactions() {
  loading.value = true
  error.value = ''
  try {
    // Each report requests its selected status from the shared forex-transactions endpoint.
    const response = await forexTransactionService.list(status.value === 'all' ? {} : { status: status.value })
    transactions.value = unwrap(response)
  } catch (err) {
    transactions.value = []
    error.value = err?.message || 'Unable to load forex transactions from the API.'
  } finally { loading.value = false }
}
function setStatus(nextStatus) {
  const query = { ...route.query }
  if (nextStatus === 'all') delete query.status
  else query.status = nextStatus
  router.replace({ query })
}
watch(status, loadTransactions)
onMounted(loadTransactions)
</script>

<template>
  <section class="module-page transaction-report-page">
    <div class="module-page-intro">
      <div><h2>{{ title }}</h2><p class="report-subtitle">Review {{ transactionType }} transactions by approval status.</p></div>
      <div class="report-actions">
        <BaseButton variant="secondary" :disabled="loading" @click="loadTransactions">{{ loading ? 'Refreshing…' : 'Refresh' }}</BaseButton>
        <BaseButton v-if="canCreate" class="module-primary-btn" @click="router.push('/trades/new')">＋ New transaction</BaseButton>
      </div>
    </div>
    <div class="report-status-filters" aria-label="Filter transactions by status">
      <button v-for="item in statuses" :key="item" type="button" :class="{ active: status === item }" :aria-pressed="status === item" @click="setStatus(item)">{{ item.charAt(0).toUpperCase() + item.slice(1) }}</button>
    </div>
    <BaseCard as="section" class="module-panel">
      <div class="module-panel-header"><h3>{{ title }}</h3><label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search transactions…" aria-label="Search transactions" size="sm" /></label></div>
      <div v-if="error" class="report-error" role="alert"><span>{{ error }}</span><BaseButton variant="secondary" size="sm" @click="loadTransactions">Try again</BaseButton></div>
      <p v-else-if="loading" class="report-state">Loading {{ transactionType }} transactions from /forex-transactions{{ status === 'all' ? '' : '?status=' + status }}…</p>
      <p v-else-if="!filteredRows.length" class="report-state">No {{ transactionType }} transactions found for status “{{ status }}”.</p>
      <BaseTable v-else :columns="columns" :rows="filteredRows" row-key="id" wrapper-class="module-table-wrap" table-class="module-table" empty-title="No matching transactions" empty-message="Try a different search.">
        <template #cell="{ column, value }">
          <BaseBadge v-if="column.key === 'status'" :tone="String(value).toLowerCase() === 'approved' ? 'success' : String(value).toLowerCase() === 'pending' ? 'warning' : String(value).toLowerCase() === 'rejected' ? 'danger' : 'neutral'" class="module-status-chip">{{ value || '—' }}</BaseBadge>
          <span v-else-if="column.key === 'amount' || column.key === 'rate'">{{ formatNumber(value) }}</span>
          <strong v-else-if="column.key === 'etbAmount'">{{ value == null ? '—' : formatNumber(value) + ' ETB' }}</strong>
          <span v-else-if="column.key === 'created'">{{ formatDate(value) }}</span>
          <span v-else>{{ value ?? '—' }}</span>
        </template>
        <template #actions="{ row }"><div class="report-row-actions"><BaseButton variant="ghost" size="sm" @click="router.push(`/trades/${encodeURIComponent(row.id)}`)">Details</BaseButton><BaseButton variant="secondary" size="sm" @click="router.push(`/trades/${encodeURIComponent(row.id)}/receipt`)">Receipt</BaseButton></div></template>
      </BaseTable>
      <div v-if="!loading && !error && filteredRows.length" class="module-table-footer">Showing {{ filteredRows.length }} {{ transactionType }} transactions</div>
    </BaseCard>
  </section>
</template>

<style scoped>
.report-subtitle{margin:6px 0 0;color:var(--text-muted,#778196);font-size:.9rem}.report-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.report-status-filters{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}.report-status-filters button{padding:8px 15px;border:1px solid var(--border-color,#d9e0ea);border-radius:8px;background:var(--surface-color,#fff);color:var(--text-muted,#778196);font-weight:650;cursor:pointer}.report-status-filters button.active{border-color:var(--brand-base-color,#16A34A);background:color-mix(in srgb,var(--brand-base-color,#16A34A) 9%,var(--surface-color,#fff));color:var(--brand-base-color,#16A34A)}.report-state{padding:24px;color:var(--text-muted,#778196);text-align:center}.report-error{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 18px;color:#a52c28;background:#fff0ef;border-radius:8px;margin:12px 0}.report-row-actions{display:flex;gap:6px;flex-wrap:wrap}.transaction-report-page :deep(.ui-badge--success){background:#eaf4ee;color:#397653;border:1px solid #d8e9dd}.transaction-report-page :deep(.ui-badge--warning){background:#fff5df;color:#946b20;border:1px solid #f2e6c8}.transaction-report-page :deep(.ui-badge--danger){background:#fbecee;color:#ad4650;border:1px solid #f1d9dc}@media(max-width:640px){.report-actions{width:100%}.report-error{align-items:flex-start;flex-direction:column}}
</style>

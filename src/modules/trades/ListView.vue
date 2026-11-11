<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { forexTransactionService } from '../../services/forexTransactionService'
import { hasAnyPermission } from '../../utils/permissions'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseStatCard from '../../components/ui/BaseStatCard.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseTable from '../../components/ui/BaseTable.vue'
import DateRangeFilter from '../../components/ui/DateRangeFilter.vue'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const transactions = ref([])
const search = ref('')
const dateRange = ref({ preset: '30' })
const canCreate = computed(() => hasAnyPermission(['forex_transactions.create', 'forex_transactions:create']))

const columns = [
  { key: 'reference', label: 'Transaction' },
  { key: 'customer', label: 'Customer' },
  { key: 'direction', label: 'Direction' },
  { key: 'currency', label: 'Currency' },
  { key: 'amount', label: 'Foreign amount' },
  { key: 'rate', label: 'Applied rate' },
  { key: 'etbAmount', label: 'ETB equivalent' },
  { key: 'status', label: 'Status' },
  { key: 'created', label: 'Created' },
]

function unwrap(response) {
  let value = response
  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []
    const next = value.data ?? value.results ?? value.items ?? value.records ?? value.transactions ?? value.forex_transactions
    if (next === undefined || next === value) return []
    value = next
  }
  return Array.isArray(value) ? value : []
}
function first(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '')
}
function personName(person) {
  if (!person || typeof person !== 'object') return person
  return first(person.fullname, person.full_name, person.customer_name, person.name, [person.first_name, person.last_name].filter(Boolean).join(' '), person.display_name)
}
function currencyName(row) {
  const currency = row.currency && typeof row.currency === 'object' ? row.currency : {}
  return first(currency.code, currency.currency_code, row.currency_code, row.currency_name, row.currency_id, '—')
}
function normalize(row, index) {
  const amount = Number(first(row.fcy_amount, row.foreign_amount, row.amount, row.transaction_amount))
  const rate = Number(first(row.applied_rate, row.exchange_rate, row.rate))
  const customer = first(personName(row.customer_profile), personName(row.customer), row.customer_name, row.customer_full_name, row.customer_profile_name, '—')
  const id = first(row.id, row.forex_transaction_id, row.transaction_id, row.uuid, `transaction-${index}`)
  const reference = first(row.reference, row.reference_number, row.transaction_reference, row.transaction_code, row.receipt_number, row.code, row.id && String(row.id).length < 30 ? row.id : null, '—')
  return {
    id: String(id),
    reference,
    customer,
    direction: first(row.transaction_type, row.direction, row.type, '—'),
    currency: currencyName(row),
    amount: Number.isFinite(amount) ? amount : null,
    rate: Number.isFinite(rate) ? rate : null,
    etbAmount: Number.isFinite(amount) && Number.isFinite(rate) ? amount * rate : Number(first(row.etb_amount, row.local_amount, row.total_etb)) || null,
    status: first(row.status, row.transaction_status, '—'),
    created: first(row.created_at, row.createdAt, row.transaction_date, row.created_date, row.date, '—'),
    raw: row,
  }
}
function transactionDate(row) {
  const value = first(row.created_at, row.createdAt, row.transaction_date, row.created_date, row.date)
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
function inSelectedRange(row) {
  const date = transactionDate(row)
  if (!date) return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start = today
  let end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const selected = dateRange.value
  if (selected.preset === 'custom') {
    if (!selected.from || !selected.to) return false
    start = new Date(selected.from + 'T00:00:00')
    end = new Date(selected.to + 'T23:59:59.999')
  } else if (selected.preset !== 'today') {
    const days = Number(selected.preset) || 30
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1)
  }
  return date >= start && date <= end
}
const dateFilteredTransactions = computed(() => transactions.value.filter(inSelectedRange))
const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return dateFilteredTransactions.value.map(normalize).filter(row => !q || [
    row.reference, row.customer, row.direction, row.currency, row.amount, row.rate, row.status, row.created,
  ].some(value => String(value ?? '').toLowerCase().includes(q)))
})
const buyCount = computed(() => dateFilteredTransactions.value.filter(row => String(first(row.transaction_type, row.direction, row.type, '')).toUpperCase() === 'BUY').length)
const sellCount = computed(() => dateFilteredTransactions.value.filter(row => String(first(row.transaction_type, row.direction, row.type, '')).toUpperCase() === 'SELL').length)
function formatNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function formatDate(value) {
  if (!value || value === '—') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}
async function loadTransactions() {
  loading.value = true
  error.value = ''
  try {
    const response = await forexTransactionService.list()
    transactions.value = unwrap(response)
  } catch (err) {
    transactions.value = []
    error.value = err?.message || 'Unable to load forex transactions from the API.'
  } finally {
    loading.value = false
  }
}
onMounted(loadTransactions)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Receipt Generator</h2><p class="trades-subtitle">View completed forex transactions and generate printable, QR-coded receipts.</p></div>
      <div class="trades-heading-actions">
        <BaseButton variant="secondary" :disabled="loading" @click="loadTransactions">{{ loading ? 'Refreshing…' : 'Refresh' }}</BaseButton>
        <BaseButton v-if="canCreate" class="module-primary-btn" @click="router.push('/trades/new')"><span>＋</span> New transaction</BaseButton>
      </div>
    </div>

    <div class="module-stat-row">
      <BaseStatCard class="module-stat-card" label="Total transactions" :value="transactions.length" />
      <BaseStatCard class="module-stat-card" label="BUY transactions" :value="buyCount" />
      <BaseStatCard class="module-stat-card" label="SELL transactions" :value="sellCount" />
    </div>

    <BaseCard as="section" class="module-panel">
      <div class="module-panel-header">
        <h3>Forex transaction register</h3>
        <DateRangeFilter v-model="dateRange" />
        <label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search transactions…" aria-label="Search transactions" size="sm" /></label>
      </div>
      <div v-if="error" class="trades-error" role="alert">
        <span>{{ error }}</span>
        <BaseButton variant="secondary" size="sm" @click="loadTransactions">Try again</BaseButton>
      </div>
      <p v-else-if="loading" class="trades-state">Loading transactions from /forex-transactions…</p>
      <p v-else-if="!transactions.length" class="trades-state">No forex transactions were returned by the API.</p>
      <BaseTable v-else :columns="columns" :rows="rows" row-key="id" wrapper-class="module-table-wrap" table-class="module-table" empty-title="No matching transactions" empty-message="Try a different search.">
        <template #cell="{ row, column, value }">
          <BaseBadge v-if="column.key === 'direction'" tone="neutral" :class="String(value).toLowerCase() === 'buy' ? 'trade-buy-chip' : String(value).toLowerCase() === 'sell' ? 'trade-sell-chip' : ''">{{ value || '—' }}</BaseBadge>
          <BaseBadge v-else-if="column.key === 'status'" tone="neutral" class="module-status-chip">{{ value || '—' }}</BaseBadge>
          <span v-else-if="column.key === 'amount'">{{ formatNumber(value) }}</span>
          <span v-else-if="column.key === 'rate'">{{ formatNumber(value) }}</span>
          <strong v-else-if="column.key === 'etbAmount'">{{ value == null ? '—' : formatNumber(value) + ' ETB' }}</strong>
          <span v-else-if="column.key === 'created'">{{ formatDate(value) }}</span>
          <span v-else>{{ value ?? '—' }}</span>
        </template>
        <template #actions="{ row }"><div class="trade-row-actions"><BaseButton variant="ghost" size="sm" @click="router.push(`/trades/${encodeURIComponent(row.id)}`)">Details</BaseButton><BaseButton variant="secondary" size="sm" @click="router.push(`/trades/${encodeURIComponent(row.id)}/receipt`)">Receipt</BaseButton></div></template>
      </BaseTable>
      <div v-if="!loading && !error && transactions.length" class="module-table-footer">Showing {{ rows.length }} of {{ dateFilteredTransactions.length }} transactions in selected period</div>
    </BaseCard>
  </section>
</template>

<style scoped>
.trades-subtitle { margin:6px 0 0;color:var(--text-muted,#778196);font-size:.9rem; }
.trade-row-actions { display:flex;align-items:center;gap:6px;flex-wrap:wrap; }
.trades-heading-actions { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
:deep(.module-panel-header){flex-wrap:wrap}
.trades-state { padding:24px;color:var(--text-muted,#778196);text-align:center; }
.trades-error { display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 18px;color:#a52c28;background:#fff0ef;border-radius:8px;margin:12px 0; }
.trade-buy-chip { color:#17663f;background:#e8f7ee; }
.trade-sell-chip { color:#a52c28;background:#fff0ef; }
@media(max-width:640px) { .trades-heading-actions { width:100%; } .trades-error { align-items:flex-start;flex-direction:column; } }
</style>

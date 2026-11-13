<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasModulePermission, hasPermission } from '../utils/permissions'
import { useModulesStore } from '../stores/modules'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseStatCard from '../components/ui/BaseStatCard.vue'
import BaseBadge from '../components/ui/BaseBadge.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import DateRangeFilter from '../components/ui/DateRangeFilter.vue'
import { forexTransactionService } from '../services/forexTransactionService'

const store = useModulesStore()
const router = useRouter()
const route = useRoute()
const transactions = ref([])
const loading = ref(false)
const error = ref('')
const dateRange = ref({ preset: '30' })
const canViewTransactions = computed(() => hasPermission('forex_transactions:view') || hasPermission('forex_transactions:read'))
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
function typeOf(row) { return String(first(row.transaction_type, row.direction, row.type, '')).toUpperCase() }
function transactionDate(row) {
  const value = first(row.created_at, row.createdAt, row.transaction_date, row.created_date, row.date)
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}
async function loadDashboardTransactions() {
  if (!canViewTransactions.value) return
  loading.value = true
  error.value = ''
  try { transactions.value = unwrap(await forexTransactionService.list()) }
  catch (cause) { transactions.value = []; error.value = cause?.message || 'Unable to load transactions.' }
  finally { loading.value = false }
}
function isInDateRange(row) {
  const date = transactionDate(row)
  if (!date) return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start = today
  let end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  if (dateRange.value.preset === 'custom') {
    if (!dateRange.value.from || !dateRange.value.to) return false
    start = new Date(dateRange.value.from + 'T00:00:00')
    end = new Date(dateRange.value.to + 'T23:59:59.999')
  } else if (dateRange.value.preset !== 'today') {
    const days = Number(dateRange.value.preset) || 30
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1)
  }
  return date >= start && date <= end
}
const periodTransactions = computed(() => transactions.value.filter(isInDateRange))
const buyTransactions = computed(() => periodTransactions.value.filter(row => typeOf(row) === 'BUY'))
const sellTransactions = computed(() => periodTransactions.value.filter(row => typeOf(row) === 'SELL'))
const recentTransactions = computed(() => [...periodTransactions.value].sort((a,b) => (transactionDate(b)?.getTime() || 0) - (transactionDate(a)?.getTime() || 0)).slice(0,7))
function customerName(row) {
  const customer = row.customer_profile ?? row.customer
  if (customer && typeof customer === 'object') return first(customer.full_name, customer.fullname, customer.name, [customer.first_name, customer.last_name].filter(Boolean).join(' '), '—')
  return first(customer, row.customer_name, row.customer_full_name, '—')
}
function amount(row) {
  const value = Number(first(row.fcy_amount, row.foreign_amount, row.amount, row.transaction_amount))
  const currency = row.currency && typeof row.currency === 'object' ? first(row.currency.code, row.currency.currency_code) : first(row.currency_code, row.currency)
  return Number.isFinite(value) ? value.toLocaleString('en-ET',{maximumFractionDigits:2}) + (currency ? ' ' + currency : '') : '—'
}
function reference(row) { return first(row.reference, row.reference_number, row.transaction_reference, row.transaction_code, row.receipt_number, row.id, 'Transaction') }
function formatDate(row) { const date=transactionDate(row); return date ? date.toLocaleString() : '—' }
function statusTone(row) { const status=String(first(row.status,row.transaction_status,'')).toLowerCase(); return status==='approved'||status==='completed'?'success':status==='rejected'||status==='failed'?'danger':status==='pending'?'warning':'neutral' }
const summaries = [{ key: 'customers', label: 'Customers', icon: '◎' }]
const visibleSummaries = computed(() => summaries.filter(item => hasModulePermission(item.key, 'read')))
const shortcuts = [
  { label: 'Buy transactions', to: '/transaction-reports/buy', visible: canViewTransactions.value },
  { label: 'Sell transactions', to: '/transaction-reports/sell', visible: canViewTransactions.value },
  { label: 'New transaction', to: '/trades/new', visible: hasPermission('forex_transactions:create') || hasPermission('forex_transactions:create') },
  { label: 'Exchange rates', to: '/rates/latest', visible: hasModulePermission('rates','read') },
  { label: 'Inventory / FIFO', to: '/inventory', visible: hasModulePermission('inventory','read') },
  { label: 'Users & Roles', to: '/users', visible: hasModulePermission('users','read') },
]
const visibleShortcuts = computed(() => shortcuts.filter(item => item.visible))
onMounted(loadDashboardTransactions)
</script>
<template>
  <section class="module-page dashboard-page">
    <div class="module-page-intro"><div><h2>Operations Overview</h2><p class="dashboard-subtitle">Forex activity and operational performance at a glance.</p></div><BaseButton v-if="canViewTransactions" variant="secondary" :disabled="loading" @click="loadDashboardTransactions">{{ loading ? 'Refreshing…' : 'Refresh' }}</BaseButton></div>
    <p v-if="route.query.accessDenied === '1'" class="module-description" role="alert">You do not have permission to access that page.</p>
    <div v-if="canViewTransactions" class="dashboard-date-filter"><span>Activity period</span><DateRangeFilter v-model="dateRange" /></div>
    <div class="module-stat-row dashboard-stat-row">
      <BaseStatCard v-if="canViewTransactions" class="module-stat-card dashboard-compact-stat" label="Total transactions" icon="⇄" :value="periodTransactions.length" />
      <BaseStatCard v-if="canViewTransactions" class="module-stat-card dashboard-compact-stat" label="BUY transactions" icon="↙" tone="success" :value="buyTransactions.length" />
      <BaseStatCard v-if="canViewTransactions" class="module-stat-card dashboard-compact-stat" label="SELL transactions" icon="↗" tone="warning" :value="sellTransactions.length" />
      <BaseStatCard v-for="item in visibleSummaries" :key="item.key" class="module-stat-card dashboard-compact-stat" :label="item.label" :icon="item.icon" :value="store.list(item.key).length" />
    </div>
    <p v-if="error" class="dashboard-error" role="alert">{{ error }}</p>
    <div class="module-dashboard-grid dashboard-main-grid">
      <BaseCard v-if="canViewTransactions" as="section" class="module-panel dashboard-recent-panel">
        <div class="module-panel-header"><div><h3>Recent forex transactions</h3><p>Latest BUY and SELL activity in the selected period</p></div><BaseButton variant="ghost" size="sm" @click="router.push('/trades')">View all →</BaseButton></div>
        <div v-if="loading" class="dashboard-empty">Loading transactions…</div>
        <div v-else-if="!recentTransactions.length" class="dashboard-empty">No transactions found for this period.</div>
        <div v-else class="dashboard-transaction-list">
          <button v-for="(row,index) in recentTransactions" :key="row.id ?? row.forex_transaction_id ?? row.transaction_id ?? index" type="button" class="dashboard-transaction-row" @click="router.push('/trades')">
            <span class="dashboard-direction-icon" :class="typeOf(row)==='BUY'?'is-buy':'is-sell'">{{ typeOf(row)==='BUY'?'↙':'↗' }}</span>
            <span class="dashboard-transaction-main"><strong>{{ reference(row) }}</strong><small>{{ customerName(row) }} · {{ formatDate(row) }}</small></span>
            <span class="dashboard-transaction-side"><strong>{{ amount(row) }}</strong><BaseBadge :tone="statusTone(row)">{{ first(row.status,row.transaction_status,'—') }}</BaseBadge></span>
          </button>
        </div>
      </BaseCard>
      <BaseCard as="section" class="module-panel dashboard-shortcut-panel"><div class="module-panel-header"><h3>Quick actions</h3></div><div class="dashboard-shortcuts"><BaseButton v-for="item in visibleShortcuts" :key="item.to" variant="ghost" @click="router.push(item.to)">{{ item.label }} <span>↗</span></BaseButton></div></BaseCard>
    </div>
  </section>
</template>
<style scoped>
.dashboard-subtitle{margin:5px 0 0;color:var(--text-muted,#778196);font-size:12px}
.dashboard-date-filter{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;padding:8px 12px;background:var(--surface-color,#fff);border:1px solid var(--border-color,#e1e7ef);border-radius:9px}.dashboard-date-filter>span{font-size:12px;font-weight:700;color:var(--text-muted,#778398)}
.dashboard-stat-row{gap:10px;margin-bottom:14px}
.dashboard-compact-stat{position:relative;box-sizing:border-box;min-height:68px!important;height:68px;overflow:hidden;padding:9px 12px!important}
.dashboard-compact-stat :deep(.ui-stat-card-top){display:block;padding-right:24px;font-size:11px;line-height:1.2}
.dashboard-compact-stat :deep(.ui-stat-card-icon){position:absolute;top:8px;right:9px;width:19px;height:19px;display:grid;place-items:center;border-radius:6px;background:var(--surface-muted,#edf2f7);font-size:10px}
.dashboard-compact-stat :deep(>strong){display:block;margin-top:4px;font-size:20px;line-height:1.05}
.dashboard-main-grid{grid-template-columns:minmax(0,2fr) minmax(230px,1fr)}
.dashboard-recent-panel :deep(.module-panel-header){align-items:center}
.dashboard-recent-panel :deep(.module-panel-header p){margin:4px 0 0;color:var(--text-muted,#778196);font-size:11px}
.dashboard-transaction-list{display:grid}
.dashboard-transaction-row{display:flex;align-items:center;gap:11px;width:100%;padding:11px 2px;border:0;border-top:1px solid var(--border-color,#e7ebf0);background:transparent;text-align:left;cursor:pointer;color:var(--text-primary,#203750)}
.dashboard-direction-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;font-weight:800}.dashboard-direction-icon.is-buy{background:#e8f6ed;color:#23834a}.dashboard-direction-icon.is-sell{background:#fff3e5;color:#a76519}
.dashboard-transaction-main,.dashboard-transaction-side{display:grid;gap:4px}.dashboard-transaction-main{min-width:0;flex:1}.dashboard-transaction-main strong{font-size:12px}.dashboard-transaction-main small{font-size:10px;color:var(--text-muted,#778196);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dashboard-transaction-side{justify-items:end}.dashboard-transaction-side>strong{font-size:11px}.dashboard-transaction-side :deep(.ui-badge){font-size:9px;padding:2px 6px}
.dashboard-empty{padding:28px 10px;text-align:center;color:var(--text-muted,#778196);font-size:12px}
.dashboard-error{margin:8px 0;padding:9px 12px;border-radius:8px;background:#fff0ef;color:#a52c28;font-size:12px}
.dashboard-shortcuts{display:grid;gap:5px}.dashboard-shortcuts :deep(button){justify-content:space-between}
@media(max-width:760px){.dashboard-main-grid{grid-template-columns:1fr}}
@media(max-width:640px){.dashboard-date-filter{align-items:flex-start;flex-direction:column}.dashboard-transaction-row{gap:8px}.dashboard-transaction-side>strong{font-size:10px}}
</style>
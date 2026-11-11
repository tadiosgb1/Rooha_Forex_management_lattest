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
const dateRange = ref({ preset: '30' })
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
async function loadDashboardTransactions() {
  try { transactions.value = unwrap(await forexTransactionService.list()) } catch { transactions.value = [] }
}
function isInDateRange(row) {
  const value = row.created_at ?? row.createdAt ?? row.transaction_date ?? row.created_date ?? row.date
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return false
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
const buyCount = computed(() => periodTransactions.value.filter(row => String(row.transaction_type ?? row.direction ?? row.type ?? '').toUpperCase() === 'BUY').length)
const sellCount = computed(() => periodTransactions.value.filter(row => String(row.transaction_type ?? row.direction ?? row.type ?? '').toUpperCase() === 'SELL').length)
onMounted(loadDashboardTransactions)
const summaries = [{ key: 'trades', label: 'FX trades', icon: '⇄' }, { key: 'customers', label: 'Customers', icon: '◎' }]
const visibleSummaries = computed(() => summaries.filter(item => hasModulePermission(item.key, 'read')))
const workItems = [
  { title: 'Review pending trade', text: 'TR-1041 · EUR · Pending approval', to: '/trades', permissions: ['forex_transactions.view', 'forex_transactions.read'] },
]
const visibleWorkItems = computed(() => workItems.filter(item => item.permissions.some(permission => hasModulePermissionForPermission(permission))))
function hasModulePermissionForPermission(permission) {
  // Reuse the canonical local-storage checker for dashboard links.
  return hasPermission(permission)
}
const shortcuts = [
  { label: 'Exchange', to: '/rates', permission: 'rates' },
  { label: 'Inventory / FIFO', to: '/inventory', permission: 'inventory' },
  { label: 'Accounting', to: '/accounting', permission: 'accounting' },
  { label: 'Users & Roles', to: '/users', permission: 'users' },
]
const visibleShortcuts = computed(() => shortcuts.filter(item => hasModulePermission(item.permission, 'read')))
</script>
<template>
  <section class="module-page">
    <div class="module-page-intro"><h2>Overview</h2></div>
    <p v-if="route.query.accessDenied === '1'" class="module-description" role="alert">You do not have permission to access that page.</p>
    <div class="dashboard-date-filter"><span>Activity period</span><DateRangeFilter v-model="dateRange" /></div>
    <div class="module-stat-row dashboard-stat-row"><BaseStatCard as="button" interactive v-for="item in visibleSummaries" :key="item.key" class="module-stat-card dashboard-stat-button" :label="item.label" :icon="item.icon" :value="item.key === 'trades' ? periodTransactions.length : store.list(item.key).length" @click="router.push('/' + item.key)" /><BaseStatCard v-if="hasModulePermission('trades', 'read')" class="module-stat-card" label="BUY transactions" :value="buyCount" /><BaseStatCard v-if="hasModulePermission('trades', 'read')" class="module-stat-card" label="SELL transactions" :value="sellCount" /></div>
    <div class="module-dashboard-grid"><BaseCard as="section" class="module-panel"><div class="module-panel-header"><h3>Items requiring attention</h3><BaseBadge tone="warning" class="module-status-chip pending-approval">{{ visibleWorkItems.length }} items</BaseBadge></div><BaseButton variant="ghost" v-for="item in visibleWorkItems" :key="item.to" class="dashboard-work-item" @click="router.push(item.to)"><span class="dashboard-work-icon">!</span><span><strong>{{ item.title }}</strong><small>{{ item.text }}</small></span><b>→</b></BaseButton></BaseCard><BaseCard as="section" class="module-panel"><div class="module-panel-header"><h3>Shortcuts</h3></div><div class="dashboard-shortcuts"><BaseButton variant="ghost" v-for="item in visibleShortcuts" :key="item.to" @click="router.push(item.to)">{{ item.label }} <span>↗</span></BaseButton></div></BaseCard></div>
  </section>
</template>
<style scoped>
.dashboard-date-filter{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:12px 15px;background:var(--surface-color,#fff);border:1px solid var(--border-color,#e1e7ef);border-radius:10px}.dashboard-date-filter>span{font-size:12px;font-weight:700;color:var(--text-muted,#778398)}
@media(max-width:640px){.dashboard-date-filter{align-items:flex-start;flex-direction:column}}
</style>
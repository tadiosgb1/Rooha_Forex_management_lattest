<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasModulePermission, hasPermission } from '../utils/permissions'
import { useModulesStore } from '../stores/modules'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseStatCard from '../components/ui/BaseStatCard.vue'
import BaseBadge from '../components/ui/BaseBadge.vue'
import BaseCard from '../components/ui/BaseCard.vue'
const store = useModulesStore()
const router = useRouter()
const route = useRoute()
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
  { label: 'Accounting Ledger', to: '/accounting', permission: 'accounting' },
  { label: 'Users & Roles', to: '/users', permission: 'users' },
]
const visibleShortcuts = computed(() => shortcuts.filter(item => hasModulePermission(item.permission, 'read')))
</script>
<template>
  <section class="module-page">
    <div class="module-page-intro"><h2>Overview</h2></div>
    <p v-if="route.query.accessDenied === '1'" class="module-description" role="alert">You do not have permission to access that page.</p>
    <div class="module-stat-row dashboard-stat-row"><BaseStatCard as="button" interactive v-for="item in visibleSummaries" :key="item.key" class="module-stat-card dashboard-stat-button" :label="item.label" :icon="item.icon" :value="store.list(item.key).length" @click="router.push('/' + item.key)" /></div>
    <div class="module-dashboard-grid"><BaseCard as="section" class="module-panel"><div class="module-panel-header"><h3>Items requiring attention</h3><BaseBadge tone="warning" class="module-status-chip pending-approval">{{ visibleWorkItems.length }} items</BaseBadge></div><BaseButton variant="ghost" v-for="item in visibleWorkItems" :key="item.to" class="dashboard-work-item" @click="router.push(item.to)"><span class="dashboard-work-icon">!</span><span><strong>{{ item.title }}</strong><small>{{ item.text }}</small></span><b>→</b></BaseButton></BaseCard><BaseCard as="section" class="module-panel"><div class="module-panel-header"><h3>Shortcuts</h3></div><div class="dashboard-shortcuts"><BaseButton variant="ghost" v-for="item in visibleShortcuts" :key="item.to" @click="router.push(item.to)">{{ item.label }} <span>↗</span></BaseButton></div></BaseCard></div>
  </section>
</template>
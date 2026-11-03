<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import BaseButton from './ui/BaseButton.vue'
import logo from '../assets/images/logo.png'
import { useSystemConfigStore } from '../stores/systemConfig'
import { hasPermission } from '../utils/permissions'
const appStore = useAppStore()
const systemConfig = useSystemConfigStore()
const route = useRoute()
const router = useRouter()
const isSidebarOpen = ref(typeof window !== 'undefined' ? window.innerWidth > 720 : true)
const profileOpen = ref(false)
const notificationsOpen = ref(false)
const isDarkMode = ref(localStorage.getItem('fx-theme') === 'dark')
watch(isDarkMode, (enabled) => {
  localStorage.setItem('fx-theme', enabled ? 'dark' : 'light')
})
function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}
function handleResize() {
  if (window.innerWidth > 720) isSidebarOpen.value = true
  else isSidebarOpen.value = false
}
onMounted(() => window.addEventListener('resize', handleResize))
onBeforeUnmount(() => window.removeEventListener('resize', handleResize))
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
}
const administrationItems = [
  { label: 'Users', to: '/users', icon: '♙', permission: 'users:read' },
  { label: 'Roles', to: '/roles', icon: '◆', permission: 'roles:read' },
  { label: 'Branches', to: '/branches', icon: '⌖', permission: 'branches:read' },
  { label: 'Permissions', to: '/permissions', icon: '▤', permission: 'permissions:read' },
  { label: 'Platform Brands', to: '/platform-brands', icon: '◐', permission: 'system-config:read' },
]
const tradingDeskItems = [
  { label: 'All Trades', to: '/trades', icon: '⇄', permission: ['forex_transactions.view', 'forex_transactions.read'] },
  { label: 'Create Trade', to: '/trades/new', icon: '+', permission: ['forex_transactions.create', 'forex_transactions:create'] },
]
const navGroups = [
  { id: 'dashboard', label: 'Dashboard', standalone: true, items: [{ label: 'Dashboard', to: '/', icon: '⌂' }] },
  { id: 'administration', label: 'Administration', icon: '⚙', items: administrationItems },
  {
    id: 'customer-management', label: 'Customer Management', icon: '◎',
    items: [
      { label: 'Customers', to: '/customers', icon: '♙', permission: 'customer-profiles:read' },
      { label: "Manage KYC's", to: '/kyc', icon: '◎', permission: 'kyc:read' },
      { label: 'Reference ID Types', to: '/reference-id-types', icon: '▤', permission: 'reference-id-types:read' },
    ],
  },
  {
    id: 'rates-board', label: 'Rates & Board', icon: '↕',
    items: [
      { label: 'Manage rates', to: '/rates', icon: '↕', permission: 'exchange-rates:read' },
      { label: 'Board Daily Exchange Rates', to: '/rates/latest', icon: '▦', permission: 'exchange-rates:read' },
      { label: 'Reference Currencies', to: '/reference-currencies', icon: '¤', permission: 'reference-currencies:read' },
    ],
  },
  {
    id: 'vault-tills', label: 'Vault & Tills', icon: '▣',
    items: [
      { label: 'Cash Vaults & Teller Tills', to: '/cash-vaults', icon: '▤', permission: 'cash-vaults:read' },
      { label: 'Till Sessions', to: '/till-sessions', icon: '◷', permission: 'till-sessions:read' },
      { label: 'Cash Movements', to: '/vault', icon: '▣', permission: 'vault-transfers:read' },
    ],
  },
  { id: 'trading-desk', label: 'Trading Desk', icon: '⇄', items: tradingDeskItems },
  {
    id: 'fx-inventory', label: 'FX Inventory / FIFO', icon: '◈',
    items: [
      { label: 'All Inventory Lots', to: '/inventory', icon: '◈', permission: 'forex_inventory.view' },
      { label: 'Add Inventory Lot', to: '/inventory/new', icon: '+', permission: [] },
    ],
  },
  {
    id: 'reconciliation', label: 'Reconciliation', icon: '✓',
    items: [
      { label: 'All Reconciliations', to: '/reconciliation', icon: '✓', permission: ['till_reconciliation_variances.view', 'till_sessions.reconcile', 'till-sessions:reconcile'] },
      { label: 'New Reconciliation', to: '/reconciliation/new', icon: '+', permission: 'till_sessions.reconcile' },
    ],
  },
  {
    id: 'reversals-receipts', label: 'Reversals & Receipts', icon: '↩',
    items: [
      { label: 'All Reversal Requests', to: '/reversals', icon: '↩', permission: ['forex_transactions.receipt.view', 'forex_transactions.view', 'forex_transactions.read'] },
      { label: 'Create Reversal', to: '/reversals/new', icon: '+', permission: 'forex_transactions.reverse' },
    ],
  },
  {
    id: 'accounting-ledger', label: 'Accounting Ledger', icon: '₿',
    items: [
      { label: 'Ledger Entries', to: '/accounting', icon: '₿', permission: 'forex_journal_entries.view' },
      { label: 'New Journal Entry', to: '/accounting/new', icon: '+', permission: [] },
    ],
  },
  {
    id: 'risk', label: 'Risk & Control', icon: '⌁',
    items: [
      { label: 'Compliance / AML', to: '/compliance', icon: '⌁', permission: 'forex_transactions.audit.view' },
      { label: 'Decision Management', to: '/decision-management', icon: '◇', permission: ['forex_transactions.read_policy', 'forex_transactions.manage_policy'] },
      { label: 'Audit Trail', to: '/audit', icon: '◌', permission: 'forex_transactions.audit.view' },
    ],
  },
]
function canAccess(item) {
  const required = item.permission
  if (!required) return true
  return (Array.isArray(required) ? required : [required]).some(hasPermission)
}
const visibleNavGroups = computed(() => navGroups
  .map((group) => group.standalone ? group : ({ ...group, items: group.items.filter(canAccess) }))
  .filter((group) => group.standalone || group.items.length > 0))
const navItems = navGroups.flatMap((group) => group.items)
const openNavGroups = ref(new Set())
watch(() => route.path, (path) => {
  const activeGroup = navGroups.find((group) => group.items.some((item) => {
    const itemPath = item.to.split('?')[0]
    return path === itemPath || (itemPath !== '/' && path.startsWith(`${itemPath}/`))
  }))
  if (activeGroup && !activeGroup.standalone) openNavGroups.value = new Set([activeGroup.id])
}, { immediate: true })
function toggleNavGroup(groupId) {
  const next = new Set(openNavGroups.value)
  if (next.has(groupId)) next.delete(groupId)
  else next.add(groupId)
  openNavGroups.value = next
}
function isGroupActive(group) {
  return group.items.some((item) => item.to === '/' ? route.path === '/' : route.path.startsWith(item.to))
}
const crumbs = computed(() => {
  const path = route.path
  if (path === '/') return [{ label: 'Home', to: '/' }]
  const item = [...navItems].filter((nav) => nav.to !== '/' && path.startsWith(nav.to)).sort((a, b) => b.to.length - a.to.length)[0]
  const result = [{ label: 'Home', to: '/' }]
  if (item) {
    result.push({ label: item.label, to: item.to })
    if (path.endsWith('/new')) result.push({ label: 'Create' })
    else if (path.endsWith('/edit')) result.push({ label: 'Edit' })
    else if (path !== item.to) result.push({ label: 'Details' })
  } else if (route.meta.title) {
    result.push({ label: route.meta.title })
  }
  return result
})
function logout() { profileOpen.value = false; appStore.logout(); router.push('/login') }
</script>
<template>
  <div class="modular-shell" :class="{ 'theme-dark': isDarkMode, 'sidebar-collapsed': !isSidebarOpen, 'sidebar-open': isSidebarOpen }">
    <aside class="modular-sidebar">
      <nav class="modular-nav" aria-label="Main navigation">
        <template v-for="group in visibleNavGroups" :key="group.id">
          <RouterLink
            v-if="group.standalone"
            :to="group.items[0].to"
            class="modular-nav-link modular-nav-standalone"
            :class="{ active: route.path === group.items[0].to }"
          ><span class="modular-nav-icon">{{ group.items[0].icon }}</span><span>{{ group.items[0].label }}</span></RouterLink>
          <section v-else class="modular-nav-group" :class="{ 'has-active-child': isGroupActive(group) }">
            <button
              class="modular-nav-group-toggle"
              type="button"
              :aria-expanded="openNavGroups.has(group.id)"
              @click="toggleNavGroup(group.id)"
            >
              <span class="modular-nav-icon">{{ group.icon }}</span>
              <span class="modular-nav-group-label">{{ group.label }}</span>
              <svg class="modular-nav-chevron" :class="{ expanded: openNavGroups.has(group.id) }" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div v-if="openNavGroups.has(group.id)" class="modular-nav-submenu">
              <RouterLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="modular-nav-link modular-nav-sublink"
                :class="{ active: route.path === item.to.split('?')[0] && (item.to.includes('?status=pending') ? route.query.status === 'pending' : item.to.includes('?status=active') ? route.query.status === 'active' : item.to.includes('?kyc=pending') ? route.query.kyc === 'pending' : item.to.includes('?kyc=active') ? route.query.kyc === 'active' : item.to.includes('?view=id-types') ? route.query.view === 'id-types' : (!item.to.includes('?') && ((route.path !== '/kyc' && route.path !== '/customers') || (!route.query.status && !route.query.kyc && !route.query.view)))) }"
              ><span class="modular-nav-icon">{{ item.icon }}</span><span>{{ item.label }}</span></RouterLink>
            </div>
          </section>
        </template>
      </nav>

    </aside>
    <main class="modular-main">
      <header class="modular-topbar">
        <div class="modular-header-left">
          <div class="modular-header-brand"><img class="modular-brand-logo" :src="(isDarkMode ? systemConfig.config.logo_dark : systemConfig.config.logo_light) || logo" :alt="`${systemConfig.config.site_name} logo`" /><div class="modular-header-brand-copy"><strong>{{ systemConfig.config.site_name }}</strong><small>Enterprise Operations</small></div></div>
          <BaseButton variant="secondary" class="modular-icon-button modular-sidebar-toggle" type="button" :aria-label="isSidebarOpen ? 'Close sidebar' : 'Open sidebar'" :aria-expanded="isSidebarOpen" title="Toggle sidebar" @click="toggleSidebar"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></BaseButton>
        </div>
        <div class="modular-header-spacer"></div>
        <div class="modular-header-actions">
          <BaseButton variant="secondary" class="modular-icon-button modular-theme-toggle" type="button" :aria-label="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'" :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme"><span aria-hidden="true">{{ isDarkMode ? '☀️' : '🌙' }}</span></BaseButton>
          <div class="modular-menu-wrap">
            <BaseButton variant="secondary" class="modular-icon-button" type="button" aria-label="Notifications" :aria-expanded="notificationsOpen" @click="notificationsOpen = !notificationsOpen; profileOpen = false">🔔<span class="modular-notification-dot"></span></BaseButton>
            <div v-if="notificationsOpen" class="modular-dropdown modular-notification-menu"><strong>Notifications</strong><p>No new notifications</p></div>
          </div>
          <div class="modular-menu-wrap">
            <BaseButton variant="secondary" class="modular-profile-trigger" type="button" :aria-expanded="profileOpen" @click="profileOpen = !profileOpen; notificationsOpen = false"><span class="modular-avatar">{{ (appStore.loginUser || 'DU').slice(0, 2).toUpperCase() }}</span><span class="modular-profile-name" :style="{ color: isDarkMode ? '#ffffff' : '#172536' }">{{ appStore.loginUser || 'Demo user' }}</span><span class="modular-chevron">⌄</span></BaseButton>
            <div v-if="profileOpen" class="modular-dropdown modular-profile-menu">
              <div class="modular-dropdown-user"><strong :style="{ color: isDarkMode ? '#172536' : '#172536' }">{{ appStore.loginUser || 'Demo user' }}</strong><small>{{ appStore.loginRole }}</small></div>
              <RouterLink v-if="hasPermission('users:read-self') || hasPermission('users:read')" to="/profile" @click="profileOpen = false">My profile</RouterLink>
              <RouterLink v-if="hasPermission('users:change-password')" to="/change-password" @click="profileOpen = false">Change password</RouterLink>
              <BaseButton variant="danger" type="button" @click="logout">Log out</BaseButton>
            </div>
          </div>
        </div>
      </header>
      <div class="modular-content">
        <nav class="modular-breadcrumbs" aria-label="Breadcrumb"><template v-for="(crumb, index) in crumbs" :key="crumb.label"><span v-if="index" class="modular-breadcrumb-separator">/</span><RouterLink v-if="crumb.to && index < crumbs.length - 1" :to="crumb.to">{{ crumb.label }}</RouterLink><RouterLink v-else-if="crumb.to && route.path !== '/'" :to="crumb.to">{{ crumb.label }}</RouterLink><span v-else class="modular-breadcrumb-current">{{ crumb.label }}</span></template></nav>
        <RouterView />
      </div>
    </main>
  </div>
</template>

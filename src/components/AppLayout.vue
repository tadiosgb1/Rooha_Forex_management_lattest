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
const navGroups = [
  { id: 'dashboard', label: 'Dashboard', standalone: true, items: [{ label: 'Dashboard', to: '/', icon: '⌂' }] },
  { id: 'administration', label: 'Administration', icon: '⚙', items: administrationItems },
  {
    id: 'customer-management', label: 'Customers', standalone: true,
    items: [
      { label: 'Customers', to: '/customers', icon: '♙', permission: 'customer-profiles:read' },
    ],
  },
  {
    id: 'exchange', label: 'Exchange', icon: '↕',
    items: [
      
      { label: 'Rate', to: '/rates/latest', icon: '▦', permission: 'exchange-rates:read' },
      { label: 'Reference Currencies', to: '/reference-currencies', icon: '¤', permission: 'reference-currencies:read' },
      { label: 'Service Fee', to: '/service-fees', icon: '%', permission: 'service-fees:read' },
    ],
  },
  {
    id: 'transaction-reports', label: 'Receipt Generator', icon: '▤',
    items: [
      { label: 'Buy transactions report', to: '/transaction-reports/buy', icon: '↗', permission: ['forex_transactions.view', 'forex_transactions.read'] },
      { label: 'Sell transactions report', to: '/transaction-reports/sell', icon: '↘', permission: ['forex_transactions.view', 'forex_transactions.read'] },
    ],
  },
  {
    id: 'system-settings', label: 'System Settings', icon: '⚙',
    items: [
      { label: 'Banks List', to: '/system-settings/banks', icon: '▦', permission: 'system-config:read' },
      { label: 'Dynamic Settings', to: '/system-settings/dynamic', icon: '⚙', permission: 'system-config:read' },
      { label: 'Fiscal Year', to: '/system-settings/fiscal-year', icon: '◷', permission: 'system-config:read' },
      { label: 'Permit Number', to: '/system-settings/permit-number', icon: '№', permission: 'system-config:read' },
      { label: 'Reversed PN', to: '/system-settings/reversed-pn', icon: '↶', permission: 'system-config:read' },
      { label: 'VAT Settings', to: '/system-settings/vat', icon: '%', permission: 'system-config:read' },
      { label: 'Spread Settings', to: '/system-settings/spread', icon: '⇄', permission: 'system-config:read' },
      { label: 'Capital Mgt', to: '/system-settings/capital-management', icon: '◈', permission: 'system-config:read' },
    ],
  },
  {
    id: 'accounting', label: 'Accounting', icon: '▤',
    items: [
      { label: 'Charts of accounts', to: '/accounting/accounts', icon: '▦', permission: '' },
      { label: 'Journal entry', to: '/accounting/journal', icon: '≡', permission: '' },
      { label: 'Reports', to: '/accounting/reports', icon: '▥', permission: '' },
    ],
  },
]
function canAccess(item) {
  const required = item.permission
  if (!required) return true
  return (Array.isArray(required) ? required : [required]).some(hasPermission)
}
const visibleNavGroups = computed(() => navGroups
  .map((group) => ({ ...group, items: group.items.filter(canAccess) }))
  .filter((group) => group.items.length > 0))
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
                :class="{ active: route.path === item.to.split('?')[0] && (item.to.includes('?status=pending') ? route.query.status === 'pending' : item.to.includes('?status=active') ? route.query.status === 'active' : !item.to.includes('?')) }"
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

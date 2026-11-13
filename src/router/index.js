import { createRouter, createWebHistory } from 'vue-router'
import { hasPermission } from '../utils/permissions'
const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: 'Sign in', public: true } },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue'), meta: { title: 'My profile' } },
  { path: '/change-password', name: 'change-password', component: () => import('../views/ChangePasswordView.vue'), meta: { title: 'Change password' } },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Operations Overview' } },
  { path: '/trades', name: 'trades', component: () => import('../modules/trades/ListView.vue'), meta: { title: 'Receipt Generator' } },
  { path: '/transaction-reports/buy', name: 'buy-transactions-report', component: () => import('../modules/transaction-reports/BuyReportView.vue'), meta: { title: 'Buy transactions report' } },
  { path: '/transaction-reports/sell', name: 'sell-transactions-report', component: () => import('../modules/transaction-reports/SellReportView.vue'), meta: { title: 'Sell transactions report' } },
  { path: '/trades/new', name: 'trades-create', component: () => import('../modules/trades/CreateView.vue'), meta: { title: 'Create Trade' } },
  { path: '/trades/:id/edit', name: 'trades-edit', component: () => import('../modules/trades/EditView.vue'), meta: { title: 'Edit Trade' } },
  { path: '/trades/:id/receipt', name: 'trades-receipt', component: () => import('../modules/trades/ReceiptView.vue'), meta: { title: 'Transaction Receipt' } },
  { path: '/trades/:id', name: 'trades-detail', component: () => import('../modules/trades/DetailView.vue'), meta: { title: 'Trade Details' } },
  { path: '/customers', name: 'customers', component: () => import('../modules/customers/ListView.vue'), meta: { title: 'Customers' } },
  { path: '/customers/:id/edit', name: 'customers-edit', component: () => import('../modules/customers/EditView.vue'), meta: { title: 'Edit Customer' } },
  { path: '/customers/:id', name: 'customers-detail', component: () => import('../modules/customers/DetailView.vue'), meta: { title: 'Customer Details' } },
  { path: '/reference-currencies', name: 'reference-currencies', component: () => import('../modules/currency-references/ListView.vue'), meta: { title: 'Reference Currencies' } },
  { path: '/reference-currencies/new', name: 'reference-currencies-create', component: () => import('../modules/currency-references/FormView.vue'), meta: { title: 'Add Reference Currency' } },
  { path: '/reference-currencies/:id/edit', name: 'reference-currencies-edit', component: () => import('../modules/currency-references/FormView.vue'), meta: { title: 'Edit Reference Currency' } },
  { path: '/reference-currencies/:id', name: 'reference-currencies-detail', component: () => import('../modules/currency-references/DetailView.vue'), meta: { title: 'Reference Currency Details' } },
  { path: '/service-fees', name: 'service-fees', component: () => import('../modules/service-fees/ListView.vue'), meta: { title: 'Service Fees' } },
  { path: '/service-fees/new', name: 'service-fees-create', component: () => import('../modules/service-fees/FormView.vue'), meta: { title: 'Create Service Fee' } },
  { path: '/service-fees/:id/edit', name: 'service-fees-edit', component: () => import('../modules/service-fees/FormView.vue'), meta: { title: 'Edit Service Fee' } },
  { path: '/service-fees/:id', name: 'service-fees-detail', component: () => import('../modules/service-fees/DetailView.vue'), meta: { title: 'Service Fee Details' } },
  { path: '/rates', name: 'rates', component: () => import('../modules/rates/ListView.vue'), meta: { title: 'Rates' } },
  { path: '/rates/latest', name: 'rates-latest', component: () => import('../modules/rates/LatestView.vue'), meta: { title: 'Rate' } },
  { path: '/rates/new', name: 'rates-create', component: () => import('../modules/rates/CreateView.vue'), meta: { title: 'Create Rate' } },
  { path: '/rates/:id/edit', name: 'rates-edit', component: () => import('../modules/rates/EditView.vue'), meta: { title: 'Edit Rate' } },
  { path: '/rates/:id', name: 'rates-detail', component: () => import('../modules/rates/DetailView.vue'), meta: { title: 'Rate Details' } },
  { path: '/inventory', name: 'inventory', component: () => import('../modules/inventory/ListView.vue'), meta: { title: 'FX Inventory / FIFO' } },
  { path: '/inventory/new', name: 'inventory-create', component: () => import('../modules/inventory/CreateView.vue'), meta: { title: 'Create Inventory lot' } },
  { path: '/inventory/:id/edit', name: 'inventory-edit', component: () => import('../modules/inventory/EditView.vue'), meta: { title: 'Edit Inventory lot' } },
  { path: '/inventory/:id', name: 'inventory-detail', component: () => import('../modules/inventory/DetailView.vue'), meta: { title: 'Inventory lot Details' } },
  { path: '/reversals', name: 'reversals', component: () => import('../modules/reversals/ListView.vue'), meta: { title: 'Reversals & Receipts' } },
  { path: '/reversals/new', name: 'reversals-create', component: () => import('../modules/reversals/CreateView.vue'), meta: { title: 'Create Reversal request' } },
  { path: '/reversals/:id/edit', name: 'reversals-edit', component: () => import('../modules/reversals/EditView.vue'), meta: { title: 'Edit Reversal request' } },
  { path: '/reversals/:id', name: 'reversals-detail', component: () => import('../modules/reversals/DetailView.vue'), meta: { title: 'Reversal request Details' } },
  { path: '/system-settings/banks', name: 'settings-banks', component: () => import('../modules/system-settings/ApiSettingsView.vue'), meta: { title: 'Banks List', resource: 'banks' } },
  { path: '/system-settings/dynamic', name: 'settings-dynamic', component: () => import('../modules/system-settings/ApiSettingsView.vue'), meta: { title: 'Dynamic Settings', resource: 'settings' } },
  { path: '/system-settings/fiscal-year', name: 'settings-fiscal-year', component: () => import('../modules/system-settings/SystemSettingsView.vue'), meta: { title: 'Fiscal Year', settingKey: 'fiscal-year' } },
  { path: '/system-settings/permit-number', name: 'settings-permit-number', component: () => import('../modules/system-settings/SystemSettingsView.vue'), meta: { title: 'Permit Number', settingKey: 'permit-number' } },
  { path: '/system-settings/reversed-pn', name: 'settings-reversed-pn', component: () => import('../modules/system-settings/SystemSettingsView.vue'), meta: { title: 'Reversed PN', settingKey: 'reversed-pn' } },
  { path: '/system-settings/vat', name: 'settings-vat', component: () => import('../modules/system-settings/SystemSettingsView.vue'), meta: { title: 'VAT Settings', settingKey: 'vat' } },
  { path: '/system-settings/spread', name: 'settings-spread', component: () => import('../modules/system-settings/SystemSettingsView.vue'), meta: { title: 'Spread Settings', settingKey: 'spread' } },
  { path: '/system-settings/capital-management', name: 'settings-capital-management', component: () => import('../modules/system-settings/SystemSettingsView.vue'), meta: { title: 'Capital Mgt', settingKey: 'capital-management' } },
  { path: '/system-settings', redirect: '/system-settings/banks' },
  { path: '/accounting', redirect: '/accounting/accounts' },
  { path: '/accounting/accounts', name: 'accounting-accounts', component: () => import('../modules/accounting/AccountsView.vue'), meta: { title: 'Charts of accounts' } },
  { path: '/accounting/journal', name: 'accounting-journal', component: () => import('../modules/accounting/JournalView.vue'), meta: { title: 'Journal entry' } },
  { path: '/accounting/reports', name: 'accounting-reports', component: () => import('../modules/accounting/ReportsView.vue'), meta: { title: 'Accounting reports' } },
  { path: '/users', name: 'users', component: () => import('../modules/users/ListView.vue'), meta: { title: 'Users & Roles' } },
  { path: '/users/new', name: 'users-create', component: () => import('../modules/users/CreateView.vue'), meta: { title: 'Create User' } },
  { path: '/users/:id/edit', name: 'users-edit', component: () => import('../modules/users/EditView.vue'), meta: { title: 'Edit User' } },
  { path: '/users/:id', name: 'users-detail', component: () => import('../modules/users/DetailView.vue'), meta: { title: 'User Details' } },
  { path: '/branches', name: 'branches', component: () => import('../modules/branches/ListView.vue'), meta: { title: 'Branches' } },
  { path: '/branches/new', name: 'branches-create', component: () => import('../modules/branches/CreateView.vue'), meta: { title: 'Create Branch' } },
  { path: '/branches/:id/edit', name: 'branches-edit', component: () => import('../modules/branches/EditView.vue'), meta: { title: 'Edit Branch' } },
  { path: '/branches/:id', name: 'branches-detail', component: () => import('../modules/branches/DetailView.vue'), meta: { title: 'Branch Details' } },
  { path: '/platform-brands', name: 'platform-brands', component: () => import('../modules/platform-brands/IndexView.vue'), meta: { title: 'Platform Brands' } },
  { path: '/roles', name: 'roles', component: () => import('../modules/roles/ListView.vue'), meta: { title: 'Roles' } },
  { path: '/roles/new', name: 'roles-create', component: () => import('../modules/roles/FormView.vue'), meta: { title: 'Create Role' } },
  { path: '/roles/:id/edit', name: 'roles-edit', component: () => import('../modules/roles/FormView.vue'), meta: { title: 'Edit Role' } },
  { path: '/roles/:id', name: 'roles-detail', component: () => import('../modules/roles/DetailView.vue'), meta: { title: 'Role Details' } },
  { path: '/permissions', name: 'permissions', component: () => import('../modules/permissions/ListView.vue'), meta: { title: 'Permissions' } },
  { path: '/permissions/new', name: 'permissions-create', component: () => import('../modules/permissions/FormView.vue'), meta: { title: 'Create Permission' } },
  { path: '/permissions/:id/edit', name: 'permissions-edit', component: () => import('../modules/permissions/FormView.vue'), meta: { title: 'Edit Permission' } },
  { path: '/permissions/:id', name: 'permissions-detail', component: () => import('../modules/permissions/DetailView.vue'), meta: { title: 'Permission Details' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Page not found', public: true } },
]
const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) })
const routePermissionMap = {
    profile: ['users:read-self', 'users:read'],
    'change-password': ['users:change-password'],
    users: ['users:read'], 'users-create': ['users:create'], 'users-edit': ['users:update'], 'users-detail': ['users:read'],
    roles: ['roles:read'], 'roles-create': ['roles:create'], 'roles-edit': ['roles:update'], 'roles-detail': ['roles:read'],
    permissions: ['permissions:read'], 'permissions-create': ['permissions:create'], 'permissions-edit': ['permissions:update'], 'permissions-detail': ['permissions:read'],
    branches: ['branches:read'], 'branches-create': ['branches:create'], 'branches-edit': ['branches:update'], 'branches-detail': ['branches:read'],
    customers: ['customer-profiles:read'], 'customers-edit': ['customer-profiles:update'], 'customers-detail': ['customer-profiles:read'],
    'reference-currencies': ['reference-currencies:read'], 'reference-currencies-create': ['reference-currencies:create'], 'reference-currencies-edit': ['reference-currencies:update'], 'reference-currencies-detail': ['reference-currencies:read'],
    rates: ['exchange-rates:read'], 'rates-latest': ['exchange-rates:read'], 'rates-create': ['exchange-rates:create'], 'rates-edit': ['exchange-rates:update'], 'rates-detail': ['exchange-rates:read'],
    'service-fees': ['service-fees:read'], 'service-fees-create': ['service-fees:create'], 'service-fees-edit': ['service-fees:update'], 'service-fees-detail': ['service-fees:read'],
    trades: ['forex_transactions.view', 'forex_transactions.read'],
    'buy-transactions-report': ['forex_transactions.view', 'forex_transactions.read'], 'sell-transactions-report': ['forex_transactions.view', 'forex_transactions.read'], 'trades-create': ['forex_transactions.create', 'forex_transactions:create'], 'trades-edit': [], 'trades-detail': ['forex_transactions.view', 'forex_transactions.read'], 'trades-receipt': ['forex_transactions.receipt.view', 'forex_transactions.view', 'forex_transactions.read', 'forex_transactions.create', 'forex_transactions:create'],
    inventory: ['forex_inventory.view'], 'inventory-create': [], 'inventory-edit': [], 'inventory-detail': ['forex_inventory.view'],
    reversals: ['forex_transactions.receipt.view', 'forex_transactions.view', 'forex_transactions.read'], 'reversals-create': ['forex_transactions.reverse'], 'reversals-edit': [], 'reversals-detail': ['forex_transactions.receipt.view', 'forex_transactions.view'],
    'settings-banks': ['system-config:read', 'system-config:update'], 'settings-dynamic': ['system-config:read', 'system-config:update'], 'settings-fiscal-year': ['system-config:read', 'system-config:update'], 'settings-permit-number': ['system-config:read', 'system-config:update'], 'settings-reversed-pn': ['system-config:read', 'system-config:update'], 'settings-vat': ['system-config:read', 'system-config:update'], 'settings-spread': ['system-config:read', 'system-config:update'], 'settings-capital-management': ['system-config:read', 'system-config:update'],
    'accounting-accounts': [''], 'accounting-journal': [''], 'accounting-reports': [''],
    'platform-brands': ['system-config:read', 'system-config:update'],
  }
function routePermissions(to) {
  return routePermissionMap[String(to.name || '')] || []
}
router.beforeEach((to) => {
  const isSignedIn = Boolean(localStorage.getItem('fx-session'))
  if (!to.meta.public && !isSignedIn) return { name: 'login' }
  if (to.name === 'login' && isSignedIn) return { name: 'dashboard' }
  if (isSignedIn) {
    const required = routePermissions(to)
    if (Object.prototype.hasOwnProperty.call(routePermissionMap, String(to.name || '')) && (!required.length || !required.some((permission) => !permission || hasPermission(permission)))) return { name: 'dashboard', query: { accessDenied: '1' } }
  }
  return true
})
export default router

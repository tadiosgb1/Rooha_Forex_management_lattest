import { createRouter, createWebHistory } from 'vue-router'
import { hasPermission } from '../utils/permissions'
const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: 'Sign in', public: true } },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue'), meta: { title: 'My profile' } },
  { path: '/change-password', name: 'change-password', component: () => import('../views/ChangePasswordView.vue'), meta: { title: 'Change password' } },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Operations Overview' } },
  { path: '/trades', name: 'trades', component: () => import('../modules/trades/ListView.vue'), meta: { title: 'Trading Desk' } },
  { path: '/trades/new', name: 'trades-create', component: () => import('../modules/trades/CreateView.vue'), meta: { title: 'Create Trade' } },
  { path: '/trades/:id/edit', name: 'trades-edit', component: () => import('../modules/trades/EditView.vue'), meta: { title: 'Edit Trade' } },
  { path: '/trades/:id', name: 'trades-detail', component: () => import('../modules/trades/DetailView.vue'), meta: { title: 'Trade Details' } },
  { path: '/customers', name: 'customers', component: () => import('../modules/customers/ListView.vue'), meta: { title: 'Customers' } },
  { path: '/customers/new', name: 'customers-create', component: () => import('../modules/customers/CreateView.vue'), meta: { title: 'Create Customer' } },
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
  { path: '/accounting', name: 'accounting', component: () => import('../modules/accounting/ListView.vue'), meta: { title: 'Accounting Ledger' } },
  { path: '/accounting/new', name: 'accounting-create', component: () => import('../modules/accounting/CreateView.vue'), meta: { title: 'Create Journal entry' } },
  { path: '/accounting/:id/edit', name: 'accounting-edit', component: () => import('../modules/accounting/EditView.vue'), meta: { title: 'Edit Journal entry' } },
  { path: '/accounting/:id', name: 'accounting-detail', component: () => import('../modules/accounting/DetailView.vue'), meta: { title: 'Journal entry Details' } },
  { path: '/compliance', name: 'compliance', component: () => import('../modules/compliance/ListView.vue'), meta: { title: 'Compliance / AML' } },
  { path: '/compliance/new', name: 'compliance-create', component: () => import('../modules/compliance/CreateView.vue'), meta: { title: 'Create Compliance case' } },
  { path: '/compliance/:id/edit', name: 'compliance-edit', component: () => import('../modules/compliance/EditView.vue'), meta: { title: 'Edit Compliance case' } },
  { path: '/compliance/:id', name: 'compliance-detail', component: () => import('../modules/compliance/DetailView.vue'), meta: { title: 'Compliance case Details' } },
  { path: '/decision-management', name: 'decision-management', component: () => import('../modules/decision-management/ListView.vue'), meta: { title: 'Decision Management' } },
  { path: '/decision-management/new', name: 'decision-management-create', component: () => import('../modules/decision-management/CreateView.vue'), meta: { title: 'Create Decision rule' } },
  { path: '/decision-management/:id/edit', name: 'decision-management-edit', component: () => import('../modules/decision-management/EditView.vue'), meta: { title: 'Edit Decision rule' } },
  { path: '/decision-management/:id', name: 'decision-management-detail', component: () => import('../modules/decision-management/DetailView.vue'), meta: { title: 'Decision rule Details' } },
  { path: '/audit', name: 'audit', component: () => import('../modules/audit/ListView.vue'), meta: { title: 'Audit Trail' } },
  { path: '/audit/new', name: 'audit-create', component: () => import('../modules/audit/CreateView.vue'), meta: { title: 'Create Audit event' } },
  { path: '/audit/:id/edit', name: 'audit-edit', component: () => import('../modules/audit/EditView.vue'), meta: { title: 'Edit Audit event' } },
  { path: '/audit/:id', name: 'audit-detail', component: () => import('../modules/audit/DetailView.vue'), meta: { title: 'Audit event Details' } },
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
    customers: ['customer-profiles:read'], 'customers-create': ['customer-profiles:create'], 'customers-edit': ['customer-profiles:update'], 'customers-detail': ['customer-profiles:read'],
    'reference-currencies': ['reference-currencies:read'], 'reference-currencies-create': ['reference-currencies:create'], 'reference-currencies-edit': ['reference-currencies:update'], 'reference-currencies-detail': ['reference-currencies:read'],
    rates: ['exchange-rates:read'], 'rates-latest': ['exchange-rates:read'], 'rates-create': ['exchange-rates:create'], 'rates-edit': ['exchange-rates:update'], 'rates-detail': ['exchange-rates:read'],
    'service-fees': ['service-fees:read'], 'service-fees-create': ['service-fees:create'], 'service-fees-edit': ['service-fees:update'], 'service-fees-detail': ['service-fees:read'],
    trades: ['forex_transactions.view', 'forex_transactions.read'], 'trades-create': ['forex_transactions.create', 'forex_transactions:create'], 'trades-edit': [], 'trades-detail': ['forex_transactions.view', 'forex_transactions.read'],
    inventory: ['forex_inventory.view'], 'inventory-create': [], 'inventory-edit': [], 'inventory-detail': ['forex_inventory.view'],
    reversals: ['forex_transactions.receipt.view', 'forex_transactions.view', 'forex_transactions.read'], 'reversals-create': ['forex_transactions.reverse'], 'reversals-edit': [], 'reversals-detail': ['forex_transactions.receipt.view', 'forex_transactions.view'],
    accounting: ['forex_journal_entries.view'], 'accounting-create': [], 'accounting-edit': [], 'accounting-detail': ['forex_journal_entries.view'],
    compliance: ['forex_transactions.audit.view'], 'compliance-create': [], 'compliance-edit': [], 'compliance-detail': ['forex_transactions.audit.view'],
    'decision-management': ['forex_transactions.read_policy', 'forex_transactions.manage_policy'], 'decision-management-create': ['forex_transactions.manage_policy'], 'decision-management-edit': ['forex_transactions.manage_policy'], 'decision-management-detail': ['forex_transactions.read_policy', 'forex_transactions.manage_policy'],
    audit: ['forex_transactions.audit.view'], 'audit-create': [], 'audit-edit': [], 'audit-detail': ['forex_transactions.audit.view'],
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
    if (Object.prototype.hasOwnProperty.call(routePermissionMap, String(to.name || '')) && (!required.length || !required.some(hasPermission))) return { name: 'dashboard', query: { accessDenied: '1' } }
  }
  return true
})
export default router

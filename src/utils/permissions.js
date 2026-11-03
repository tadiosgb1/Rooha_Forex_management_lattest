const PERMISSIONS_STORAGE_KEY = 'permissions'

export function hasPermission(permission) {
  if (typeof permission !== 'string' || !permission.trim()) return false

  try {
    const storedPermissions = localStorage.getItem(PERMISSIONS_STORAGE_KEY)
    if (!storedPermissions) return false

    const permissions = JSON.parse(storedPermissions)
    return Array.isArray(permissions) && permissions.includes(permission.trim())
  } catch {
    return false
  }
}

export function savePermissions(permissions) {
  const safePermissions = Array.isArray(permissions)
    ? permissions.filter((permission) => typeof permission === 'string')
    : []

  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(safePermissions))
}

export function clearPermissions() {
  localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
}

const MODULE_PERMISSION_MAP = {
  users: { read: ['users:read'], create: ['users:create'], update: ['users:update'], delete: ['users:delete'] },
  roles: { read: ['roles:read'], create: ['roles:create'], update: ['roles:update'], delete: ['roles:delete'] },
  permissions: { read: ['permissions:read'], create: ['permissions:create'], update: ['permissions:update'], delete: ['permissions:delete'] },
  branches: { read: ['branches:read'], create: ['branches:create'], update: ['branches:update'], delete: ['branches:delete'] },
  customers: { read: ['customer-profiles:read'], create: ['customer-profiles:create'], update: ['customer-profiles:update'], delete: ['customer-profiles:delete'] },
  'reference-id-types': { read: ['reference-id-types:read'], create: ['reference-id-types:create'], update: ['reference-id-types:update'], delete: ['reference-id-types:delete'] },
  'currency-references': { read: ['reference-currencies:read'], create: ['reference-currencies:create'], update: ['reference-currencies:update'], delete: ['reference-currencies:delete'] },
  rates: { read: ['exchange-rates:read'], create: ['exchange-rates:create'], update: ['exchange-rates:update'], delete: ['exchange-rates:delete'] },
  'service-fees': { read: ['service-fees:read'], create: ['service-fees:create'], update: ['service-fees:update'], delete: ['service-fees:delete'] },
  trades: { read: ['forex_transactions.view', 'forex_transactions.read'], create: ['forex_transactions.create', 'forex_transactions:create'], update: [], delete: [] },
  inventory: { read: ['forex_inventory.view'], create: [], update: [], delete: [] },
  reversals: { read: ['forex_transactions.receipt.view', 'forex_transactions.view', 'forex_transactions.read'], create: ['forex_transactions.reverse'], update: [], delete: [] },
  accounting: { read: ['forex_journal_entries.view'], create: [], update: [], delete: [] },
  compliance: { read: ['forex_transactions.audit.view'], create: [], update: [], delete: [] },
  'decision-management': { read: ['forex_transactions.read_policy', 'forex_transactions.manage_policy'], create: ['forex_transactions.manage_policy'], update: ['forex_transactions.manage_policy'], delete: [] },
  audit: { read: ['forex_transactions.audit.view'], create: [], update: [], delete: [] },
}

export function hasAnyPermission(permissions) {
  return Array.isArray(permissions) && permissions.some((permission) => hasPermission(permission))
}

export function hasModulePermission(moduleKey, action) {
  const permissions = MODULE_PERMISSION_MAP[moduleKey]?.[action]
  return hasAnyPermission(permissions || [])
}

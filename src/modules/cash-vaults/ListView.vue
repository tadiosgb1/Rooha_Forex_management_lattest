<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { confirmAction } from '../../composables/confirmAction'
import { cashVaultService } from '../../services/cashVaultService'
import { listBranches } from '../../services/branchService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'
import { cashVaultBalanceService } from '../../services/cashVaultBalanceService'
import { apiRequest } from '../../services/apiClient'

const router = useRouter()
const vaults = ref([])
const branches = ref([])
const users = ref([])
const currencies = ref([])
const balances = ref([])
const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const actionLoadingId = ref('')
const expandedRowId = ref('')
const openActionMenuId = ref('')
const actionMenuStyle = ref({})
const openSessionModal = ref(false)
const openingVault = ref(null)
const openingBalances = ref([])
const openingBalancesLoading = ref(false)
const openingBalancesEditable = ref(false)
const openingSessionLoading = ref(false)
const openingSessionError = ref('')
function toggleActionMenu(row, event) {
  const id = String(rowId(row))
  if (openActionMenuId.value === id) {
    openActionMenuId.value = ''
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  const menuWidth = 230
  const viewportPadding = 8
  const top = Math.min(rect.bottom + 5, window.innerHeight - viewportPadding)
  const availableHeight = Math.max(100, window.innerHeight - top - viewportPadding)
  actionMenuStyle.value = {
    top: `${top}px`,
    left: `${Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))}px`,
    maxHeight: `${availableHeight}px`,
  }
  openActionMenuId.value = id
}
function toggleDetails(row) {
  const id = String(rowId(row))
  expandedRowId.value = expandedRowId.value === id ? '' : id
}
function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
function branchFor(row) {
  return row.branch ?? branches.value.find(item => String(item.id) === String(row.branch_id)) ?? null
}
function currencyFor(row) {
  return row.currency ?? currencies.value.find(item => String(item.id) === String(row.currency_id)) ?? null
}
function userFor(row) {
  return row.assigned_user ?? row.assignedUser ?? users.value.find(item => String(item.id) === String(row.assigned_user_id)) ?? null
}
function personName(person, fallbackId) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.email || (fallbackId != null ? `User ${fallbackId}` : '—')
}
function userName(row) {
  return personName(userFor(row), row.assigned_user_id)
}
function makerName(row) {
  return personName(row.maker, row.maker_id)
}
function checkerName(row) {
  return personName(row.checker, row.checker_id)
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}
function balanceVaultId(balance) { return balance.vault_id ?? balance.vault?.id ?? balance.cash_vault_id }
function balanceCurrency(balance) { return balance.currency ?? currencies.value.find(item => String(item.id) === String(balance.currency_id)) ?? null }
function formatMoney(value) { const amount = Number(value); return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—' }
function balancesFor(row) {
  const id = String(row.vault_id ?? row.id ?? row.cash_vault_id)
  return balances.value.filter(item => String(balanceVaultId(item)) === id)
}
function formatBalances(row) {
  const items = balancesFor(row)
  if (!items.length) return 'No balances'
  return items.map(item => {
    const currency = balanceCurrency(item)
    return (currency?.code || item.currency_code || 'Currency') + ' ' + formatMoney(item.current_balance)
  }).join(' · ')
}
function rowId(row) { return row.id ?? row.cash_vault_id ?? row.vault_id }
function statusOf(row) {
  return String(row.status ?? (row.is_active === false ? 'INACTIVE' : 'ACTIVE')).toUpperCase().replace(/[ -]+/g, '_')
}
function isPending(row) { return statusOf(row) === 'PENDING' }
function isClosed(row) { return statusOf(row) === 'CLOSED' }
function isActive(row) { return ['ACTIVE', 'APPROVED', 'OPEN'].includes(statusOf(row)) && row.is_active !== false }
function canReactivate(row) { return ['INACTIVE', 'SUSPENDED', 'DISABLED'].includes(statusOf(row)) || row.is_active === false }
const actionDefinitions = {
  approve: { label: 'Approve', title: 'Approve cash vault', message: row => `Approve cash vault ${row.vault_code || row.vault_name || rowId(row)}?`, variant: 'primary', success: 'Cash vault approved.' },
  reject: { label: 'Reject', title: 'Reject cash vault', message: row => `Reject cash vault ${row.vault_code || row.vault_name || rowId(row)}?`, variant: 'danger', success: 'Cash vault rejected.' },
  reactivate: { label: 'Reactivate', title: 'Reactivate cash vault', message: row => `Reactivate cash vault ${row.vault_code || row.vault_name || rowId(row)}?`, variant: 'primary', success: 'Cash vault reactivated.' },
  suspend: { label: 'Suspend', title: 'Suspend cash vault', message: row => `Suspend cash vault ${row.vault_code || row.vault_name || rowId(row)}?`, variant: 'danger', success: 'Cash vault suspended.' },
  close: { label: 'Close', title: 'Close cash vault', message: row => `Close cash vault ${row.vault_code || row.vault_name || rowId(row)}? This may prevent further use.`, variant: 'danger', success: 'Cash vault closed.' },
  openTillSession: { label: 'Open till session', title: 'Open till session', message: row => `Open a till session for cash vault ${row.vault_code || row.vault_name || rowId(row)}?`, variant: 'primary', success: 'Till session opened successfully.' },
}
async function startOpenTillSession(row) {
  openActionMenuId.value = ''
  const id = row.vault_id ?? row.id ?? row.cash_vault_id
  if (id == null) {
    errorMessage.value = 'Cash vault ID is missing.'
    return
  }

  openingVault.value = row
  openingBalances.value = []
  openingBalancesEditable.value = false
  openingSessionError.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  openingBalancesLoading.value = true
  openSessionModal.value = true
  try {
    // Load balances for this vault only; never assume the opening balance is zero.
    const response = await cashVaultBalanceService.list({ vault_id: String(id) })
    const vaultBalances = normalize(response).filter(balance =>
      String(balanceVaultId(balance)) === String(id),
    )
    openingBalances.value = currencies.value
      .filter(currency => currency.is_active !== false && currency.is_deleted !== true)
      .map(currency => {
        const existing = vaultBalances.find(balance =>
          String(balance.currency_id ?? balance.currency?.id) === String(currency.id),
        )
        const currentBalance = Number(existing?.current_balance ?? 0)
        return {
          currency_id: String(currency.id),
          label: [currency.code, currency.name].filter(Boolean).join(' — ') || String(currency.id),
          current_balance: Number.isFinite(currentBalance) ? currentBalance : 0,
          opening_balance: String(Number.isFinite(currentBalance) ? currentBalance : 0),
        }
      })
  } catch (error) {
    openSessionModal.value = false
    openingVault.value = null
    errorMessage.value = error?.message || 'Unable to load this vault’s existing currency balances. The session was not opened.'
  } finally {
    openingBalancesLoading.value = false
  }
}
function dismissOpenSessionModal() {
  if (openingSessionLoading.value) return
  openSessionModal.value = false
  openingVault.value = null
  openingBalances.value = []
  openingBalancesEditable.value = false
  openingSessionError.value = ''
}
async function submitOpenTillSession() {
  const id = openingVault.value?.vault_id ?? rowId(openingVault.value)
  if (id == null) { openingSessionError.value = 'Cash vault ID is missing.'; return }
  if (!openingBalances.value.length) { openingSessionError.value = 'No active currencies are available for this session.'; return }
  const balancesPayload = []
  for (const row of openingBalances.value) {
    const rawAmount = String(row.opening_balance ?? '').trim()
    const amount = Number(rawAmount)
    if (!rawAmount || !Number.isFinite(amount) || amount < 0) {
      openingSessionError.value = `Enter a valid opening balance of zero or more for ${row.label}.`
      return
    }
    balancesPayload.push({ currency_id: row.currency_id, opening_balance: amount })
  }
  openingSessionLoading.value = true
  openingSessionError.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await cashVaultService.openTillSession({ vault_id: String(id), balances: balancesPayload })
    openSessionModal.value = false
    successMessage.value = 'Till session opened successfully.'
    openingVault.value = null
    openingBalances.value = []
    openingBalancesEditable.value = false
    openingSessionError.value = ''
    await load()
  } catch (error) {
    const responseData = error?.response?.data ?? error?.data ?? error
    const message = responseData?.message
    openingSessionError.value = Array.isArray(message) ? message.join(', ') : (message || error?.message || 'Unable to open till session.')
  } finally { openingSessionLoading.value = false }
}
async function runAction(row, action) {
  const requiredPermission = { approve: 'cash-vaults:approve', reject: 'cash-vaults:reject', reactivate: 'cash-vaults:reactivate', suspend: 'cash-vaults:suspend', close: 'cash-vaults:close' }[action]
  if (!requiredPermission || !hasPermission(requiredPermission)) return
  const definition = actionDefinitions[action]
  const id = rowId(row)
  openActionMenuId.value = ''
  if (id == null) {
    errorMessage.value = 'Cannot perform this action: the cash vault ID is missing.'
    successMessage.value = ''
    return
  }
  const confirmed = await confirmAction({
    title: definition.title,
    message: definition.message(row),
    confirmText: definition.label,
    confirmVariant: definition.variant,
  })
  if (!confirmed) return
  actionLoadingId.value = String(id)
  errorMessage.value = ''
  successMessage.value = ''
  try {
    if (action === 'openTillSession') {
      await cashVaultService.openTillSession({
        vault_id: String(row.vault_id ?? id),
        balances: currencies.value
          .filter(currency => currency.is_active !== false && currency.is_deleted !== true)
          .map(currency => ({ currency_id: String(currency.id), opening_balance: 0 })),
      })
    } else {
      await cashVaultService[action](id)
    }
    successMessage.value = definition.success
    await load()
  } catch (error) {
    errorMessage.value = error?.message || `Unable to ${action} cash vault.`
  } finally {
    actionLoadingId.value = ''
  }
}
const rows = computed(() => {
  const query = search.value.trim().toLowerCase()
  return vaults.value.filter(row => !query || [
    row.vault_code, row.vault_name, row.vault_type, row.status,
    branchFor(row)?.branch_name, branchFor(row)?.branch_code,
    currencyFor(row)?.code, currencyFor(row)?.name, userName(row),
    makerName(row), checkerName(row), row.made_at, row.checked_at,
    formatBalances(row),
  ].some(value => String(value ?? '').toLowerCase().includes(query)))
})
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    // Cash vaults are the primary resource for this page. Load them independently
    // so missing permission for branches/users/balances cannot blank the register.
    const vaultResponse = await cashVaultService.list()
    vaults.value = normalize(vaultResponse)

    // These are supplementary: vault responses may already contain nested branch,
    // assigned-user, currency, and balance details. A 403 here must not hide vaults.
    const [branchResult, userResult, currencyResult, balanceResult] = await Promise.allSettled([
      listBranches({ page: 1, pageSize: 100, search: '', isActive: true }),
      apiRequest('users?page=1&page_size=100'),
      referenceCurrencyService.list({ page: 1, page_size: 100 }),
      cashVaultBalanceService.list(),
    ])

    branches.value = branchResult.status === 'fulfilled' ? normalize(branchResult.value) : []
    users.value = userResult.status === 'fulfilled' ? normalize(userResult.value) : []
    currencies.value = currencyResult.status === 'fulfilled' ? normalize(currencyResult.value) : []
    balances.value = balanceResult.status === 'fulfilled' ? normalize(balanceResult.value) : []
  } catch (error) {
    vaults.value = []
    errorMessage.value = error?.message || 'Unable to load cash vaults.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro"><div><h2>Cash Vaults &amp; Teller Tills</h2><p class="module-description">Manage cash vaults and teller tills, with branch, assigned user, and currency details.</p></div><BaseButton v-if="hasPermission('cash-vaults:create')" @click="router.push('/cash-vaults/new')">＋ Add Cash Vault</BaseButton></div>
    <section class="module-panel">
      <div class="module-panel-header"><h3>Cash vault register</h3><input v-model="search" class="ui-input" placeholder="Search cash vaults…" aria-label="Search cash vaults" style="max-width:280px" /></div>
      <p v-if="successMessage" role="status" style="padding:0 24px;color:#237747">{{ successMessage }}</p>
      <p v-if="errorMessage" role="alert" style="padding:0 24px;color:#b43f4a">{{ errorMessage }}</p>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead><tr><th>Vault</th><th>Branch</th><th>Maker / Made at</th><th>Checker / Checked at</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="6" style="text-align:center;padding:28px">Loading cash vaults…</td></tr>
            <tr v-else-if="!rows.length"><td colspan="6" style="text-align:center;padding:28px">No cash vaults found.</td></tr>
            <template v-for="row in rows" :key="rowId(row)">
              <tr>
                <td><strong>{{ row.vault_code || '—' }}</strong><div>{{ row.vault_name || '—' }}</div></td>
                <td>{{ branchFor(row)?.branch_name || branchFor(row)?.branch_code || '—' }}</td>
                <td><div>{{ makerName(row) }}</div><small style="display:block;margin-top:4px;color:var(--text-muted, #64748b)">{{ formatDate(row.made_at) }}</small></td>
                <td><div>{{ checkerName(row) }}</div><small style="display:block;margin-top:4px;color:var(--text-muted, #64748b)">{{ formatDate(row.checked_at) }}</small></td>
                <td><span class="module-status-chip" :class="row.is_active === false || ['REJECTED','SUSPENDED','CLOSED','INACTIVE'].includes(statusOf(row)) ? 'blocked' : 'active'">{{ row.status || (row.is_active === false ? 'Inactive' : 'Active') }}</span></td>
                <td>
                  <div class="vault-actions">
                    <button type="button" class="vault-more-trigger" :aria-label="`Actions for ${row.vault_name || row.vault_code || 'cash vault'}`" :aria-expanded="openActionMenuId === String(rowId(row))" @click="toggleActionMenu(row, $event)">
                      <span aria-hidden="true">•••</span>
                    </button>
                    <div v-if="openActionMenuId === String(rowId(row))" class="vault-action-menu" :style="actionMenuStyle" role="menu">
                      <button type="button" role="menuitem" class="vault-action-item" @click="openActionMenuId = ''; toggleDetails(row)">{{ expandedRowId === String(rowId(row)) ? 'Hide details' : 'View details' }}</button>

                      <button v-if="hasPermission('cash-vault-balances:read')" type="button" role="menuitem" class="vault-action-item" @click="openActionMenuId = ''; router.push({ name: 'cash-vault-balances', params: { vault_id: String(row.vault_id ?? row.id ?? row.cash_vault_id) } })"><span class="vault-action-icon" aria-hidden="true">▤</span>View currency balances</button>
                      <button v-if="hasPermission('till-sessions:read')" type="button" role="menuitem" class="vault-action-item" @click="openActionMenuId = ''; router.push({ name: 'till-sessions', query: { vault_id: String(row.vault_id ?? row.id ?? row.cash_vault_id) } })"><span class="vault-action-icon" aria-hidden="true">▤</span>View till sessions</button>
                      <button v-if="hasPermission('till-sessions:open')" type="button" role="menuitem" class="vault-action-item" :disabled="actionLoadingId === String(rowId(row))" @click="startOpenTillSession(row)"><span class="vault-action-icon" aria-hidden="true">↗</span>Open till session</button>
                      <button v-if="hasPermission('cash-vaults:update')" type="button" role="menuitem" class="vault-action-item" @click="openActionMenuId = ''; router.push(`/cash-vaults/${rowId(row)}/edit`)"><span class="vault-action-icon" aria-hidden="true">✎</span>Edit cash vault</button>
                      <button v-if="!isActive(row) && hasPermission('cash-vaults:approve')" type="button" role="menuitem" class="vault-action-item" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'approve')"><span class="vault-action-icon" aria-hidden="true">✓</span>Approve</button>
                      <button v-if="hasPermission('cash-vaults:reject')" type="button" role="menuitem" class="vault-action-item is-danger" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'reject')"><span class="vault-action-icon" aria-hidden="true">✕</span>Reject</button>
                      <button v-if="canReactivate(row) && hasPermission('cash-vaults:reactivate')" type="button" role="menuitem" class="vault-action-item" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'reactivate')"><span class="vault-action-icon" aria-hidden="true">↻</span>Reactivate</button>
                      <button v-if="isActive(row) && hasPermission('cash-vaults:suspend')" type="button" role="menuitem" class="vault-action-item is-danger" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'suspend')"><span class="vault-action-icon" aria-hidden="true">Ⅱ</span>Suspend</button>
                      <button v-if="!isClosed(row) && hasPermission('cash-vaults:close')" type="button" role="menuitem" class="vault-action-item is-danger" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'close')"><span class="vault-action-icon" aria-hidden="true">⊗</span>Close</button>
                    </div>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedRowId === String(rowId(row))">
                <td colspan="6" style="padding:16px;background:var(--surface-subtle, #f8fafc)">
                  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
                    <div><small style="color:var(--text-muted, #64748b)">Vault code</small><div>{{ row.vault_code || '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Vault name</small><div>{{ row.vault_name || '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Vault type</small><div>{{ row.vault_type || '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Branch</small><div>{{ branchFor(row)?.branch_name || branchFor(row)?.branch_code || '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Assigned user</small><div>{{ userName(row) }}</div></div>
                    <div style="grid-column:1/-1"><small style="color:var(--text-muted, #64748b)">Balances by currency</small><div>{{ formatBalances(row) }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Maker</small><div>{{ makerName(row) }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Made at</small><div>{{ formatDate(row.made_at) }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Checker</small><div>{{ checkerName(row) }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Checked at</small><div>{{ formatDate(row.checked_at) }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Status</small><div>{{ row.status || (row.is_active === false ? 'Inactive' : 'Active') }}</div></div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">Showing {{ rows.length }} of {{ vaults.length }} cash vaults</div>
    </section>
  </section>
  <div v-if="openSessionModal" class="session-modal-backdrop" @click.self="dismissOpenSessionModal">
    <section class="session-modal" role="dialog" aria-modal="true" aria-labelledby="open-session-title">
      <div class="session-modal-heading">
        <div><p class="session-eyebrow">TILL SESSION</p><h3 id="open-session-title">Open till session</h3></div>
        <button type="button" class="session-modal-close" aria-label="Close modal" :disabled="openingSessionLoading" @click="dismissOpenSessionModal">×</button>
      </div>
      <div v-if="openingVault" class="session-vault-summary">
        <span class="session-summary-label">Cash vault</span>
        <strong>{{ openingVault.vault_name || openingVault.vault_code || rowId(openingVault) }}</strong>
        <small>{{ openingVault.vault_code || "" }}</small>
      </div>
      <p v-if="openingSessionError" class="session-modal-error" role="alert">{{ openingSessionError }}</p>
      <div class="opening-balance-list">
        <p v-if="openingBalancesLoading" class="session-field-help">Loading balances…</p>
        <div v-if="openingBalances.length" class="opening-balance-toolbar"><span>Opening balances</span><button v-if="hasPermission('cash-vault-balances:update')" type="button" class="session-edit-button" :aria-label="openingBalancesEditable ? &quot;Finish editing balances&quot; : &quot;Edit opening balances&quot;" :title="openingBalancesEditable ? &quot;Finish editing&quot; : &quot;Edit balances&quot;" :disabled="openingBalancesLoading || openingSessionLoading" @click="openingBalancesEditable = !openingBalancesEditable"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button></div>
        <div v-for="balance in openingBalances" :key="balance.currency_id" class="opening-balance-row">
          <div class="opening-balance-currency"><label :for="`opening-balance-${balance.currency_id}`">{{ balance.label }}</label><small>Current vault balance: {{ formatMoney(balance.current_balance) }}</small></div>
          <input :id="`opening-balance-${balance.currency_id}`" v-model="balance.opening_balance" class="ui-input" type="number" min="0" step="any" inputmode="decimal" required :disabled="openingSessionLoading || openingBalancesLoading || !openingBalancesEditable" />
        </div>
        <p v-if="!openingBalances.length && !openingBalancesLoading" class="session-field-help">No active currencies are available.</p>
      </div>
      <div class="session-modal-actions">
        <button type="button" class="session-btn session-btn-secondary" :disabled="openingSessionLoading" @click="dismissOpenSessionModal">Cancel</button>
        <button v-if="hasPermission('till-sessions:open')" type="button" class="session-btn session-btn-primary" :disabled="openingSessionLoading || openingBalancesLoading || !openingBalances.length" @click="submitOpenTillSession">{{ openingSessionLoading ? "Opening…" : "Open till session" }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.vault-actions {
  position: relative;
  display: flex;
  justify-content: center;
  min-width: 44px;
}
.vault-more-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color, #dbe2ea);
  border-radius: 8px;
  background: var(--surface, #fff);
  color: var(--text-primary, #263445);
  cursor: pointer;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 1px;
}
.vault-more-trigger:hover,
.vault-more-trigger[aria-expanded="true"] {
  background: var(--surface-subtle, #f1f5f9);
}
.vault-action-menu {
  position: fixed;
  z-index: 9999;
  min-width: 176px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 5px 0;
  border: 1px solid var(--border-color, #dbe2ea);
  border-radius: 9px;
  background: var(--surface, #fff);
  box-shadow: 0 10px 28px rgb(15 23 42 / 16%);
}
.vault-action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 14px;
  border: 0;
  background: transparent;
  color: var(--text-primary, #263445);
  text-align: left;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.vault-action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
  width: 16px;
  font-size: 15px;
  line-height: 1;
}
.vault-action-item:hover:not(:disabled) {
  background: var(--surface-subtle, #f1f5f9);
}
.vault-action-item.is-danger {
  color: var(--danger, #b42332);
}
.vault-action-item:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.session-modal-backdrop { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgb(15 23 42 / 48%); }
.session-modal { width: min(100%, 820px); padding: 24px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 16px; background: var(--surface, #fff); color: var(--text-primary, #172033); box-shadow: 0 24px 70px rgb(15 23 42 / 24%); }
.session-modal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.session-modal-heading h3 { margin: 0; font-size: 21px; font-weight: 700; }
.session-eyebrow { margin: 0 0 6px; color: var(--text-muted, #64748b); font-size: 11px; font-weight: 700; letter-spacing: .1em; }
.session-modal-description { margin: 8px 0 0; color: var(--text-muted, #64748b); font-size: 13px; }
.session-modal-close { border: 0; background: transparent; color: var(--text-muted, #64748b); font-size: 25px; cursor: pointer; line-height: 1; }
.session-modal-close:disabled { opacity: .5; cursor: not-allowed; }
.session-vault-summary { display: grid; gap: 4px; margin: 22px 0; padding: 13px 15px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 10px; background: var(--surface-subtle, #f8fafc); }
.session-summary-label { color: var(--text-muted, #64748b); font-size: 12px; }
.session-vault-summary strong { font-size: 14px; }
.session-vault-summary small { color: var(--text-muted, #64748b); }
.opening-balance-list { display: grid; gap: 12px; max-height: min(52vh, 480px); overflow-y: auto; margin-top: 20px; padding-right: 4px; }
.opening-balance-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 2px; font-size: 13px; font-weight: 700; }
.session-edit-button { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid var(--border-color, #dbe2ea); border-radius: 8px; background: var(--surface, #fff); color: var(--text-primary, #263445); cursor: pointer; }
.session-edit-button:hover:not(:disabled) { background: var(--surface-subtle, #f1f5f9); }
.session-edit-button:disabled { opacity: .5; cursor: not-allowed; }
.session-edit-button svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.opening-balance-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(120px, 180px); align-items: center; gap: 14px; }
.opening-balance-currency { display: grid; gap: 4px; min-width: 0; }\n.opening-balance-currency label { font-size: 13px; font-weight: 650; }\n.opening-balance-currency small { color: var(--text-muted, #64748b); font-size: 12px; }
.opening-balance-row .ui-input { width: 100%; min-width: 0; min-height: 42px; }
.session-field-help { margin: 0; color: var(--text-muted, #64748b); font-size: 12px; line-height: 1.5; }
.session-modal-error { margin: 18px 0 0; padding: 11px 13px; border: 1px solid #f2b8bd; border-radius: 8px; background: #fff1f2; color: #b42332; font-size: 13px; line-height: 1.5; }
.session-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 26px; }
.session-btn { min-height: 40px; padding: 9px 15px; border: 1px solid transparent; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.session-btn:disabled { opacity: .6; cursor: not-allowed; }
.session-btn-secondary { border-color: var(--border-color, #dbe2ea); background: var(--surface, #fff); color: var(--text-primary, #263445); }
.session-btn-primary { background: var(--primary, #2457c5); color: #fff; }
@media (max-width: 600px) { .session-modal { padding: 19px; } .opening-balance-row { grid-template-columns: minmax(0, 1fr); gap: 8px; } .session-modal-actions { flex-direction: column-reverse; } .session-btn { width: 100%; } }
</style>
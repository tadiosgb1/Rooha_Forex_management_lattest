<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { confirmAction } from '../../composables/confirmAction'
import { cashVaultService } from '../../services/cashVaultService'
import { listBranches } from '../../services/branchService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'
import { apiRequest } from '../../services/apiClient'

const router = useRouter()
const vaults = ref([])
const branches = ref([])
const users = ref([])
const currencies = ref([])
const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const actionLoadingId = ref('')
const openTillModalOpen = ref(false)
const openingVault = ref(null)
const openingBalance = ref('')
const openTillError = ref('')
const expandedRowId = ref('')
const openActionMenuId = ref('')
const actionMenuStyle = ref({})
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
function formatBalance(row) {
  const amount = Number(row.balance)
  if (!Number.isFinite(amount)) return '—'
  const currency = currencyFor(row)
  return `${currency?.code ? currency.code + ' ' : ''}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
async function runAction(row, action) {
  const definition = actionDefinitions[action]
  const id = rowId(row)
  openActionMenuId.value = ''
  if (id == null) {
    errorMessage.value = 'Cannot perform this action: the cash vault ID is missing.'
    successMessage.value = ''
    return
  }
  if (action === 'openTillSession') {
    openingVault.value = row
    openingBalance.value = String(row.current_balance ?? row.balance ?? 0)
    openTillError.value = ''
    openTillModalOpen.value = true
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
    await cashVaultService[action](id)
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
    row.balance,
  ].some(value => String(value ?? '').toLowerCase().includes(query)))
})
function dismissOpenTillModal() {
  if (actionLoadingId.value) return
  openTillModalOpen.value = false
  openingVault.value = null
  openingBalance.value = ''
  openTillError.value = ''
}
async function submitOpenTillSession() {
  if (!openingVault.value) return
  const rawBalance = String(openingBalance.value).trim()
  const balance = Number(rawBalance)
  if (!rawBalance || !Number.isFinite(balance) || balance < 0) {
    openTillError.value = 'Enter a valid non-negative opening balance.'
    return
  }

  const vaultId = openingVault.value.vault_id ?? rowId(openingVault.value)
  if (vaultId == null) {
    openTillError.value = 'Cannot open a session because the cash vault ID is missing.'
    return
  }

  actionLoadingId.value = String(rowId(openingVault.value))
  openTillError.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await cashVaultService.openTillSession(vaultId, balance)
    openTillModalOpen.value = false
    openingVault.value = null
    openingBalance.value = ''
    successMessage.value = 'Till session opened successfully.'
    await load()
  } catch (error) {
    openTillError.value = error?.message || 'Unable to open till session.'
  } finally {
    actionLoadingId.value = ''
  }
}
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [vaultResponse, branchResponse, userResponse, currencyResponse] = await Promise.all([
      cashVaultService.list(),
      listBranches({ page: 1, pageSize: 100, search: '', isActive: true }),
      apiRequest('users?page=1&page_size=100'),
      referenceCurrencyService.list({ page: 1, page_size: 100 }),
    ])
    vaults.value = normalize(vaultResponse)
    branches.value = normalize(branchResponse)
    users.value = normalize(userResponse)
    currencies.value = normalize(currencyResponse)
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load cash vaults.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro"><div><h2>Cash Vaults &amp; Teller Tills</h2><p class="module-description">Manage cash vaults and teller tills, with branch, assigned user, and currency details.</p></div><BaseButton @click="router.push('/cash-vaults/new')">＋ Add Cash Vault</BaseButton></div>
    <section class="module-panel">
      <div class="module-panel-header"><h3>Cash vault register</h3><input v-model="search" class="ui-input" placeholder="Search cash vaults…" aria-label="Search cash vaults" style="max-width:280px" /></div>
      <p v-if="successMessage" role="status" style="padding:0 24px;color:#237747">{{ successMessage }}</p>
      <p v-if="errorMessage" role="alert" style="padding:0 24px;color:#b43f4a">{{ errorMessage }}</p>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead><tr><th>Vault</th><th>Branch</th><th>Balance</th><th>Maker / Made at</th><th>Checker / Checked at</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" style="text-align:center;padding:28px">Loading cash vaults…</td></tr>
            <tr v-else-if="!rows.length"><td colspan="7" style="text-align:center;padding:28px">No cash vaults found.</td></tr>
            <template v-for="row in rows" :key="rowId(row)">
              <tr>
                <td><strong>{{ row.vault_code || '—' }}</strong><div>{{ row.vault_name || '—' }}</div></td>
                <td>{{ branchFor(row)?.branch_name || branchFor(row)?.branch_code || '—' }}</td>
                <td>{{ formatBalance(row) }}</td>
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
                      <button type="button" role="menuitem" class="vault-action-item" @click="openActionMenuId = ''; router.push({ name: 'till-sessions', query: { vault_id: String(row.vault_id ?? row.id ?? row.cash_vault_id) } })"><span class="vault-action-icon" aria-hidden="true">▤</span>View till sessions</button>
                      <button type="button" role="menuitem" class="vault-action-item" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'openTillSession')"><span class="vault-action-icon" aria-hidden="true">↗</span>Open till session</button>
                      <button type="button" role="menuitem" class="vault-action-item" @click="openActionMenuId = ''; router.push(`/cash-vaults/${rowId(row)}/edit`)"><span class="vault-action-icon" aria-hidden="true">✎</span>Edit cash vault</button>
                      <button v-if="!isActive(row)" type="button" role="menuitem" class="vault-action-item" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'approve')"><span class="vault-action-icon" aria-hidden="true">✓</span>Approve</button>
                      <button type="button" role="menuitem" class="vault-action-item is-danger" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'reject')"><span class="vault-action-icon" aria-hidden="true">✕</span>Reject</button>
                      <button v-if="canReactivate(row)" type="button" role="menuitem" class="vault-action-item" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'reactivate')"><span class="vault-action-icon" aria-hidden="true">↻</span>Reactivate</button>
                      <button v-if="isActive(row)" type="button" role="menuitem" class="vault-action-item is-danger" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'suspend')"><span class="vault-action-icon" aria-hidden="true">Ⅱ</span>Suspend</button>
                      <button v-if="!isClosed(row)" type="button" role="menuitem" class="vault-action-item is-danger" :disabled="actionLoadingId === String(rowId(row))" @click="runAction(row, 'close')"><span class="vault-action-icon" aria-hidden="true">⊗</span>Close</button>
                    </div>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedRowId === String(rowId(row))">
                <td colspan="7" style="padding:16px;background:var(--surface-subtle, #f8fafc)">
                  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
                    <div><small style="color:var(--text-muted, #64748b)">Vault code</small><div>{{ row.vault_code || '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Vault name</small><div>{{ row.vault_name || '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Vault type</small><div>{{ row.vault_type || '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Branch</small><div>{{ branchFor(row)?.branch_name || branchFor(row)?.branch_code || '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Assigned user</small><div>{{ userName(row) }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Currency</small><div>{{ currencyFor(row) ? [currencyFor(row).code, currencyFor(row).name].filter(Boolean).join(' — ') : '—' }}</div></div>
                    <div><small style="color:var(--text-muted, #64748b)">Current balance</small><div>{{ formatBalance(row) }}</div></div>
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
  <div v-if="openTillModalOpen" class="session-modal-backdrop" @click.self="dismissOpenTillModal">
    <section class="session-modal" role="dialog" aria-modal="true" aria-labelledby="open-session-title">
      <div class="session-modal-heading">
        <div class="session-modal-icon" aria-hidden="true">↗</div>
        <div>
          <h3 id="open-session-title">Open till session</h3>
          <p>Confirm the cash available at the start of this teller session.</p>
        </div>
        <button type="button" class="session-modal-dismiss" aria-label="Cancel opening session" :disabled="!!actionLoadingId" @click="dismissOpenTillModal">×</button>
      </div>
      <div class="session-modal-body">
        <div class="session-modal-summary">
          <span>Cash vault</span>
          <strong>{{ openingVault?.vault_code || '—' }} · {{ openingVault?.vault_name || 'Unnamed vault' }}</strong>
        </div>
        <div class="session-modal-summary">
          <span>Existing vault balance</span>
          <strong>{{ formatBalance(openingVault || {}) }}</strong>
        </div>
        <label class="session-balance-field" for="opening-balance">
          <span>Opening balance</span>
          <input id="opening-balance" v-model="openingBalance" class="ui-input" type="number" min="0" step="0.0001" inputmode="decimal" placeholder="Enter opening balance" :disabled="!!actionLoadingId" @keydown.enter.prevent="submitOpenTillSession" />
          <small>The existing balance is prefilled. You can edit it; the value you submit will be saved as this session's opening_balance.</small>
        </label>
        <p v-if="openTillError" role="alert" class="session-modal-error">{{ openTillError }}</p>
      </div>
      <div class="session-modal-footer">
        <BaseButton variant="secondary" :disabled="!!actionLoadingId" @click="dismissOpenTillModal">Cancel</BaseButton>
        <BaseButton :loading="!!actionLoadingId" @click="submitOpenTillSession">Open session</BaseButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.session-modal-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.56);backdrop-filter:blur(3px)}
.session-modal{width:min(100%,480px);overflow:hidden;border:1px solid var(--border-color,#e2e8f0);border-radius:16px;background:var(--surface,#fff);color:var(--text-primary,#0f172a);box-shadow:0 24px 70px rgba(15,23,42,.24)}
.session-modal-heading{display:flex;align-items:flex-start;gap:14px;padding:24px 24px 20px;border-bottom:1px solid var(--border-color,#e2e8f0)}
.session-modal-icon{display:grid;flex:0 0 42px;width:42px;height:42px;place-items:center;border-radius:12px;background:var(--surface-subtle,#f1f5f9);color:var(--text-primary,#0f172a);font-size:23px}
.session-modal-heading h3{margin:1px 0 5px;font-size:18px;font-weight:650}
.session-modal-heading p{margin:0;color:var(--text-muted,#64748b);font-size:13px;line-height:1.5}
.session-modal-dismiss{margin:-5px -8px 0 auto;border:0;background:transparent;color:var(--text-muted,#64748b);font-size:26px;line-height:1;cursor:pointer}
.session-modal-dismiss:disabled{opacity:.5;cursor:not-allowed}
.session-modal-body{display:grid;gap:20px;padding:24px}
.session-modal-summary{display:grid;gap:6px;padding:12px 14px;border:1px solid var(--border-color,#e2e8f0);border-radius:10px;background:var(--surface-muted,#f8fafc)}
.session-modal-summary span,.session-balance-field>span{color:var(--text-muted,#64748b);font-size:12px;font-weight:600}
.session-modal-summary strong{overflow-wrap:anywhere;font-size:13px}
.session-balance-field{display:grid;gap:8px}
.session-balance-field .ui-input{width:100%;min-height:44px}
.session-balance-field small{color:var(--text-muted,#64748b);font-size:12px;line-height:1.5}
.session-modal-error{margin:0;color:#b42318;font-size:13px}
.session-modal-footer{display:flex;justify-content:flex-end;gap:10px;padding:16px 24px 22px;border-top:1px solid var(--border-color,#e2e8f0)}
@media(max-width:520px){.session-modal-backdrop{padding:14px}.session-modal-heading,.session-modal-body{padding:18px}.session-modal-footer{padding:14px 18px 18px}}
</style>
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
</style>

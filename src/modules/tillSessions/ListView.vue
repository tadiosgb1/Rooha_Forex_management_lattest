<script setup>
import { hasPermission, hasAnyPermission } from '../../utils/permissions'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { tillSessionService } from '../../services/tillSessionService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'

const route = useRoute()
const router = useRouter()
const sessions = ref([])
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const pageSize = ref(10)
const status = ref('')
const totalPages = ref(1)
const totalCount = ref(0)
const closeModalOpen = ref(false)
const closingSession = ref(null)
const closingBalances = ref([])
const closingBalancesLoading = ref(false)
const closingBalancesError = ref('')
const balanceModalOpen = ref(false)
const balanceSession = ref(null)
const viewBalancesModalOpen = ref(false)
const viewingBalancesSession = ref(null)
const sessionBalances = ref([])
const sessionBalancesLoading = ref(false)
const sessionBalancesError = ref('')
const balanceCurrencyId = ref('')
const referenceCurrencies = ref([])
const currenciesLoading = ref(false)
const currenciesError = ref('')
const balanceOpening = ref('')
const balanceClosing = ref('')
const openActionsSessionId = ref(null)
const sessionActionsDropdownStyle = ref({})
const activeActionsSession = computed(() => sessions.value.find(session => session.id === openActionsSessionId.value) || null)
const vaultId = computed(() => typeof route.query.vault_id === 'string' ? route.query.vault_id.trim() : '')
const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'RECONCILED', label: 'Reconciled' },
]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}
function personName(person, fallbackId) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(' ') || (fallbackId != null ? `User ${fallbackId}` : '—')
}
function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.sessions)) return value.sessions
  return []
}
function vaultDisplayName(session) {
  const vault = session?.vault ?? {}
  return [vault.vault_name, vault.vault_code].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(' · ') || 'Vault details unavailable'
}
function sessionCodeLabel(session) {
  return session?.session_code || 'Session code unavailable'
}
function toggleSessionActions(session, event) {
  if (openActionsSessionId.value === session.id) {
    closeSessionActions()
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  const menuWidth = 180
  const menuHeight = 190
  const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
  const top = rect.bottom + menuHeight > window.innerHeight - 8
    ? Math.max(8, rect.top - menuHeight - 6)
    : rect.bottom + 6
  sessionActionsDropdownStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    right: 'auto',
    zIndex: 2147483647,
  }
  openActionsSessionId.value = session.id
}
function closeSessionActions() {
  openActionsSessionId.value = null
}
function runSessionAction(action, session) {
  closeSessionActions()
  action(session)
}
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await tillSessionService.list({
      ...(vaultId.value ? { vault_id: vaultId.value } : {}),
      page: page.value,
      pageSize: pageSize.value,
      ...(status.value ? { status: status.value } : {}),
    })
    sessions.value = normalize(response)
    const pageMeta = response?.data && !Array.isArray(response.data) ? response.data : response
    totalPages.value = Math.max(1, Number(pageMeta?.total_pages ?? pageMeta?.meta?.total_pages) || 1)
    totalCount.value = Math.max(0, Number(pageMeta?.count ?? pageMeta?.total_count ?? pageMeta?.meta?.total ?? pageMeta?.meta?.total_count) || sessions.value.length)
  } catch (error) {
    sessions.value = []
    errorMessage.value = error?.message || 'Unable to load till sessions.'
  } finally {
    loading.value = false
  }
}
function changePage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  page.value = nextPage
  load()
}
async function closeSession(session) {
  if (String(session.status || '').toUpperCase() !== 'OPEN') return
  closingSession.value = session
  closingBalances.value = []
  closingBalancesError.value = ''
  errorMessage.value = ''
  closeModalOpen.value = true
  closingBalancesLoading.value = true
  try {
    const response = await tillSessionService.listBalances(session.id)
    closingBalances.value = normalizeBalances(response).map(balance => ({
      currency_id: balance.currency_id ?? balance.currency?.id ?? balance.currency_detail?.id ?? '',
      currency_label: currencyLabel(balance),
      closing_balance: balance.closing_balance == null ? '' : String(balance.closing_balance),
    }))
    if (!closingBalances.value.length) {
      closingBalancesError.value = 'No currency balances were found for this session. Add a currency balance before closing.'
    } else if (closingBalances.value.some(balance => !balance.currency_id)) {
      closingBalancesError.value = 'One or more session balances are missing a currency ID. Refresh the balances before closing.'
    }
  } catch (error) {
    closingBalancesError.value = error?.message || 'Unable to load currency balances for this session.'
  } finally {
    closingBalancesLoading.value = false
  }
}
function dismissCloseModal() {
  if (loading.value || closingBalancesLoading.value) return
  closeModalOpen.value = false
  closingSession.value = null
  closingBalances.value = []
  closingBalancesError.value = ''
}
async function submitCloseSession() {
  if (!closingSession.value) return
  if (closingBalancesLoading.value) return
  if (!closingBalances.value.length) {
    errorMessage.value = 'Add at least one currency balance before closing this session.'
    return
  }
  if (closingBalances.value.some(balance => !balance.currency_id)) {
    errorMessage.value = 'A currency ID is missing from the session balances. Refresh the balances before closing.'
    return
  }
  const balances = closingBalances.value.map((balance, index) => {
    const rawBalance = String(balance.closing_balance).trim()
    const closingBalance = Number(rawBalance)
    if (!rawBalance || !Number.isFinite(closingBalance) || closingBalance < 0) {
      return { index, invalid: true }
    }
    return {
      currency_id: balance.currency_id,
      closing_balance: closingBalance,
    }
  })
  if (balances.some(balance => balance.invalid)) {
    errorMessage.value = 'Enter a valid non-negative closing balance for every currency.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const payload = { balances }
    await tillSessionService.close(closingSession.value.id, payload)
    closeModalOpen.value = false
    closingSession.value = null
    closingBalances.value = []
    closingBalancesError.value = ''
    await load()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to close till session.'
  } finally {
    loading.value = false
  }
}
function normalizeBalances(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.balances)) return value.balances
  return []
}
function currencyLabel(balance) {
  const currency = balance?.currency ?? balance?.currency_detail ?? {}
  return [currency.code ?? balance?.currency_code, currency.name ?? balance?.currency_name]
    .filter(Boolean)
    .join(' — ') || (balance?.currency_id ? `Currency ${balance.currency_id}` : 'Unknown currency')
}
function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value)
}
async function openViewBalancesModal(session) {
  if (session?.id == null) {
    errorMessage.value = 'Session ID is missing; unable to load balances.'
    return
  }
  viewingBalancesSession.value = session
  sessionBalances.value = []
  sessionBalancesError.value = ''
  sessionBalancesLoading.value = true
  viewBalancesModalOpen.value = true
  try {
    const response = await tillSessionService.listBalances(session.id)
    sessionBalances.value = normalizeBalances(response)
  } catch (error) {
    sessionBalancesError.value = error?.message || 'Unable to load balances for this session.'
  } finally {
    sessionBalancesLoading.value = false
  }
}
function dismissViewBalancesModal() {
  if (sessionBalancesLoading.value) return
  viewBalancesModalOpen.value = false
  viewingBalancesSession.value = null
  sessionBalances.value = []
  sessionBalancesError.value = ''
}
async function openBalanceModal(session) {
  balanceSession.value = session
  balanceCurrencyId.value = ''
  balanceOpening.value = ''
  balanceClosing.value = ''
  errorMessage.value = ''
  currenciesError.value = ''
  referenceCurrencies.value = []
  balanceModalOpen.value = true
  currenciesLoading.value = true
  try {
    const response = await referenceCurrencyService.list({ page: 1, page_size: 100 })
    referenceCurrencies.value = normalize(response)
      .filter(currency => currency.is_active !== false && currency.is_deleted !== true)
  } catch (error) {
    currenciesError.value = error?.message || 'Unable to load reference currencies.'
  } finally {
    currenciesLoading.value = false
  }
}
function dismissBalanceModal() {
  if (loading.value) return
  balanceModalOpen.value = false
  balanceSession.value = null
  balanceCurrencyId.value = ''
  balanceOpening.value = ''
  balanceClosing.value = ''
  currenciesError.value = ''
}
async function submitSessionBalance() {
  if (!balanceSession.value) return
  const currencyId = balanceCurrencyId.value.trim()
  const rawOpening = String(balanceOpening.value).trim()
  const rawClosing = String(balanceClosing.value).trim()
  const opening = Number(rawOpening)
  const closing = Number(rawClosing)
  if (!currencyId) {
    errorMessage.value = 'Select a currency.'
    return
  }
  if (!rawOpening || !Number.isFinite(opening) || opening < 0) {
    errorMessage.value = 'Enter a valid non-negative opening balance.'
    return
  }
  if (rawClosing && (!Number.isFinite(closing) || closing < 0)) {
    errorMessage.value = 'Enter a valid non-negative closing balance, or leave it blank.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const payload = {
      session_id: balanceSession.value.id,
      currency_id: currencyId,
      opening_balance: opening,
    }
    if (rawClosing) payload.closing_balance = closing
    await tillSessionService.createBalance(payload)
    balanceModalOpen.value = false
    balanceSession.value = null
    balanceCurrencyId.value = ''
    balanceOpening.value = ''
    balanceClosing.value = ''
    await load()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to add till session balance.'
  } finally {
    loading.value = false
  }
}
async function reconcileSession(session) {
  if (String(session.status || '').toUpperCase() !== 'CLOSED') return
  if (!window.confirm(`Reconcile till session for ${vaultDisplayName(session)}?`)) return

  loading.value = true
  errorMessage.value = ''
  try {
    await tillSessionService.reconcile(session.id)
    await load()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to reconcile till session.'
  } finally {
    loading.value = false
  }
}
watch([vaultId, status, pageSize], () => {
  page.value = 1
  load()
})
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Till Sessions</h2>
        <p class="module-description">Review till sessions across all cash vaults, or filter by a selected vault.</p>
      </div>
      <BaseButton variant="secondary" @click="router.push('/cash-vaults')">Back to Cash Vaults</BaseButton>
    </div>

    <section class="module-panel">
      <div class="module-panel-header" style="gap:16px;flex-wrap:wrap">
        <div>
          <h3>Session history</h3>
          <p class="module-description" style="margin:4px 0 0">{{ vaultId ? 'Sessions for the selected vault' : 'Sessions across all cash vaults' }}</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:8px">
            <span>Page size</span>
            <select v-model.number="pageSize" class="ui-input" aria-label="Page size" style="width:auto;min-width:84px" :disabled="loading">
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:8px">
            <span>Status</span>
            <select v-model="status" class="ui-input" aria-label="Filter by status" style="width:auto;min-width:140px" :disabled="loading">
              <option v-for="option in statusOptions" :key="option.value || 'all'" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <BaseButton variant="secondary" :disabled="loading" @click="load">Refresh</BaseButton>
        </div>
      </div>

      <p v-if="errorMessage" role="alert" style="padding:0 24px;color:#b43f4a">{{ errorMessage }}</p>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Vault name / code</th>
              <th>Opened by</th>
              <th>Opened at</th>
              <th>Closed at</th>
              <th>Currency balances</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="8" style="text-align:center;padding:28px">Loading till sessions…</td></tr>
            <tr v-else-if="!sessions.length"><td colspan="8" style="text-align:center;padding:28px">No till sessions found for the current filters.</td></tr>
            <tr v-for="session in sessions" v-else :key="session.id">
              <td><span class="session-identity-badge">{{ sessionCodeLabel(session) }}</span></td>
              <td>
                <strong>{{ session.vault?.vault_name || session.vault?.vault_code || '—' }}</strong>
                <div v-if="session.vault?.vault_name && session.vault?.vault_code && session.vault.vault_name !== session.vault.vault_code" class="vault-code-secondary">{{ session.vault.vault_code }}</div>
              </td>
              <td>{{ personName(session.opener || session.user, session.opened_by ?? session.user_id) }}</td>
              <td>{{ formatDate(session.opened_at) }}</td>
              <td>{{ formatDate(session.closed_at) }}</td>
              <td><BaseButton v-if="hasPermission('till-session-balances:read')" size="sm" variant="secondary" :disabled="loading" @click="openViewBalancesModal(session)">Balances</BaseButton></td>
              <td><span class="module-status-chip" :class="String(session.status || '').toUpperCase() === 'OPEN' ? 'active' : 'blocked'">{{ session.status || '—' }}</span></td>
              <td>
                <div class="session-actions-menu">
                  <button
                    type="button"
                    class="session-actions-trigger"
                    :aria-label="`Actions for ${sessionCodeLabel(session)}`"
                    :aria-expanded="openActionsSessionId === session.id"
                    :disabled="loading"
                    @click="toggleSessionActions(session, $event)"
                  >•••</button>

                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span>Showing {{ sessions.length }} sessions · {{ totalCount }} total</span>
        <div style="display:flex;align-items:center;gap:10px">
          <BaseButton size="sm" variant="secondary" :disabled="loading || page <= 1" @click="changePage(page - 1)">Previous</BaseButton>
          <span>Page {{ page }} of {{ totalPages }}</span>
          <BaseButton size="sm" variant="secondary" :disabled="loading || page >= totalPages" @click="changePage(page + 1)">Next</BaseButton>
        </div>
      </div>
    </section>
  </section>
    <div v-if="closeModalOpen" class="session-modal-backdrop" @click.self="dismissCloseModal">
      <section class="session-modal session-balances-modal session-close-modal" role="dialog" aria-modal="true" aria-labelledby="close-session-title">
        <div class="session-modal-heading">
          <div class="session-modal-icon" aria-hidden="true">↘</div>
          <div>
            <h3 id="close-session-title">Close till session</h3>
            <p>Enter the counted closing balance for each currency in this session.</p>
          </div>
          <button type="button" class="session-modal-dismiss" aria-label="Cancel closing session" :disabled="loading || closingBalancesLoading" @click="dismissCloseModal">×</button>
        </div>
        <form class="session-modal-body" @submit.prevent="submitCloseSession">
          <div class="session-modal-summary">
            <span>Vault</span>
            <strong>{{ vaultDisplayName(closingSession) }}</strong>
            <span class="session-identity-badge">{{ sessionCodeLabel(closingSession) }}</span>
          </div>
          <p v-if="closingBalancesLoading" class="session-balances-empty">Loading currency balances…</p>
          <p v-else-if="closingBalancesError" role="alert" class="session-modal-error">{{ closingBalancesError }}</p>
          <div v-else-if="closingBalances.length" class="session-close-balance-list">
            <div class="session-close-balance-list-heading">
              <span>Currency</span>
              <span>Closing balance</span>
            </div>
            <label v-for="(balance, index) in closingBalances" :key="balance.currency_id || index" class="session-close-balance-row" :for="`closing-balance-${index}`">
              <span class="session-close-currency">{{ balance.currency_label }}</span>
              <input :id="`closing-balance-${index}`" v-model="balance.closing_balance" class="ui-input" type="number" min="0" step="0.01" required inputmode="decimal" placeholder="0.00" :disabled="loading" />
            </label>
          </div>
          <p v-else class="session-balances-empty">No currency balances are available for this session yet.</p>
          <p v-if="errorMessage" role="alert" class="session-modal-error">{{ errorMessage }}</p>
          <div class="session-modal-footer session-close-modal-footer">
            <BaseButton type="button" variant="secondary" :disabled="loading || closingBalancesLoading" @click="dismissCloseModal">Cancel</BaseButton>
            <BaseButton v-if="hasPermission('till-sessions:close')" type="submit" variant="danger" :loading="loading" :disabled="closingBalancesLoading || !!closingBalancesError || !closingBalances.length">Confirm close</BaseButton>
          </div>
        </form>
      </section>
    </div>
    <div v-if="balanceModalOpen" class="session-modal-backdrop" @click.self="dismissBalanceModal">
      <section class="session-modal session-balances-modal" role="dialog" aria-modal="true" aria-labelledby="session-balance-title">
        <div class="session-modal-heading">
          <div class="session-modal-icon" aria-hidden="true">＄</div>
          <div>
            <h3 id="session-balance-title">Add till session balance</h3>
            <p>Record opening and closing balances for a currency.</p>
          </div>
          <button type="button" class="session-modal-dismiss" aria-label="Cancel adding balance" :disabled="loading" @click="dismissBalanceModal">×</button>
        </div>
        <form class="session-modal-body" @submit.prevent="submitSessionBalance">
          <div class="session-modal-summary">
            <span>Vault</span>
            <strong>{{ vaultDisplayName(balanceSession) }}</strong>
            <span class="session-identity-badge">{{ sessionCodeLabel(balanceSession) }}</span>
          </div>
          <label class="session-balance-field" for="balance-currency-id">
            <span>Currency *</span>
            <select id="balance-currency-id" v-model="balanceCurrencyId" class="ui-input" required :disabled="loading || currenciesLoading">
              <option value="" disabled>{{ currenciesLoading ? 'Loading currencies…' : 'Select a currency' }}</option>
              <option v-for="currency in referenceCurrencies" :key="currency.id" :value="String(currency.id)">
                {{ [currency.code, currency.name].filter(Boolean).join(' — ') || currency.id }}
              </option>
            </select>
            <small v-if="!currenciesLoading && !currenciesError && !referenceCurrencies.length">No active reference currencies found.</small>
          </label>
          <p v-if="currenciesError" role="alert" class="session-modal-error">{{ currenciesError }}</p>
          <label class="session-balance-field" for="balance-opening">
            <span>Opening balance</span>
            <input id="balance-opening" v-model="balanceOpening" class="ui-input" type="number" min="0" step="0.01" required inputmode="decimal" placeholder="Enter opening balance" :disabled="loading" />
          </label>
          <label class="session-balance-field" for="balance-closing">
            <span>Closing balance (optional)</span>
            <input id="balance-closing" v-model="balanceClosing" class="ui-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Leave blank if not available yet" :disabled="loading" />
            <small>You can record the opening balance now and add the closing balance later.</small>
          </label>
          <p v-if="errorMessage" role="alert" class="session-modal-error">{{ errorMessage }}</p>
          <div class="session-modal-footer" style="padding:16px 0 0">
            <BaseButton variant="secondary" :disabled="loading" @click="dismissBalanceModal">Cancel</BaseButton>
            <BaseButton v-if="hasPermission('till-session-balances:create')" type="submit" :loading="loading">Save balance</BaseButton>
          </div>
        </form>
      </section>
    </div>
    <div v-if="viewBalancesModalOpen" class="session-modal-backdrop" @click.self="dismissViewBalancesModal">
      <section class="session-modal session-balances-modal" role="dialog" aria-modal="true" aria-labelledby="view-session-balances-title">
        <div class="session-modal-heading">
          <div class="session-modal-icon" aria-hidden="true">≋</div>
          <div>
            <h3 id="view-session-balances-title">Till session balances</h3>
            <p>Opening and closing balances are shown separately for each currency.</p>
          </div>
          <button type="button" class="session-modal-dismiss" aria-label="Close session balances" :disabled="sessionBalancesLoading" @click="dismissViewBalancesModal">×</button>
        </div>
        <div class="session-modal-body">
          <div class="session-modal-summary">
            <span>Vault</span>
            <strong>{{ vaultDisplayName(viewingBalancesSession) }}</strong>
            <span class="session-identity-badge">{{ sessionCodeLabel(viewingBalancesSession) }}</span>
          </div>
          <p v-if="sessionBalancesLoading" class="session-balances-empty">Loading session balances…</p>
          <p v-else-if="sessionBalancesError" role="alert" class="session-modal-error">{{ sessionBalancesError }}</p>
          <div v-else-if="sessionBalances.length" class="session-balances-table-wrap">
            <table class="session-balances-table">
              <thead><tr><th>Currency</th><th>Opening balance</th><th>Closing balance</th></tr></thead>
              <tbody>
                <tr v-for="(balance, index) in sessionBalances" :key="balance.id || balance.currency_id || index">
                  <td><strong>{{ currencyLabel(balance) }}</strong></td>
                  <td>{{ formatMoney(balance.opening_balance) }}</td>
                  <td>{{ formatMoney(balance.closing_balance) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="session-balances-empty">No currency balances were found for this session.</p>
        </div>
        <div class="session-modal-footer">
          <BaseButton variant="secondary" :disabled="sessionBalancesLoading" @click="dismissViewBalancesModal">Close</BaseButton>
        </div>
      </section>
    </div>
    <Teleport to="body">
      <div
        v-if="activeActionsSession"
        class="session-actions-dropdown session-actions-dropdown-portal"
        :style="sessionActionsDropdownStyle"
        role="menu"
      >
        <button v-if="String(activeActionsSession.status || '').toUpperCase() === 'OPEN' && hasPermission('till-sessions:close')" type="button" role="menuitem" @click="runSessionAction(closeSession, activeActionsSession)">Close</button>
        <button v-if="hasPermission('till-session-balances:read')" type="button" role="menuitem" @click="runSessionAction(openViewBalancesModal, activeActionsSession)">Balances</button>
        <button v-if="hasPermission('till-session-balances:create')" type="button" role="menuitem" @click="runSessionAction(openBalanceModal, activeActionsSession)">Add balance</button>
        <button v-if="String(activeActionsSession.status || '').toUpperCase() === 'CLOSED' && hasAnyPermission(['till-sessions:reconcile', 'till_sessions.reconcile'])" type="button" role="menuitem" @click="runSessionAction(reconcileSession, activeActionsSession)">Reconcile</button>
      </div>
    </Teleport>

</template>

<style scoped>
.session-identity-badge{display:inline-flex;align-items:center;justify-content:center;padding:5px 9px;border:1px solid #bfdbfe;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:800;letter-spacing:.055em;line-height:1.2;white-space:nowrap}
.session-actions-menu{position:relative;display:flex;justify-content:center}
.session-actions-dropdown-portal{z-index:2147483647!important}
.session-actions-trigger{display:inline-flex;align-items:center;justify-content:center;width:36px;height:32px;border:1px solid var(--border-color,#e2e8f0);border-radius:8px;background:var(--surface,#fff);color:var(--text-primary,#0f172a);font-size:17px;font-weight:800;letter-spacing:2px;line-height:1;cursor:pointer}
.session-actions-trigger:hover,.session-actions-trigger[aria-expanded="true"]{background:var(--surface-muted,#f8fafc)}
.session-actions-trigger:disabled{opacity:.5;cursor:not-allowed}
.session-actions-dropdown{display:grid;min-width:160px;padding:5px;border:1px solid var(--border-color,#e2e8f0);border-radius:10px;background:var(--surface,#fff);box-shadow:0 12px 28px rgba(15,23,42,.16)}
.session-actions-dropdown button{width:100%;padding:9px 11px;border:0;border-radius:6px;background:transparent;color:var(--text-primary,#0f172a);text-align:left;font-size:13px;cursor:pointer}
.session-actions-dropdown button:hover{background:var(--surface-muted,#f1f5f9)}
.vault-code-secondary{margin-top:3px;color:var(--text-muted,#64748b);font-size:12px}
.session-modal-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.56);backdrop-filter:blur(3px)}
.session-close-modal{width:min(100%,620px)}
.session-close-balance-list{display:grid;gap:0;border:1px solid var(--border-color,#e2e8f0);border-radius:10px;overflow:hidden}
.session-close-balance-list-heading,.session-close-balance-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.8fr);align-items:center;gap:16px;padding:12px 14px}
.session-close-balance-list-heading{background:var(--surface-muted,#f8fafc);color:var(--text-muted,#64748b);font-size:12px;font-weight:650}
.session-close-balance-row+.session-close-balance-row{border-top:1px solid var(--border-color,#e2e8f0)}
.session-close-currency{min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:600}
.session-close-balance-row .ui-input{width:100%;min-height:42px}
.session-close-modal-footer{margin:0 -24px -24px;padding:16px 24px 0}
.session-modal{width:min(100%,480px);overflow:hidden;border:1px solid var(--border-color,#e2e8f0);border-radius:16px;background:var(--surface,#fff);color:var(--text-primary,#0f172a);box-shadow:0 24px 70px rgba(15,23,42,.24)}
.session-modal-heading{display:flex;align-items:flex-start;gap:14px;padding:24px 24px 20px;border-bottom:1px solid var(--border-color,#e2e8f0)}
.session-modal-icon{display:grid;flex:0 0 42px;width:42px;height:42px;place-items:center;border-radius:12px;background:#fff1f2;color:#be123c;font-size:23px}
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
.session-balances-modal{width:min(100%,760px)}
.session-balances-table-wrap{width:100%;overflow-x:auto;border:1px solid var(--border-color,#e2e8f0);border-radius:10px}
.session-balances-table{width:100%;border-collapse:collapse;text-align:left}
.session-balances-table th,.session-balances-table td{padding:13px 15px;border-bottom:1px solid var(--border-color,#e2e8f0);font-size:13px;white-space:nowrap}
.session-balances-table th{background:var(--surface-muted,#f8fafc);color:var(--text-muted,#64748b);font-weight:650}
.session-balances-table tbody tr:last-child td{border-bottom:0}
.session-balances-empty{margin:0;color:var(--text-muted,#64748b);font-size:13px}
@media(max-width:520px){.session-modal-backdrop{padding:14px}.session-modal-heading,.session-modal-body{padding:18px}.session-modal-footer{padding:14px 18px 18px}}
</style>

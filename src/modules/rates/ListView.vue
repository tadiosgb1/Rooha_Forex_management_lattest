<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { confirmAction } from '../../composables/confirmAction'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { rateService } from '../../services/rateService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'

const router = useRouter()
const rates = ref([])
const currencies = ref([])
const loading = ref(false)
const actionLoadingId = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const openActionMenuId = ref('')
const actionMenuStyle = ref({})

function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
function currencyId(currency) {
  return currency?.id ?? currency?.currency_id ?? currency?.uuid ?? ''
}
function currencyForRate(row) {
  const id = row?.currency_id ?? row?.currencyId ?? row?.currency?.id ?? row?.currency?.currency_id
  return row?.currency ?? currencies.value.find(currency => String(currencyId(currency)) === String(id)) ?? null
}
function currencyLabelForRate(row) {
  const currency = currencyForRate(row)
  return [currency?.code ?? row?.currency_code ?? row?.currencyCode, currency?.name]
    .filter(Boolean).join(' — ') || '—'
}
function personLabel(person, id) {
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ')
  return name || person?.email || (id != null ? `User ${id}` : '—')
}
function makerLabel(row) {
  return personLabel(row?.maker, row?.maker_id)
}
function checkerLabel(row) {
  return personLabel(row?.checker, row?.checker_id)
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString()
}
function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}
function formatRate(value) {
  if (value == null || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 6 }) : value
}
function rowId(row) {
  return row.id ?? row.exchange_rate_id ?? row.rate_id ?? row.currency_id
}
function isPending(row) {
  return String(row?.status ?? '').toUpperCase() === 'PENDING'
}
function currencyFlagUrl(currency) {
  const path = currency?.flag_url ?? currency?.flagUrl ?? ''
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base = (import.meta.env.VITE_API_BASE_URL || 'https://10.195.49.18:3001').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}
function toggleActionMenu(row, event) {
  const id = String(rowId(row))
  if (openActionMenuId.value === id) {
    openActionMenuId.value = ''
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  const menuWidth = 190
  const top = Math.min(rect.bottom + 5, window.innerHeight - 8)
  actionMenuStyle.value = {
    top: `${top}px`,
    left: `${Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))}px`,
    maxHeight: `${Math.max(100, window.innerHeight - top - 8)}px`,
  }
  openActionMenuId.value = id
}
function closeActionMenu() { openActionMenuId.value = '' }
function viewRate(row) {
  closeActionMenu()
  router.push('/rates/' + encodeURIComponent(rowId(row)))
}
const rows = computed(() => {
  const query = search.value.trim().toLowerCase()
  return rates.value.filter((row) => {
    const currency = currencyForRate(row)
    return !query || [
      currencyLabelForRate(row),
      currency?.symbol,
      row.rate_date,
      row.buy_rate,
      row.sell_rate,
      row.status,
      makerLabel(row),
      checkerLabel(row),
      row.checker_id,
      row.checked_at,
      row.is_active ? 'active' : 'inactive',
    ].some(value => String(value ?? '').toLowerCase().includes(query))
  })
})
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    // Rates are the primary resource; a currency-list permission failure must not
    // prevent users with exchange-rates:read from seeing the rates already returned.
    const rateResponse = await rateService.list()
    rates.value = normalize(rateResponse)
    try {
      const currencyResponse = await referenceCurrencyService.list({ page: 1, page_size: 100 })
      currencies.value = normalize(currencyResponse)
    } catch {
      currencies.value = []
    }
  } catch (error) {
    rates.value = []
    errorMessage.value = error?.message || 'Unable to load exchange rates.'
  } finally {
    loading.value = false
  }
}
function authenticatedCheckerId() {
  const raw = localStorage.getItem('userId') ?? localStorage.getItem('user_id')
  const id = Number(raw)
  return raw && Number.isInteger(id) && id > 0 ? id : null
}
async function reviewRate(row, decision) {
  if (decision === 'approve' && !hasPermission('exchange-rates:approve')) return
  if (decision === 'reject' && !hasPermission('exchange-rates:reject')) return
  const id = rowId(row)
  const checkerId = authenticatedCheckerId()
  if (checkerId == null) {
    errorMessage.value = 'Cannot review this rate: the authenticated user ID was not found in local storage (userId).'
    successMessage.value = ''
    return
  }
  const isApprove = decision === 'approve'
  const confirmed = await confirmAction({
    title: isApprove ? 'Approve exchange rate' : 'Reject exchange rate',
    message: `${isApprove ? 'Approve' : 'Reject'} the rate for ${currencyLabelForRate(row)}?`,
    confirmText: isApprove ? 'Approve' : 'Reject',
    confirmVariant: isApprove ? 'primary' : 'danger',
  })
  if (!confirmed) return
  actionLoadingId.value = String(id)
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const payload = { checker_id: checkerId, checked_at: new Date().toISOString() }
    if (isApprove) await rateService.approve(id, payload)
    else await rateService.reject(id, payload)
    successMessage.value = `Exchange rate ${isApprove ? 'approved' : 'rejected'} successfully.`
    await load()
  } catch (error) {
    errorMessage.value = error?.message || `Unable to ${decision} exchange rate.`
  } finally {
    actionLoadingId.value = ''
  }
}
async function removeRate(row) {
  if (!hasPermission('exchange-rates:delete')) return
  const confirmed = await confirmAction({ title: 'Delete exchange rate', message: 'Delete this exchange rate? This action cannot be undone.' })
  if (!confirmed) return
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await rateService.remove(rowId(row))
    successMessage.value = 'Exchange rate deleted successfully.'
    await load()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to delete exchange rate.'
  }
}
function dismissError() { errorMessage.value = '' }
function dismissSuccess() { successMessage.value = '' }
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Exchange Rates</h2>
        <p class="module-description">Manage and review exchange rates using currencies from the reference-currencies register.</p>
      </div>
      <BaseButton v-if="hasPermission('exchange-rates:create')" @click="router.push('/rates/new')">＋ Add Exchange Rate</BaseButton>
    </div>
    <section class="module-panel">
      <div class="module-panel-header">
        <h3>Exchange rate register</h3>
        <input v-model="search" class="ui-input" placeholder="Search exchange rates…" aria-label="Search exchange rates" style="max-width:280px" />
      </div>
      <div v-if="successMessage" class="module-alert module-alert--success" role="status" aria-live="polite">
        <div class="module-alert__content"><span>{{ successMessage }}</span></div>
        <button type="button" class="module-alert__close" aria-label="Close success alert" @click="dismissSuccess">×</button>
      </div>
      <div v-if="errorMessage" class="module-alert" role="alert" aria-live="assertive">
        <div class="module-alert__content"><strong>Unable to complete action.</strong><span>{{ errorMessage }}</span></div>
        <button type="button" class="module-alert__close" aria-label="Close error alert" @click="dismissError">×</button>
      </div>
      <p v-if="loading" class="module-description" style="padding:20px 24px">Loading exchange rates…</p>
      <div v-else class="module-table-wrap">
        <table class="module-table rates-table">
          <thead>
            <tr><th>Currency</th><th>Rate date</th><th>Buy rate</th><th>Sell rate</th><th>Status</th><th>Active</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="rowId(row)">
              <td>
                <div class="rate-currency-cell">
                  <img v-if="currencyFlagUrl(currencyForRate(row))" :src="currencyFlagUrl(currencyForRate(row))" :alt="`${currencyForRate(row)?.code || 'Currency'} flag`" class="rate-currency-flag" loading="lazy" />
                  <span v-else class="rate-currency-flag-placeholder" aria-hidden="true">{{ (currencyForRate(row)?.code || '?').slice(0, 2) }}</span>
                  <div class="rate-currency-copy"><strong>{{ currencyForRate(row)?.code || row?.currency_code || '—' }}</strong><small>{{ currencyForRate(row)?.name || 'Currency' }}</small></div>
                </div>
              </td>
              <td>{{ formatDate(row.rate_date ?? row.rateDate) }}</td>
              <td>{{ formatRate(row.buy_rate ?? row.buyRate) }}</td>
              <td>{{ formatRate(row.sell_rate ?? row.sellRate) }}</td>
              <td><span class="rate-status-chip" :class="String(row.status || '').toLowerCase()">{{ row.status || '—' }}</span></td>
              <td><span class="rate-active-indicator" :class="row.is_active === true ? 'yes' : row.is_active === false ? 'no' : ''">{{ row.is_active === true ? 'Active' : row.is_active === false ? 'Inactive' : '—' }}</span></td>
              <td>
                <div class="rate-actions">
                  <button type="button" class="rate-more-trigger" :aria-label="`Actions for ${currencyLabelForRate(row)}`" :aria-expanded="openActionMenuId === String(rowId(row))" @click="toggleActionMenu(row, $event)"><span aria-hidden="true">•••</span></button>
                  <div v-if="openActionMenuId === String(rowId(row))" class="rate-action-menu" :style="actionMenuStyle" role="menu">
                    <button type="button" role="menuitem" class="rate-action-item" @click="viewRate(row)">View details</button>
                    <button v-if="hasPermission('exchange-rates:update')" type="button" role="menuitem" class="rate-action-item" @click="closeActionMenu(); router.push('/rates/' + encodeURIComponent(rowId(row)) + '/edit')">Edit rate</button>
                    <button v-if="isPending(row) && hasPermission('exchange-rates:approve')" type="button" role="menuitem" class="rate-action-item" :disabled="actionLoadingId === String(rowId(row))" @click="closeActionMenu(); reviewRate(row, 'approve')">Approve</button>
                    <button v-if="isPending(row) && hasPermission('exchange-rates:reject')" type="button" role="menuitem" class="rate-action-item is-danger" :disabled="actionLoadingId === String(rowId(row))" @click="closeActionMenu(); reviewRate(row, 'reject')">Reject</button>
                    <button v-if="hasPermission('exchange-rates:delete')" type="button" role="menuitem" class="rate-action-item is-danger" @click="closeActionMenu(); removeRate(row)">Delete rate</button>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="!rows.length"><td colspan="7" class="rates-empty-cell">No exchange rates found.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">Showing {{ rows.length }} of {{ rates.length }} exchange rates</div>
    </section>
  </section>
</template>

<style scoped>
.rates-table { min-width: 760px; }
.rate-currency-cell { display:flex;align-items:center;gap:10px;min-width:150px; }
.rate-currency-flag,.rate-currency-flag-placeholder { width:38px;height:27px;flex:0 0 38px;border-radius:5px;object-fit:cover;border:1px solid #e3e8f0;background:#f1f4f8; }
.rate-currency-flag-placeholder { display:flex;align-items:center;justify-content:center;color:#59677c;font-size:.65rem;font-weight:800; }
.rate-currency-copy { display:flex;flex-direction:column;gap:3px;min-width:0; }
.rate-currency-copy strong { color:var(--text-primary,#263449);font-size:.88rem; }
.rate-currency-copy small { color:var(--text-muted,#778196);font-size:.75rem; }
.rate-status-chip { display:inline-flex;padding:5px 9px;border-radius:999px;background:#edf0f5;color:#586579;font-size:.73rem;font-weight:750;white-space:nowrap; }
.rate-status-chip.approved { background:#e6f6ed;color:#23764b; }
.rate-status-chip.pending { background:#fff4dc;color:#8c6217; }
.rate-status-chip.rejected { background:#fff0f0;color:#a63e43; }
.rate-active-indicator { font-size:.82rem;color:#647187;white-space:nowrap; }
.rate-active-indicator.yes { color:#23764b;font-weight:700; }
.rate-active-indicator.no { color:#a63e43;font-weight:700; }
.rate-actions { display:flex;justify-content:center;min-width:44px; }
.rate-more-trigger { display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid #e1e6ef;border-radius:10px;background:#fff;color:#526079;font-size:1rem;letter-spacing:1px;cursor:pointer; }
.rate-more-trigger:hover,.rate-more-trigger[aria-expanded="true"] { background:#f2f5fb;border-color:#cbd5e5;color:#294b8f; }
.rate-action-menu { position:fixed;z-index:10000;min-width:190px;overflow-y:auto;padding:5px;border:1px solid #e3e8f0;border-radius:12px;background:#fff;box-shadow:0 12px 32px rgba(25,39,67,.17); }
.rate-action-item { display:block;width:100%;padding:10px 12px;border:0;border-radius:7px;background:transparent;color:#344054;text-align:left;font:inherit;font-size:.83rem;cursor:pointer;white-space:nowrap; }
.rate-action-item:hover { background:#f3f6fb; }
.rate-action-item:disabled { opacity:.5;cursor:not-allowed; }
.rate-action-item.is-danger { color:#b4232f; }
.rates-empty-cell { text-align:center;padding:28px; }
</style>

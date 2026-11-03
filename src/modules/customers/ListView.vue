<script setup>
import { hasPermission, hasAnyPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { confirmAction } from '../../composables/confirmAction'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { customerProfileService } from '../../services/customerProfileService'

const router = useRouter()
const rows = ref([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const kycFilter = ref('all')
const riskFilter = ref('all')

const normalize = value => String(value ?? '').trim().toLowerCase()
const uniqueValues = key => [...new Set(rows.value.map(row => String(row[key] ?? '').trim()).filter(Boolean))]
const kycOptions = computed(() => uniqueValues('kyc_status'))
const riskOptions = computed(() => uniqueValues('risk_level'))

const visibleRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter(row => {
    const matchesSearch = !q || [
      row.first_name, row.middle_name, row.last_name, row.id_number, row.id_type,
      row.phone, row.email, row.city, row.state_province, row.country, row.kyc_status, row.risk_level,
    ].some(value => String(value ?? '').toLowerCase().includes(q))
    const matchesKyc = kycFilter.value === 'all' || String(row.kyc_status ?? '') === kycFilter.value
    const matchesRisk = riskFilter.value === 'all' || String(row.risk_level ?? '') === riskFilter.value
    return matchesSearch && matchesKyc && matchesRisk
  })
})

const verifiedCount = computed(() => rows.value.filter(row => ['verified', 'approved', 'complete', 'completed'].includes(normalize(row.kyc_status))).length)
const pendingCount = computed(() => rows.value.filter(row => ['pending', 'review', 'in review', 'in-progress', 'in progress'].includes(normalize(row.kyc_status))).length)
const highRiskCount = computed(() => rows.value.filter(row => ['high', 'critical', 'very high'].includes(normalize(row.risk_level))).length)

function recordId(row) { return row.id ?? row.customer_profile_id ?? row.uuid }
function fullName(row) { return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed customer' }
function initials(row) {
  return fullName(row).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'C'
}
function statusClass(value) {
  const status = normalize(value).replace(/\s+/g, '-')
  if (['verified', 'approved', 'complete', 'completed', 'active'].includes(status)) return 'is-positive'
  if (['pending', 'review', 'in-review', 'in-progress', 'submitted'].includes(status)) return 'is-pending'
  if (['rejected', 'blocked', 'failed', 'expired'].includes(status)) return 'is-negative'
  return 'is-neutral'
}
function riskClass(value) {
  const risk = normalize(value)
  if (['low', 'minimal'].includes(risk)) return 'risk-low'
  if (['medium', 'moderate', 'standard'].includes(risk)) return 'risk-medium'
  if (['high', 'critical', 'very high'].includes(risk)) return 'risk-high'
  return 'risk-neutral'
}
function initialsTone(row) {
  const tones = ['tone-teal', 'tone-blue', 'tone-violet', 'tone-amber']
  const seed = fullName(row).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return tones[seed % tones.length]
}
async function loadRows() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await customerProfileService.list()
    const payload = response?.data
    rows.value = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(response) ? response : []
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load customer profiles.'
  } finally { loading.value = false }
}
async function deleteRow(row) {
  const id = recordId(row)
  if (!id) { errorMessage.value = 'This customer profile has no record ID and cannot be deleted.'; return }
  const confirmed = await confirmAction({ title: 'Delete customer profile', message: `Delete customer profile for ${fullName(row)}? This action cannot be undone.` })
  if (!confirmed) return
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await customerProfileService.remove(id)
    successMessage.value = 'Customer profile deleted.'
    await loadRows()
  } catch (error) { errorMessage.value = error?.message || 'Unable to delete customer profile.' }
}
onMounted(loadRows)
</script>

<template>
  <section class="module-page customers-page">
    <div class="customers-heading">
      <div>
        <h2>Customers</h2>
      </div>
      <BaseButton v-if="hasPermission('customer-profiles:create')" class="customers-add-button" @click="router.push('/customers/new')"><span aria-hidden="true">＋</span> Add customer</BaseButton>
    </div>

    <div class="customers-metrics" aria-label="Customer profile summary">
      <article class="customers-metric">
        <span class="metric-icon metric-icon-total" aria-hidden="true">♙</span>
        <div><p>Total customers</p><strong>{{ rows.length }}</strong></div>
      </article>
      <article class="customers-metric">
        <span class="metric-icon metric-icon-verified" aria-hidden="true">✓</span>
        <div><p>KYC verified</p><strong>{{ verifiedCount }}</strong></div>
      </article>
      <article class="customers-metric">
        <span class="metric-icon metric-icon-pending" aria-hidden="true">◷</span>
        <div><p>Pending review</p><strong>{{ pendingCount }}</strong></div>
      </article>
      <article class="customers-metric">
        <span class="metric-icon metric-icon-risk" aria-hidden="true">!</span>
        <div><p>High-risk customers</p><strong>{{ highRiskCount }}</strong></div>
      </article>
    </div>

    <p v-if="errorMessage" class="customers-alert customers-alert-error" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="customers-alert customers-alert-success" role="status">{{ successMessage }}</p>

    <section class="customers-register-card">
      <div class="customers-register-head">
        <div>
          <div class="customers-register-title"><h3>All customers</h3><span class="customers-count">{{ visibleRows.length }}</span></div>
          <p>Search and filter customer records. Select a row action to view or update a profile.</p>
        </div>
        <div class="customers-filters">
          <label class="customers-search"><span aria-hidden="true">⌕</span><BaseInput v-model="search" placeholder="Search name, ID, phone…" aria-label="Search customers" size="sm" /><button v-if="search" type="button" aria-label="Clear search" @click="search = ''">×</button></label>
          <label class="customers-select-wrap"><span class="sr-only">Filter by KYC status</span><select v-model="kycFilter" aria-label="Filter by KYC status"><option value="all">All KYC statuses</option><option v-for="status in kycOptions" :key="status" :value="status">{{ status }}</option></select></label>
          <label class="customers-select-wrap"><span class="sr-only">Filter by risk level</span><select v-model="riskFilter" aria-label="Filter by risk level"><option value="all">All risk levels</option><option v-for="risk in riskOptions" :key="risk" :value="risk">{{ risk }}</option></select></label>
        </div>
      </div>

      <div class="customers-table-wrap">
        <table class="module-table customers-table">
          <thead><tr><th>Customer</th><th>Identity document</th><th>Contact details</th><th>Location</th><th>KYC status</th><th>Risk level</th><th class="customers-actions-heading">Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="module-empty-state"><span class="customers-loading-dot"></span> Loading customers…</td></tr>
            <tr v-else-if="!visibleRows.length"><td colspan="7" class="module-empty-state"><span class="customers-empty-icon">⌕</span><strong>No customers found</strong><span>Try another search or clear the filters.</span><button type="button" class="customers-reset-button" @click="search = ''; kycFilter = 'all'; riskFilter = 'all'">Clear filters</button></td></tr>
            <tr v-for="row in visibleRows" :key="recordId(row) ?? fullName(row)" class="customers-data-row">
              <td class="customers-person-cell">
                <span class="customers-avatar" :class="initialsTone(row)">{{ initials(row) }}</span>
                <span class="customers-person-copy"><strong>{{ fullName(row) }}</strong><small>Customer</small></span>
              </td>
              <td><span class="customers-id-type">{{ row.id_type || 'ID not specified' }}</span><strong class="customers-id-number">{{ row.id_number || '—' }}</strong></td>
              <td class="customers-contact-cell"><strong>{{ row.phone || '—' }}</strong><span>{{ row.email || 'No email provided' }}</span></td>
              <td class="customers-location-cell"><strong>{{ row.city || row.state_province || row.country || '—' }}</strong><span>{{ [row.state_province, row.country].filter(Boolean).join(', ') || 'Location not specified' }}</span></td>
              <td><span class="customers-badge" :class="statusClass(row.kyc_status)"><span class="badge-dot"></span>{{ row.kyc_status || 'Not set' }}</span></td>
              <td><span class="customers-risk-badge" :class="riskClass(row.risk_level)"><span class="risk-marker" aria-hidden="true"></span>{{ row.risk_level || 'Not assessed' }}</span></td>
              <td class="customers-row-actions">
                <button class="customers-view-action" :disabled="!recordId(row)" @click="router.push(`/customers/${encodeURIComponent(recordId(row))}`)">View <span aria-hidden="true">↗</span></button>
                <button v-if="hasPermission('customer-profiles:update')" class="customers-edit-action" :disabled="!recordId(row)" aria-label="Edit customer" title="Edit customer" @click="router.push(`/customers/${encodeURIComponent(recordId(row))}/edit`)">✎</button>
                <button v-if="hasPermission('customer-profiles:delete')" class="customers-delete-action" :disabled="!recordId(row)" aria-label="Delete customer" title="Delete customer" @click="deleteRow(row)">⌫</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="customers-table-footer"><span>Showing <strong>{{ visibleRows.length }}</strong> of <strong>{{ rows.length }}</strong> customers</span><span><span class="customers-footer-dot"></span> Data reflects the latest loaded records</span></footer>
    </section>
  </section>
</template>

<style scoped>
.customers-page { --customer-ink: #172b45; --customer-muted: #687b90; --customer-border: #e4ebf2; color: var(--customer-ink); }
.customers-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin: 2px 0 16px; }
.customers-heading h2 { margin: 0; color: #152a43; font-size: clamp(25px, 2.3vw, 31px); font-weight: 780; letter-spacing: -.045em; line-height: 1.2; }
.customers-add-button { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; border-radius: 9px; box-shadow: 0 5px 14px rgba(13, 137, 121, .16); white-space: nowrap; }
.customers-add-button span { font-size: 18px; line-height: 1; }
.customers-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 17px; }
.customers-metric { display: flex; align-items: center; gap: 11px; min-width: 0; padding: 10px 14px; min-height: 68px; border: 1px solid var(--customer-border); border-radius: 11px; background: #fff; box-shadow: 0 3px 10px rgba(24, 48, 74, .025); }
.metric-icon { display: grid; place-items: center; flex: 0 0 34px; width: 34px; height: 34px; border-radius: 10px; font-size: 17px; font-weight: 800; }
.metric-icon-total { color: #2474bb; background: #eaf4ff; }
.metric-icon-verified { color: #087e69; background: #e4f8f1; }
.metric-icon-pending { color: #a56a0a; background: #fff3d9; }
.metric-icon-risk { color: #c44752; background: #ffebed; }
.customers-metric p { margin: 0; color: #687b90; font-size: 11px; font-weight: 700; }
.customers-metric strong { display: block; margin-top: 3px; color: #172b45; font-size: 22px; font-weight: 780; letter-spacing: -.04em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.customers-alert { margin: 0 0 14px; padding: 11px 14px; border-radius: 9px; font-size: 13px; }
.customers-alert-error { border: 1px solid #f2c6ca; background: #fff0f1; color: #a83240; }
.customers-alert-success { border: 1px solid #b8e6d4; background: #eafaf3; color: #146d4c; }
.customers-register-card { overflow: hidden; border: 1px solid var(--customer-border); border-radius: 14px; background: #fff; box-shadow: 0 6px 22px rgba(24, 48, 74, .04); }
.customers-register-head { display: flex; justify-content: space-between; align-items: center; gap: 22px; padding: 21px 22px; border-bottom: 1px solid #edf1f5; }
.customers-register-title { display: flex; align-items: center; gap: 10px; }
.customers-register-title h3 { margin: 0; color: #1c3048; font-size: 16px; font-weight: 760; letter-spacing: -.02em; }
.customers-count { display: inline-grid; place-items: center; min-width: 27px; height: 24px; padding: 0 7px; border-radius: 7px; background: #eaf7f4; color: #087e70; font-size: 11px; font-weight: 800; }
.customers-register-head > div:first-child > p { margin: 6px 0 0; color: #77879a; font-size: 11px; line-height: 1.5; }
.customers-filters { display: flex; align-items: center; justify-content: flex-end; gap: 9px; min-width: 0; }
.customers-search { display: flex; align-items: center; gap: 8px; width: 245px; min-width: 175px; height: 39px; padding: 0 10px; border: 1px solid #dce5ed; border-radius: 8px; background: #fff; color: #73869a; }
.customers-search > span { font-size: 22px; line-height: 1; }
.customers-search :deep(input) { min-width: 0; width: 100%; height: 35px; padding: 0; border: 0; outline: 0; box-shadow: none; background: transparent; color: #253b53; font-size: 12px; }
.customers-search > button { border: 0; background: transparent; color: #718198; font-size: 18px; }
.customers-select-wrap select { height: 39px; max-width: 150px; padding: 0 28px 0 10px; border: 1px solid #dce5ed; border-radius: 8px; outline: 0; background: #fff; color: #43576d; font-size: 11px; font-weight: 650; }
.customers-select-wrap select:focus, .customers-search:focus-within { border-color: #159889; box-shadow: 0 0 0 3px rgba(21, 152, 137, .1); }
.customers-table-wrap { width: 100%; overflow-x: auto; }
.customers-table { min-width: 1050px; }
.customers-table th { padding: 13px 17px !important; border-bottom: 1px solid #e8eef4; background: #f7f9fc !important; color: #5e7187 !important; font-size: 10px !important; font-weight: 800 !important; letter-spacing: .075em !important; }
.customers-table td { padding: 16px 17px !important; border-top: 1px solid #edf1f5 !important; color: #354b62 !important; font-size: 12px !important; vertical-align: middle; }
.customers-table .customers-data-row { transition: background .16s ease; }
.customers-table .customers-data-row:hover { background: #f3faf9 !important; }
.customers-person-cell { display: flex; align-items: center; gap: 11px; min-width: 195px; }
.customers-avatar { display: grid; place-items: center; flex: 0 0 39px; width: 39px; height: 39px; border-radius: 12px; font-size: 11px; font-weight: 800; letter-spacing: .02em; }
.tone-teal { background: #e1f6f1; color: #087d6d; }
.tone-blue { background: #e7f0ff; color: #285fbb; }
.tone-violet { background: #f0eaff; color: #7652b4; }
.tone-amber { background: #fff1d9; color: #9c650d; }
.customers-person-copy { display: grid; gap: 4px; min-width: 0; }
.customers-person-copy strong { color: #1b3048 !important; font-size: 13px; font-weight: 750; white-space: normal; }
.customers-person-copy small { color: #8997a7 !important; font-size: 10px !important; }
.customers-id-type { display: block; margin-bottom: 4px; color: #7a8a9b; font-size: 10px; font-weight: 650; }
.customers-id-number { display: block; color: #31475e !important; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.customers-contact-cell strong, .customers-location-cell strong { display: block; color: #31475e !important; font-size: 12px; font-weight: 700; }
.customers-contact-cell span, .customers-location-cell span { display: block; margin-top: 5px; max-width: 205px; overflow: hidden; color: #8291a1 !important; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.customers-badge, .customers-risk-badge { display: inline-flex; align-items: center; gap: 7px; max-width: 155px; padding: 6px 9px; border: 1px solid transparent; border-radius: 7px; font-size: 10px; font-weight: 800; line-height: 1.2; text-transform: capitalize; white-space: nowrap; }
.badge-dot { width: 6px; height: 6px; flex: 0 0 6px; border-radius: 50%; background: currentColor; }
.is-positive { border-color: #c4ebdb; background: #e6f8f0; color: #137653; }
.is-pending { border-color: #f5e0a9; background: #fff6df; color: #93630c; }
.is-negative { border-color: #f4cbd0; background: #fff0f1; color: #b23d49; }
.is-neutral { border-color: #dce5ee; background: #f0f4f8; color: #566a80; }
.customers-risk-badge { gap: 6px; }
.risk-marker { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 2px; background: currentColor; transform: rotate(45deg); }
.risk-low { border-color: #c7eadb; background: #e7f8ef; color: #18734f; }
.risk-medium { border-color: #f2dfb2; background: #fff5df; color: #96620c; }
.risk-high { border-color: #f2c8cd; background: #ffedef; color: #b13745; }
.risk-neutral { border-color: #dce5ee; background: #f0f4f8; color: #5d7186; }
.customers-actions-heading { text-align: right; }
.customers-row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 5px; }
.customers-row-actions button { display: inline-flex; align-items: center; justify-content: center; min-width: 31px; height: 31px; padding: 0 8px; border: 1px solid #e0e8ef; border-radius: 7px; background: #fff; color: #587087; font-size: 12px; font-weight: 700; transition: background .15s, border-color .15s, color .15s; }
.customers-row-actions .customers-view-action { gap: 5px; border-color: #cde9e3; background: #effaf7; color: #087e70; font-size: 11px; }
.customers-row-actions .customers-edit-action:hover { border-color: #b9d8f8; background: #eff6ff; color: #2464ae; }
.customers-row-actions .customers-delete-action:hover { border-color: #f2c8cd; background: #fff0f1; color: #b13745; }
.customers-row-actions button:disabled { cursor: not-allowed; opacity: .45; }
.customers-table .module-empty-state { padding: 48px 18px !important; color: #7b8c9e !important; }
.customers-empty-icon { display: block; margin-bottom: 8px; font-size: 27px; }
.customers-table .module-empty-state strong, .customers-table .module-empty-state > span:not(.customers-empty-icon) { display: block; }
.customers-table .module-empty-state strong { color: #2d4359; font-size: 13px; }
.customers-table .module-empty-state > span:not(.customers-empty-icon) { margin-top: 5px; font-size: 11px; }
.customers-reset-button { margin-top: 12px; border: 1px solid #cde9e3; border-radius: 7px; padding: 7px 10px; background: #effaf7; color: #087e70; font-size: 11px; font-weight: 750; }
.customers-loading-dot { display: inline-block; width: 7px; height: 7px; margin-right: 9px; border-radius: 50%; background: #159889; box-shadow: 0 0 0 4px #e1f6f1; }
.customers-table-footer { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 13px 20px; border-top: 1px solid #edf1f5; background: #fbfcfe; color: #718198; font-size: 11px; }
.customers-table-footer strong { color: #334b62; font-weight: 800; }
.customers-footer-dot { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: #18a779; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
:global(.theme-dark) .customers-page { --customer-ink: #e7eef7; --customer-muted: #b5c3d2; --customer-border: #30445a; }
:global(.theme-dark) .customers-heading h2, :global(.theme-dark) .customers-metric strong, :global(.theme-dark) .customers-register-title h3 { color: #eef4fb; }
:global(.theme-dark) .customers-subtitle, :global(.theme-dark) .customers-register-head > div:first-child > p, :global(.theme-dark) .customers-metric p { color: #b5c3d2; }
:global(.theme-dark) .customers-metric, :global(.theme-dark) .customers-register-card { border-color: #30445a; background: #172a3d; box-shadow: none; }
:global(.theme-dark) .customers-register-head, :global(.theme-dark) .customers-table td { border-color: #2b4055 !important; }
:global(.theme-dark) .customers-table th { border-color: #30445a; background: #20364b !important; color: #d4e0ed !important; }
:global(.theme-dark) .customers-table td { color: #dce6f1 !important; }
:global(.theme-dark) .customers-person-copy strong, :global(.theme-dark) .customers-id-number, :global(.theme-dark) .customers-contact-cell strong, :global(.theme-dark) .customers-location-cell strong { color: #e8f0f8 !important; }
:global(.theme-dark) .customers-person-copy small, :global(.theme-dark) .customers-contact-cell span, :global(.theme-dark) .customers-location-cell span { color: #aab9c9 !important; }
:global(.theme-dark) .customers-search, :global(.theme-dark) .customers-search :deep(input), :global(.theme-dark) .customers-select-wrap select { border-color: #3b5065; background: #13263a; color: #e1eaf4; }
:global(.theme-dark) .customers-search :deep(input) { border: 0; }
:global(.theme-dark) .customers-table .customers-data-row:hover { background: #203a4e !important; }
:global(.theme-dark) .customers-table-footer { border-color: #2b4055; background: #13263a; color: #b5c3d2; }
:global(.theme-dark) .customers-table-footer strong { color: #edf4fb; }
:global(.theme-dark) .customers-row-actions button { border-color: #3b5065; background: #172a3d; color: #c4d2e1; }
:global(.theme-dark) .customers-row-actions .customers-view-action { border-color: #2a655d; background: #193e3a; color: #75d6c2; }
:global(.theme-dark) .customers-table .module-empty-state strong { color: #e8f0f8; }
@media (max-width: 1250px) {
  .customers-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .customers-register-head { align-items: flex-start; flex-direction: column; }
  .customers-filters { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
  .customers-search { flex: 1 1 240px; }
}
@media (max-width: 700px) {
  .customers-heading { align-items: flex-start; flex-direction: column; }
  .customers-metrics { gap: 9px; }
  .customers-metric { padding: 13px 12px; gap: 10px; }
  .metric-icon { flex-basis: 36px; width: 36px; height: 36px; border-radius: 10px; }
  .customers-metric strong { font-size: 22px; }
  .customers-register-head { padding: 17px 15px; }
  .customers-filters { align-items: stretch; }
  .customers-search { flex-basis: 100%; width: 100%; }
  .customers-select-wrap { flex: 1 1 135px; }
  .customers-select-wrap select { width: 100%; max-width: none; }
  .customers-table-footer { align-items: flex-start; flex-direction: column; padding: 12px 15px; }
}
</style>

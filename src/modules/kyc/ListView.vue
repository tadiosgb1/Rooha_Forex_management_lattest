<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref, watch } from 'vue'
import { confirmAction } from '../../composables/confirmAction'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { kycService } from '../../services/kycService'

const route = useRoute()
const router = useRouter()
const rows = ref([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const status = ref('')
const sortBy = ref('created_at')
const order = ref('DESC')
const currentPage = ref(1)
const pageSize = ref(10)
const totalPages = ref(1)
const totalCount = ref(0)
const selectedDocument = ref(null)
const openActionMenu = ref('')
let searchTimer

function unwrap(response) {
  // apiRequest returns parsed JSON directly; preserve list envelopes so count and pagination metadata survive.
  if (response && Array.isArray(response.data)) return response
  let body = response?.data ?? response
  if (body?.data && !Array.isArray(body.data) && typeof body.data === 'object' && (body.data.data || body.data.items || body.data.results)) body = body.data
  return body
}
function customer(row) { return row?.customerProfile || row?.customer_profile || row?.customer || null }
function customerProfileId(row) { return row?.customer_profile_id || row?.customerProfileId || customer(row)?.id || customer(row)?.customer_profile_id || '' }
function customerName(row) {
  const c = customer(row) || {}
  return c.full_name || c.customer_name || c.name || [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ') || 'Customer name unavailable'
}
function customerPhone(row) { const c = customer(row) || {}; return c.phone || c.phone_number || '—' }
function customerEmail(row) { return customer(row)?.email || '—' }
function initials(row) { return customerName(row).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'CU' }
function initialsTone(row) { return ['tone-teal', 'tone-blue', 'tone-violet', 'tone-amber'][Array.from(customerName(row)).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4] }
function menuStyle(row) {
  const key = String(row?.id ?? customerProfileId(row)).replace(/[^a-zA-Z0-9_-]/g, '')
  const trigger = document.querySelector(`[data-row-action-key="${key}"]`)
  if (!trigger) return { position: 'fixed', top: '12px', right: '12px', zIndex: 99999 }
  const rect = trigger.getBoundingClientRect()
  return { position: 'fixed', top: `${Math.min(rect.bottom + 6, window.innerHeight - 150)}px`, left: `${Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168))}px`, zIndex: 99999 }
}
function documentUrl(row) { return row?.file_path || row?.id_photo_path || row?.id_photo_url || row?.id_photo || '' }
function documentIsPdf(row) { return /\.pdf(?:$|[?#])/i.test(String(documentUrl(row) || '')) || /pdf/i.test(String(row?.file_mime_type || row?.mime_type || row?.document_mime_type || '')) }
function documentLabel(row) { return row?.documentTypeRef?.display_label || row?.documentTypeRef?.code || customer(row)?.idTypeRef?.display_label || customer(row)?.id_type || row?.id_type || row?.document_type || 'Identity document' }
function openDocument(row) { selectedDocument.value = row; openActionMenu.value = '' }
function closeDocument() { selectedDocument.value = null }
function toggleActionMenu(row) { const key = String(row?.id ?? customerProfileId(row)); openActionMenu.value = openActionMenu.value === key ? '' : key }
function runRowAction(action, row) {
  openActionMenu.value = ''
  if (action === 'view') router.push(`/kyc/${encodeURIComponent(customerProfileId(row) || row.id)}`)
  if (action === 'edit') router.push(`/kyc/${encodeURIComponent(customerProfileId(row) || row.id)}/edit`)
  if (action === 'delete') removeRow(row)
}
function rowStatus(row) {
  const value = String(row?.status || row?.verification_status || row?.kyc_status || '').toUpperCase()
  if (row?.verified === true || row?.is_verified === true || row?.verified_at != null || ['VERIFIED', 'APPROVED'].includes(value)) return 'APPROVED'
  if (['REJECTED', 'DECLINED'].includes(value)) return 'REJECTED'
  if (['PENDING', 'PENDING_REVIEW', 'IN_REVIEW', 'UNDER_REVIEW'].includes(value)) return 'PENDING_REVIEW'
  return value || 'UNKNOWN'
}
function date(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
const visibleRows = computed(() => rows.value)
const summary = computed(() => ({
  total: totalCount.value || rows.value.length,
  pending: rows.value.filter(r => rowStatus(r) === 'PENDING_REVIEW').length,
  verified: rows.value.filter(r => ['APPROVED', 'VERIFIED'].includes(rowStatus(r))).length,
  rejected: rows.value.filter(r => rowStatus(r) === 'REJECTED').length
}))
async function loadRows() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = { order: order.value, sort_by: sortBy.value, page: currentPage.value, page_size: pageSize.value }
    if (search.value.trim()) params.search = search.value.trim()
    const selectedStatus = status.value || (route.query.status === 'pending' ? 'PENDING_REVIEW' : route.query.status === 'active' ? 'APPROVED' : '')
    if (selectedStatus) params.status = selectedStatus
    const response = await kycService.list(params)
    const body = unwrap(response)
    const payload = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : Array.isArray(body?.items) ? body.items : Array.isArray(body?.results) ? body.results : [])
    rows.value = payload
    totalPages.value = Math.max(1, Number(body?.total_pages || 1))
    totalCount.value = Number(body?.count ?? body?.total ?? payload.length)
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load KYC records.'
  } finally {
    loading.value = false
  }
}
function changePage(page) { currentPage.value = page; loadRows() }
async function toggleVerification(row) {
  const wasVerified = ['APPROVED', 'VERIFIED'].includes(rowStatus(row))
  const confirmed = await confirmAction({
    title: wasVerified ? 'Confirm KYC unverification' : 'Confirm KYC verification',
    message: wasVerified
      ? `Do you want to confirm removing verification from KYC record #${row.id} for ${customerName(row)}?`
      : `Do you want to confirm verification of KYC record #${row.id} for ${customerName(row)}?`,
    confirmText: wasVerified ? 'Unverify' : 'Verify',
    confirmVariant: wasVerified ? 'danger' : 'primary',
  })
  if (!confirmed) return
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const profileId = customerProfileId(row)
    if (!profileId) throw new Error('Customer profile ID is missing for this KYC record.')
    if (wasVerified) await kycService.unverify(profileId)
    else await kycService.verify(profileId)
    successMessage.value = wasVerified ? 'KYC verification removed.' : 'KYC verification updated.'
    const selectedId = selectedDocument.value?.id
    await loadRows()
    if (selectedId != null) selectedDocument.value = rows.value.find(item => String(item.id) === String(selectedId)) || selectedDocument.value
  } catch (error) { errorMessage.value = error?.message || 'Unable to update verification status.' }
}
async function removeRow(row) {
  const profileId = customerProfileId(row)
  if (!profileId) { errorMessage.value = 'Customer profile ID is missing for this KYC record.'; return }
  const confirmed = await confirmAction({ title: 'Delete KYC record', message: `Delete the KYC record for ${customerName(row)} (customer profile ${profileId})? This action cannot be undone.` })
  if (!confirmed) return
  try { await kycService.remove(profileId); successMessage.value = 'KYC record deleted.'; await loadRows() }
  catch (error) { errorMessage.value = error?.message || 'Unable to delete KYC record.' }
}
watch([status, sortBy, order], () => { currentPage.value = 1; loadRows() })
watch(search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { currentPage.value = 1; loadRows() }, 350) })
watch(pageSize, () => { currentPage.value = 1; loadRows() })
onMounted(loadRows)
</script>

<template>
  <section class="module-page kyc-page">
    <header class="kyc-hero">
      <h2>KYC Management</h2>
      <BaseButton v-if="hasPermission('kyc:create')" @click="router.push('/kyc/new')">＋ New KYC record</BaseButton>
    </header>

    <p v-if="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="notice success" role="status">{{ successMessage }}</p>

    <section class="summary-grid" aria-label="KYC summary">
      <article class="summary-card"><span class="metric-icon metric-icon-total" aria-hidden="true">▤</span><div class="summary-copy"><span>Total records</span><strong>{{ summary.total }}</strong></div></article>
      <article class="summary-card"><span class="metric-icon metric-icon-pending" aria-hidden="true">◷</span><div class="summary-copy"><span>Pending review</span><strong>{{ summary.pending }}</strong></div></article>
      <article class="summary-card"><span class="metric-icon metric-icon-verified" aria-hidden="true">✓</span><div class="summary-copy"><span>Approved</span><strong>{{ summary.verified }}</strong></div></article>
      <article class="summary-card"><span class="metric-icon metric-icon-rejected" aria-hidden="true">!</span><div class="summary-copy"><span>Rejected</span><strong>{{ summary.rejected }}</strong></div></article>
    </section>

    <section class="module-panel register-panel">
      <div class="panel-heading"><h3>Records</h3><span class="result-count">{{ totalCount }} result{{ totalCount === 1 ? '' : 's' }}</span></div>
      <div class="filter-grid">
        <label class="search-field"><span>Search customer</span><BaseInput v-model="search" placeholder="Name, email, or phone…" aria-label="Search by customer name, email or phone" size="sm" /></label>
        <label><span>Verification status</span><select v-model="status"><option value="">All statuses</option><option value="PENDING_REVIEW">Pending review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label>
        <label><span>Sort by</span><select v-model="sortBy"><option value="created_at">Submitted date</option><option value="dob">Date of birth</option><option value="id_type">Identity type</option><option value="id">Record number</option></select></label>
        <label><span>Sort order</span><select v-model="order"><option value="DESC">Descending</option><option value="ASC">Ascending</option></select></label>
        <label><span>Rows per page</span><select v-model.number="pageSize"><option :value="10">10</option><option :value="25">25</option><option :value="50">50</option></select></label>
      </div>
      <div class="module-table-wrap"><table class="module-table kyc-table">
        <thead><tr><th>Customer</th><th>Identity document</th><th>Date of birth</th><th>Location</th><th>Record</th><th>Verification status</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="module-empty-state">Loading KYC records…</td></tr>
          <tr v-else-if="!visibleRows.length"><td colspan="7" class="module-empty-state">No KYC records match these filters.</td></tr>
          <tr v-for="row in visibleRows" :key="row.id">
            <td class="kyc-customer-cell"><span class="kyc-customer-avatar" :class="initialsTone(row)">{{ initials(row) }}</span><span class="kyc-customer-copy"><strong>{{ customerName(row) }}</strong><small>{{ customerPhone(row) }}</small><small>{{ customerEmail(row) }}</small></span></td>
            <td><span class="type-pill">{{ documentLabel(row) }}</span><small v-if="row.id_number">Document no. {{ row.id_number }}</small><button v-if="documentUrl(row)" type="button" class="document-link" @click="openDocument(row)">Open document <span aria-hidden="true">↗</span></button><span v-else class="document-unavailable">No document uploaded</span></td>
            <td>{{ date(row.dob || row.expiry_date) }}</td><td>{{ [customer(row)?.city, customer(row)?.country].filter(Boolean).join(', ') || [row.city, row.country].filter(Boolean).join(', ') || '—' }}</td>
            <td class="kyc-record-cell"><strong>Record submitted</strong><small>{{ date(row.created_at) }}</small></td>
            <td><span class="status-pill" :class="rowStatus(row).toLowerCase()"><i></i>{{ rowStatus(row).replaceAll('_', ' ') }}</span></td>
            <td class="module-row-actions action-cell"><div class="row-menu-wrap"><button :data-row-action-key="String(row.id ?? customerProfileId(row)).replace(/[^a-zA-Z0-9_-]/g, '')" type="button" class="row-menu-trigger" :aria-label="`Actions for ${customerName(row)}`" :aria-expanded="openActionMenu === String(row.id ?? customerProfileId(row))" @click="toggleActionMenu(row)"><span></span><span></span><span></span></button><Teleport to="body"><div v-if="openActionMenu === String(row.id ?? customerProfileId(row))" class="row-action-menu" role="menu" :style="menuStyle(row)"><button type="button" role="menuitem" @click="runRowAction('view', row)">View details</button><button v-if="hasPermission('kyc:update')" type="button" role="menuitem" @click="runRowAction('edit', row)">Edit record</button><button v-if="hasPermission('kyc:delete')" type="button" role="menuitem" class="menu-delete-action" @click="runRowAction('delete', row)">Delete record</button></div></Teleport></div></td>
          </tr>
        </tbody>
      </table></div>
      <footer class="pagination"><span>Page {{ currentPage }} of {{ totalPages }} · {{ rows.length }} record{{ rows.length === 1 ? '' : 's' }} on this page</span><div><BaseButton size="sm" variant="secondary" :disabled="currentPage <= 1 || loading" @click="changePage(currentPage - 1)">← Previous</BaseButton><BaseButton size="sm" variant="secondary" :disabled="currentPage >= totalPages || loading" @click="changePage(currentPage + 1)">Next →</BaseButton></div></footer>
    </section>

    <div v-if="selectedDocument" class="document-modal-backdrop" role="presentation" @click.self="closeDocument">
      <section class="document-modal" role="dialog" aria-modal="true" :aria-label="`${documentLabel(selectedDocument)} preview`">
        <header class="document-modal-header"><div><span class="document-modal-kicker">KYC DOCUMENT</span><h3>{{ documentLabel(selectedDocument) }}</h3><p>{{ customerName(selectedDocument) }}<span v-if="selectedDocument.id_number"> · {{ selectedDocument.id_number }}</span></p></div><button type="button" class="document-modal-close" aria-label="Close document preview" @click="closeDocument">×</button></header>
        <div class="document-modal-content"><iframe v-if="documentIsPdf(selectedDocument)" :src="documentUrl(selectedDocument)" title="KYC PDF document preview" class="document-pdf-preview"></iframe><img v-else :src="documentUrl(selectedDocument)" :alt="`${customerName(selectedDocument)} identity document`" class="document-image-preview" /><p v-if="errorMessage" class="document-modal-error" role="alert">{{ errorMessage }}</p></div>
        <footer class="document-modal-footer"><a class="document-open-original" :href="documentUrl(selectedDocument)" target="_blank" rel="noopener noreferrer">Open original in new tab ↗</a><span class="document-modal-status" :class="rowStatus(selectedDocument).toLowerCase()">{{ rowStatus(selectedDocument).replaceAll('_', ' ') }}</span><button v-if="(['APPROVED', 'VERIFIED'].includes(rowStatus(selectedDocument)) && hasPermission('kyc:unverify')) || (!(['APPROVED', 'VERIFIED'].includes(rowStatus(selectedDocument))) && hasPermission('kyc:verify'))" type="button" class="document-verify-button" :class="['APPROVED', 'VERIFIED'].includes(rowStatus(selectedDocument)) ? 'unverify' : 'verify'" :disabled="loading" @click="toggleVerification(selectedDocument)">{{ loading ? 'Updating…' : ['APPROVED', 'VERIFIED'].includes(rowStatus(selectedDocument)) ? 'Unverify customer' : 'Verify customer' }}</button><button type="button" class="document-modal-done" @click="closeDocument">Done</button></footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.kyc-page{display:grid;gap:12px}.kyc-hero{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 0 8px;border-bottom:1px solid var(--border-color,#d9dde5);background:transparent}.kyc-hero h2{margin:0;font-size:23px;font-weight:700;letter-spacing:-.02em}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.summary-card{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:0;padding:8px 11px;border:1px solid var(--border-color,#e0e3e8);border-radius:2px;background:var(--surface-color,#fff);box-shadow:none}.summary-card span{font-size:11px;color:var(--text-muted-color,#667085)}.summary-card strong{font-size:18px;line-height:1;font-weight:700}.notice{margin:0;padding:8px 10px;border-radius:2px}.error{color:#a62d39;background:#fff0f1}.success{color:#167349;background:#eaf8f0}.register-panel{overflow:hidden;border-radius:2px}.panel-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border-color,#e5e7eb)}.panel-heading h3{margin:0;font-size:15px}.result-count{font-size:11px;font-weight:600;color:var(--text-muted-color,#667085);white-space:nowrap}.filter-grid{display:grid;grid-template-columns:minmax(180px,1.6fr) repeat(4,minmax(110px,1fr));gap:8px;padding:10px 14px;border-bottom:1px solid var(--border-color,#e5e7eb)}.filter-grid label{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:11px;color:var(--text-muted-color,#667085)}.filter-grid select{width:100%;min-width:0;padding:7px 8px;border:1px solid var(--border-color,#d1d5db);border-radius:2px;background:var(--surface-color,#fff);color:inherit;font:inherit}.type-pill{display:inline-block;padding:3px 5px;border-radius:2px;background:var(--surface-muted-color,#f2f4f7);font-size:10px;font-weight:700;white-space:nowrap}.document-link{display:inline-block;margin-top:5px;font-size:10px;font-weight:700;color:var(--brand-base-color,#435fb0);text-decoration:none}.status-pill.approved,.status-pill.verified{color:#167349;background:#e7f7ef}.status-pill.unknown{color:#667085;background:#f2f4f7}.status-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 6px;border-radius:2px;font-size:10px;font-weight:700;white-space:nowrap}.status-pill i{width:5px;height:5px;border-radius:50%;background:currentColor}.status-pill.pending_review{color:#99630b;background:#fff4d8}.status-pill.verified,.status-pill.approved{color:#167349;background:#e7f7ef}.status-pill.rejected{color:#b42332;background:#fff0f1}.kyc-table td small{display:block;margin-top:2px;font-size:10px;color:var(--text-muted-color,#667085);max-width:210px;overflow-wrap:anywhere}.action-cell{min-width:190px}.pagination{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;color:var(--text-muted-color,#667085);font-size:11px}.pagination>div{display:flex;gap:6px}.module-row-actions button{white-space:nowrap}.module-table th,.module-table td{padding:9px 10px}.module-table td{font-size:12px}@media(max-width:1050px){.filter-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){.kyc-hero{align-items:center}.kyc-hero h2{font-size:20px}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.filter-grid{grid-template-columns:1fr 1fr;padding:10px}.pagination{align-items:flex-start;flex-direction:column}}@media(max-width:420px){.summary-grid,.filter-grid{grid-template-columns:1fr}}

/* Align the KYC workspace with the Customers register visual language. */
.kyc-page { gap: 16px; color: var(--text-color, #172b45); }
.kyc-hero { padding: 2px 0 14px; border-bottom: 1px solid var(--border-color, #e4ebf2); }
.kyc-hero h2 { color: var(--text-color, #172b45); font-size: clamp(25px, 2.3vw, 31px); font-weight: 780; letter-spacing: -.045em; }
.kyc-hero :deep(button) { min-height: 40px; border-radius: 9px; }
.summary-grid { gap: 12px; }
.summary-card { justify-content: flex-start; gap: 12px; min-height: 66px; padding: 10px 14px; border: 1px solid var(--border-color, #e4ebf2); border-radius: 11px; background: var(--surface-color, #fff); box-shadow: 0 3px 10px rgba(24, 48, 74, .025); }
.summary-card span { color: var(--text-muted-color, #687b90); font-size: 11px; font-weight: 700; }
.summary-card strong { color: var(--text-color, #172b45); font-size: 22px; font-weight: 780; font-variant-numeric: tabular-nums; }
.register-panel { border: 1px solid var(--border-color, #e4ebf2); border-radius: 13px; box-shadow: 0 5px 20px rgba(24, 48, 74, .035); }
.panel-heading { padding: 16px 20px; }
.panel-heading h3 { color: var(--text-color, #1c3048); font-size: 15px; font-weight: 760; }
.filter-grid { gap: 10px; padding: 14px 18px; }
.filter-grid label { gap: 6px; font-size: 11px; font-weight: 650; }
.filter-grid select { min-height: 37px; border-radius: 8px; }
.type-pill { padding: 5px 8px; border-radius: 6px; background: var(--surface-muted-color, #eef3f8); }
.status-pill { gap: 7px; padding: 6px 9px; border: 1px solid transparent; border-radius: 7px; font-size: 10px; font-weight: 800; text-transform: capitalize; }
.status-pill.pending_review { border-color: #f5e0a9; color: #93630c; background: #fff6df; }
.status-pill.verified, .status-pill.approved { border-color: #c4ebdb; color: #137653; background: #e6f8f0; }
.status-pill.rejected { border-color: #f4cbd0; color: #b23d49; background: #fff0f1; }
.status-pill.unknown { border-color: #dce5ee; color: #566a80; background: #f0f4f8; }
.module-table th { padding: 13px 14px; background: var(--surface-muted-color, #f7f9fc); color: var(--text-muted-color, #5e7187); font-size: 10px; font-weight: 800; letter-spacing: .045em; }
.module-table td { padding: 13px 14px; font-size: 12px; }
.module-table tbody tr { transition: background .15s ease; }
.module-table tbody tr:hover { background: rgba(18, 145, 128, .045); }
.module-table td strong { font-weight: 750; }
.module-table td small { margin-top: 4px; line-height: 1.45; }
.action-cell { min-width: 205px; }
.module-row-actions { display: flex; flex-wrap: wrap; gap: 5px; }
.module-row-actions button { min-height: 29px; padding: 5px 8px; border: 1px solid var(--border-color, #dce5ed); border-radius: 7px; background: var(--surface-color, #fff); color: var(--text-color, #43576d); font-size: 10px; font-weight: 700; }
.module-row-actions button:hover { border-color: #b9ddd6; background: #effaf7; color: #087e70; }
.pagination { padding: 13px 18px; border-top: 1px solid var(--border-color, #e8eef4); }
@media (max-width: 1050px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 650px) { .kyc-hero h2 { font-size: 23px; } .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .summary-card { padding: 9px 10px; } .summary-card strong { font-size: 20px; } }


/* Customer-register parity, compact overflow actions, and in-page document review. */
.kyc-page { --kyc-ink:#172b45; --kyc-muted:#687b90; --kyc-border:#e4ebf2; color:var(--kyc-ink); gap:16px; }
.kyc-hero { padding:2px 0 14px; border-bottom:1px solid var(--kyc-border); }
.kyc-hero h2 { color:#152a43; font-size:clamp(25px,2.3vw,31px); font-weight:780; letter-spacing:-.045em; }
.kyc-hero :deep(button) { min-height:42px; border-radius:9px; }
.summary-grid { gap:12px; margin-bottom:1px; }
.summary-card { justify-content:flex-start; gap:12px; min-height:68px; padding:10px 14px; border:1px solid var(--kyc-border); border-radius:11px; box-shadow:0 3px 10px rgba(24,48,74,.025); }
.summary-card span { font-size:11px; font-weight:700; }
.summary-card strong { font-size:22px; letter-spacing:-.04em; }
.register-panel { border:1px solid var(--kyc-border); border-radius:14px; box-shadow:0 6px 22px rgba(24,48,74,.04); }
.panel-heading { padding:18px 22px; border-color:#edf1f5; }
.panel-heading h3 { font-size:16px; font-weight:760; letter-spacing:-.02em; }
.result-count { display:inline-grid; place-items:center; min-width:27px; height:24px; padding:0 7px; border-radius:7px; background:#eaf7f4; color:#087e70; font-size:11px; }
.filter-grid { gap:9px; padding:14px 18px; }
.filter-grid label { font-size:11px; font-weight:650; }
.filter-grid select { min-height:39px; border-radius:8px; }
.module-table { min-width:1000px; }
.module-table th { padding:13px 15px !important; border-bottom:1px solid #e8eef4; background:#f7f9fc !important; color:#5e7187 !important; font-size:10px !important; font-weight:800 !important; letter-spacing:.075em !important; }
.module-table td { padding:14px 15px !important; border-top:1px solid #edf1f5 !important; color:#354b62 !important; font-size:12px !important; vertical-align:middle; }
.module-table tbody tr:hover { background:#f3faf9 !important; }
.kyc-table td strong { color:#1b3048; font-weight:750; }
.kyc-table td small { margin-top:4px; color:#8291a1; font-size:10px; line-height:1.45; }
.type-pill { padding:5px 8px; border-radius:6px; background:#eef3f8; font-size:10px; }
.document-link { display:inline-flex; align-items:center; gap:5px; margin-top:7px; padding:0; border:0; background:transparent; color:#087e70; font-size:11px; font-weight:750; cursor:pointer; }
.document-link:hover { text-decoration:underline; }
.document-unavailable { display:block; margin-top:7px; color:#8291a1; font-size:10px; }
.status-pill { gap:7px; padding:6px 9px; border:1px solid transparent; border-radius:7px; font-size:10px; font-weight:800; text-transform:capitalize; }
.status-pill.pending_review { border-color:#f5e0a9; color:#93630c; background:#fff6df; }
.status-pill.approved,.status-pill.verified { border-color:#c4ebdb; color:#137653; background:#e6f8f0; }
.status-pill.rejected { border-color:#f4cbd0; color:#b23d49; background:#fff0f1; }
.action-cell { min-width:70px; }
.module-row-actions { display:flex; justify-content:center; align-items:center; }
.row-menu-wrap { position:relative; display:inline-flex; }
.row-menu-trigger { display:flex; align-items:center; justify-content:center; gap:3px; width:34px; height:34px; padding:0; border:1px solid #e0e8ef; border-radius:8px; background:#fff; cursor:pointer; }
.row-menu-trigger span { width:3px; height:3px; border-radius:50%; background:#5e7187; }
.row-menu-trigger:hover,.row-menu-trigger[aria-expanded="true"] { border-color:#b9ddd6; background:#effaf7; }
.row-action-menu { position:absolute; z-index:5; top:calc(100% + 6px); right:0; display:grid; min-width:150px; padding:5px; border:1px solid #e0e8ef; border-radius:9px; background:#fff; box-shadow:0 12px 28px rgba(24,48,74,.14); }
.row-action-menu button { padding:9px 10px; border:0; border-radius:6px; background:transparent; color:#354b62; text-align:left; font-size:11px; font-weight:650; cursor:pointer; }
.row-action-menu button:hover { background:#f3faf9; color:#087e70; }
.row-action-menu .menu-delete-action { color:#b23d49; }
.pagination { padding:13px 18px; border-top:1px solid #edf1f5; }
.document-modal-backdrop { position:fixed; z-index:1000; inset:0; display:grid; place-items:center; padding:24px; background:rgba(14,28,45,.58); backdrop-filter:blur(3px); }
.document-modal { display:flex; flex-direction:column; width:min(100%,980px); max-height:calc(100vh - 48px); overflow:hidden; border:1px solid #e4ebf2; border-radius:15px; background:#fff; box-shadow:0 24px 80px rgba(8,24,42,.28); }
.document-modal-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:18px 22px; border-bottom:1px solid #edf1f5; }
.document-modal-kicker { color:#087e70; font-size:9px; font-weight:850; letter-spacing:.12em; }
.document-modal-header h3 { margin:5px 0; color:#1b3048; font-size:18px; font-weight:780; }
.document-modal-header p { margin:0; color:#8291a1; font-size:11px; }
.document-modal-close { display:grid; place-items:center; flex:0 0 32px; width:32px; height:32px; border:1px solid #e0e8ef; border-radius:8px; background:#fff; color:#587087; font-size:23px; line-height:1; cursor:pointer; }
.document-modal-content { display:grid; place-items:center; min-height:220px; padding:16px; overflow:auto; background:#f5f8fb; }
.document-image-preview { display:block; max-width:100%; max-height:calc(100vh - 245px); object-fit:contain; border-radius:8px; background:#fff; }
.document-pdf-preview { display:block; width:100%; height:min(65vh,700px); border:1px solid #dce5ed; border-radius:8px; background:#fff; }
.document-modal-error { color:#b23d49; font-size:12px; }
.document-modal-footer { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:14px 20px; border-top:1px solid #edf1f5; }
.document-open-original { margin-right:auto; color:#087e70; font-size:11px; font-weight:750; text-decoration:none; }
.document-modal-status { padding:6px 9px; border-radius:7px; background:#f0f4f8; color:#566a80; font-size:10px; font-weight:800; text-transform:capitalize; }
.document-modal-status.approved,.document-modal-status.verified { background:#e6f8f0; color:#137653; }
.document-modal-status.pending_review { background:#fff6df; color:#93630c; }
.document-modal-status.rejected { background:#fff0f1; color:#b23d49; }
.document-verify-button,.document-modal-done { min-height:36px; padding:0 13px; border:1px solid #cde9e3; border-radius:8px; background:#effaf7; color:#087e70; font-size:11px; font-weight:800; cursor:pointer; }
.document-verify-button.unverify { border-color:#f2c8cd; background:#fff0f1; color:#b13745; }
.document-verify-button:disabled { opacity:.55; cursor:wait; }
.document-modal-done { border-color:#dce5ed; background:#fff; color:#43576d; }
:global(.theme-dark) .kyc-page { --kyc-ink:#e7eef7; --kyc-muted:#b5c3d2; --kyc-border:#30445a; color:#e7eef7; }
:global(.theme-dark) .kyc-hero h2,:global(.theme-dark) .kyc-table td strong { color:#eef4fb; }
:global(.theme-dark) .summary-card,:global(.theme-dark) .register-panel { border-color:#30445a; background:#172a3d; box-shadow:none; }
:global(.theme-dark) .module-table th { border-color:#30445a; background:#20364b !important; color:#d4e0ed !important; }
:global(.theme-dark) .module-table td { border-color:#2b4055 !important; color:#dce6f1 !important; }
:global(.theme-dark) .module-table tbody tr:hover { background:#203a4e !important; }
:global(.theme-dark) .filter-grid select,:global(.theme-dark) .row-menu-trigger { border-color:#3b5065; background:#172a3d; color:#e1eaf4; }
:global(.theme-dark) .row-action-menu { border-color:#3b5065; background:#172a3d; }
:global(.theme-dark) .row-action-menu button { color:#dce6f1; }
:global(.theme-dark) .document-modal { border-color:#30445a; background:#172a3d; }
:global(.theme-dark) .document-modal-header { border-color:#2b4055; }
:global(.theme-dark) .document-modal-header h3 { color:#eef4fb; }
:global(.theme-dark) .document-modal-close,:global(.theme-dark) .document-modal-done { border-color:#3b5065; background:#172a3d; color:#dce6f1; }
@media(max-width:1050px) { .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .filter-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:650px) { .kyc-hero h2 { font-size:23px; } .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .filter-grid { grid-template-columns:1fr 1fr; padding:10px; } .pagination { align-items:flex-start; flex-direction:column; } .document-modal-backdrop { padding:10px; } .document-modal { max-height:calc(100vh - 20px); } .document-modal-header { padding:14px; } .document-modal-footer { padding:12px; } .document-open-original { flex-basis:100%; } }
@media(max-width:420px) { .summary-grid,.filter-grid { grid-template-columns:1fr; } }


/* Final refinements requested for the KYC register. */
.summary-card { justify-content:flex-start !important; gap:11px !important; }
.summary-card .metric-icon { display:grid; place-items:center; flex:0 0 34px; width:34px; height:34px; border-radius:10px; font-size:17px; font-weight:800; }
.metric-icon-total { color:#2474bb; background:#eaf4ff; }
.metric-icon-verified { color:#087e69; background:#e4f8f1; }
.metric-icon-pending { color:#a56a0a; background:#fff3d9; }
.metric-icon-rejected { color:#c44752; background:#ffebed; }
.summary-copy { display:grid; gap:3px; min-width:0; }
.summary-copy > span { color:#687b90; font-size:11px; font-weight:700; }
.summary-copy strong { color:#172b45; font-size:22px; font-weight:780; line-height:1.1; }
.kyc-customer-cell { display:flex; align-items:center; gap:10px; min-width:205px; }
.kyc-customer-avatar { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border-radius:11px; font-size:11px; font-weight:850; }
.kyc-customer-copy { display:grid; gap:4px; min-width:0; }
.kyc-customer-copy strong { color:#1b3048 !important; font-size:12px; font-weight:800 !important; line-height:1.35; white-space:normal; overflow-wrap:anywhere; }
.kyc-customer-copy small { margin:0 !important; color:#8291a1 !important; font-size:10px !important; overflow-wrap:anywhere; }
.kyc-record-cell strong { display:block; color:#354b62; font-size:11px; font-weight:750; white-space:nowrap; }
.kyc-record-cell small { display:block !important; margin-top:5px !important; color:#8291a1; font-size:10px; line-height:1.4; white-space:nowrap; }
.module-table-wrap { position:relative; }
.row-menu-wrap { position:static !important; }
.row-menu-trigger { flex:0 0 34px; }
.row-action-menu { position:fixed !important; z-index:99999 !important; min-width:160px; padding:6px; border:1px solid #e0e8ef; border-radius:10px; background:#fff; box-shadow:0 14px 34px rgba(24,48,74,.2); isolation:isolate; }
.row-action-menu button { display:block; width:100%; padding:10px 11px; border:0; border-radius:7px; background:transparent; color:#354b62; text-align:left; font-size:11px; font-weight:700; cursor:pointer; }
.row-action-menu button:hover { background:#f3faf9; color:#087e70; }
:global(.theme-dark) .summary-copy > span { color:#b5c3d2; }
:global(.theme-dark) .summary-copy strong,:global(.theme-dark) .kyc-customer-copy strong,:global(.theme-dark) .kyc-record-cell strong { color:#eef4fb !important; }
:global(.theme-dark) .kyc-record-cell small,:global(.theme-dark) .kyc-customer-copy small { color:#aab9c9 !important; }
:global(.theme-dark) .row-action-menu { border-color:#3b5065; background:#172a3d; }
:global(.theme-dark) .row-action-menu button { color:#dce6f1; }
@media(max-width:650px) { .kyc-customer-cell { min-width:180px; } }

</style>
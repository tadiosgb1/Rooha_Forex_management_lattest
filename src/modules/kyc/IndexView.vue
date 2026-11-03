<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { kycService } from '../../services/kycService'
import { customerProfileService } from '../../services/customerProfileService'

const route = useRoute()
const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const statusFilter = ref('')
const sortBy = ref('created_at')
const sortOrder = ref('DESC')
const currentPage = ref(1)
const pageSize = ref(10)
const totalPages = ref(1)
let searchTimer = null
const showForm = ref(false)
const editingId = ref(null)
const detailRow = ref(null)
const idPhoto = ref(null)
const selfie = ref(null)
const form = ref({ customer_profile_id: '', id_type: 'PASSPORT', dob: '', address: '', city: '', country: '' })
const customers = ref([])
const customerSearch = ref('')
const customersLoading = ref(false)
const customerPickerOpen = ref(false)
const customersLoaded = ref(false)
function customerLabel(customer) { const name = customer.full_name || customer.customer_name || customer.name || [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(' ') || 'Customer'; const phone = customer.phone_number || customer.phone; return phone ? `${name} · ${phone}` : name }
const filteredCustomers = computed(() => { const q = customerSearch.value.trim().toLowerCase(); return customers.value.filter(c => !q || [c.full_name, c.customer_name, c.name, c.first_name, c.middle_name, c.last_name, c.phone, c.phone_number].some(v => String(v ?? '').toLowerCase().includes(q))) })
async function loadCustomers() { if (customersLoaded.value || customersLoading.value) return; customersLoading.value = true; try { const res = await customerProfileService.list(); const data = res?.data?.items || res?.data?.results || res?.data || res?.items || res?.results || res; customers.value = Array.isArray(data) ? data : []; customersLoaded.value = true; const selected = customers.value.find(c => (c.id || c.customer_profile_id) === form.value.customer_profile_id); if (selected) customerSearch.value = customerLabel(selected) } catch (error) { errorMessage.value = error?.message || 'Unable to load customer profiles.' } finally { customersLoading.value = false } }
async function openCustomerPicker() { customerPickerOpen.value = true; await loadCustomers() }
function closeCustomerPicker() { customerPickerOpen.value = false }
function handleCustomerPickerFocusout(event) { if (!event.currentTarget.contains(event.relatedTarget)) closeCustomerPicker() }
function chooseCustomer(customer) { form.value.customer_profile_id = customer.id || customer.customer_profile_id; customerSearch.value = customerLabel(customer); customerPickerOpen.value = false }
function getCustomer(row) { return row.customerProfile || row.customer_profile || row.customer || customers.value.find(c => String(c.id || c.customer_profile_id) === String(row.customer_profile_id)) || null }
function customerDisplayForRow(row) { const customer = getCustomer(row); return customer ? (customer.full_name || customer.customer_name || customer.name || [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(' ') || 'Customer') : '—' }
function rowStatus(row) { const value = String(row.status || row.verification_status || row.kyc_status || '').toUpperCase(); if (row.verified === true || row.is_verified === true || value === 'VERIFIED') return 'VERIFIED'; if (value === 'REJECTED') return 'REJECTED'; return 'PENDING_REVIEW' }
function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
function formatDateTime(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString() }
function handleImageError(event) { event.target.style.display = 'none'; const fallback = event.target.parentElement?.querySelector('.kyc-image-empty'); if (fallback) fallback.style.display = 'block' }
function normalizeRows(response) { const body = response && response.data !== undefined ? response.data : response; const data = body && body.data !== undefined ? body.data : body && (body.items || body.results) ? (body.items || body.results) : body; return Array.isArray(data) ? data : [] }
function imageUrl(value) { return typeof value === 'string' && value.trim() ? value : '' }
function closeDetails() { detailRow.value = null }
const summaryCounts = computed(() => ({ total: rows.value.length, pending: rows.value.filter(row => rowStatus(row) === 'PENDING_REVIEW').length, verified: rows.value.filter(row => rowStatus(row) === 'VERIFIED').length, rejected: rows.value.filter(row => rowStatus(row) === 'REJECTED').length }))
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter(row => {
    const customer = getCustomer(row) || {}
    const matchesSearch = !q || [customer.full_name, customer.customer_name, customer.name, customer.first_name, customer.middle_name, customer.last_name, customer.email, customer.phone, customer.phone_number, row.id_type, row.address, row.city, row.country, row.id].some(v => String(v ?? '').toLowerCase().includes(q))
    const status = statusFilter.value || (route.query.status === 'pending' ? 'PENDING_REVIEW' : route.query.status === 'active' ? 'VERIFIED' : '')
    return matchesSearch && (!status || rowStatus(row) === status)
  })
})
function isVerified(row) { return rowStatus(row) === 'VERIFIED' }
function resetForm() {
  showForm.value = false; editingId.value = null
  form.value = { customer_profile_id: '', id_type: 'PASSPORT', dob: '', address: '', city: '', country: '' }
  customerSearch.value = ''
  customerPickerOpen.value = false
  idPhoto.value = null; selfie.value = null
}
function readDate(value) { return value ? String(value).slice(0, 10) : '' }
async function loadRows() {
  loading.value = true; errorMessage.value = ''
  try {
    const selectedStatus = statusFilter.value || (route.query.status === 'pending' ? 'PENDING_REVIEW' : route.query.status === 'active' ? 'VERIFIED' : '')
    const params = { sort_by: sortBy.value, order: sortOrder.value, page: currentPage.value, page_size: pageSize.value }
    if (search.value.trim()) params.search = search.value.trim()
    if (selectedStatus) params.status = selectedStatus
    const response = await kycService.list(params)
    rows.value = normalizeRows(response)
    const meta = response?.data && !Array.isArray(response.data) ? response.data : response
    totalPages.value = Number(meta?.total_pages || 1)
  } catch (error) { errorMessage.value = error?.message || 'Unable to load KYC records.' }
  finally { loading.value = false }
}
function beginCreate() {
  resetForm(); showForm.value = true; detailRow.value = null
  errorMessage.value = ''; successMessage.value = ''
}
function beginEdit(row) {
  detailRow.value = null; showForm.value = true; editingId.value = row.id
  form.value = { customer_profile_id: row.customer_profile_id || '', id_type: row.id_type || 'PASSPORT', dob: readDate(row.dob), address: row.address || '', city: row.city || '', country: row.country || '' }
  const selectedCustomer = customers.value.find(c => (c.id || c.customer_profile_id) === form.value.customer_profile_id)
  customerSearch.value = selectedCustomer ? customerLabel(selectedCustomer) : ''
  idPhoto.value = null; selfie.value = null
  errorMessage.value = ''; successMessage.value = ''
}
function validateFile(file, label) {
  if (file && file.size > 5 * 1024 * 1024) { errorMessage.value = `${label} must be 5 MB or smaller.`; return false }
  return true
}
async function saveRecord() {
  errorMessage.value = ''; successMessage.value = ''
  if (!form.value.customer_profile_id) { errorMessage.value = 'Please select a customer profile.'; return }
  if (!form.value.dob || !form.value.address.trim() || !form.value.city.trim() || !form.value.country.trim()) {
    errorMessage.value = 'Date of birth, address, city, and country are required.'; return
  }
  if (!editingId.value && (!idPhoto.value || !selfie.value)) { errorMessage.value = 'Identity document photo and selfie are required for a new KYC record.'; return }
  if (!validateFile(idPhoto.value, 'Identity document photo') || !validateFile(selfie.value, 'Selfie')) return
  saving.value = true
  const payload = { customer_profile_id: form.value.customer_profile_id, id_type: form.value.id_type, dob: form.value.dob, address: form.value.address.trim(), city: form.value.city.trim(), country: form.value.country.trim() }
  if (idPhoto.value) payload.id_photo = idPhoto.value
  if (selfie.value) payload.selfie = selfie.value
  try {
    if (editingId.value) { await kycService.update(editingId.value, payload); successMessage.value = 'KYC record updated.' }
    else { await kycService.create(payload); successMessage.value = 'KYC record created.' }
    resetForm(); await loadRows()
  } catch (error) { errorMessage.value = error?.message || 'Unable to save KYC record.' }
  finally { saving.value = false }
}
async function showDetails(row) {
  errorMessage.value = ''; detailRow.value = row; showForm.value = false
  try { const response = await kycService.get(row.id); const body = response?.data ?? response; detailRow.value = body?.data ?? body?.item ?? body ?? row }
  catch (error) { errorMessage.value = error?.message || 'Unable to load KYC details.' }
}
async function deleteRecord(row) {
  if (!window.confirm(`Delete KYC record "${row.id}"?`)) return
  errorMessage.value = ''; successMessage.value = ''
  try { await kycService.remove(row.id); successMessage.value = 'KYC record deleted.'; if (detailRow.value?.id === row.id) detailRow.value = null; await loadRows() }
  catch (error) { errorMessage.value = error?.message || 'Unable to delete KYC record.' }
}
async function toggleVerification(row) {
  errorMessage.value = ''; successMessage.value = ''
  try {
    if (isVerified(row)) await kycService.unverify(row.id)
    else await kycService.verify(row.id)
    successMessage.value = isVerified(row) ? 'KYC record marked unverified.' : 'KYC record verified.'
    await loadRows()
  } catch (error) { errorMessage.value = error?.message || 'Unable to update verification status.' }
}
watch([statusFilter, sortBy, sortOrder, currentPage], () => loadRows())
watch(search, () => { if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(() => { currentPage.value = 1; loadRows() }, 350) })
onMounted(async () => { await Promise.all([loadRows(), loadCustomers()]) })
</script>

<template>
  <section class="module-page">
    
    <div class="module-page-intro kyc-page-hero"><div><p class="kyc-eyebrow">COMPLIANCE WORKSPACE</p><h2>KYC management</h2><p class="module-description">Review customer identity submissions, inspect documents, and manage verification decisions from one workspace.</p></div><BaseButton @click="beginCreate">＋ New KYC record</BaseButton></div>
    <section class="kyc-summary-grid" aria-label="KYC summary"><article class="kyc-summary-card"><span class="kyc-summary-icon">▤</span><div><span>Total records loaded</span><strong>{{ summaryCounts.total }}</strong></div></article><article class="kyc-summary-card"><span class="kyc-summary-icon pending-icon">◷</span><div><span>Pending review</span><strong>{{ summaryCounts.pending }}</strong></div></article><article class="kyc-summary-card"><span class="kyc-summary-icon verified-icon">✓</span><div><span>Verified</span><strong>{{ summaryCounts.verified }}</strong></div></article><article class="kyc-summary-card"><span class="kyc-summary-icon rejected-icon">!</span><div><span>Rejected</span><strong>{{ summaryCounts.rejected }}</strong></div></article></section>
    <p v-if="errorMessage" role="alert" style="color:#b43f4a;margin:0 0 14px">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status" style="color:var(--brand-base-color);margin:0 0 14px">{{ successMessage }}</p>

    <section v-if="showForm" class="module-panel" style="margin-bottom:20px">
      <div class="module-panel-header"><h3>{{ editingId ? 'Edit KYC record' : 'Create KYC record' }}</h3></div>
      <form class="module-form-grid" @submit.prevent="saveRecord">
        <label class="module-form-field" style="grid-column:1/-1"><span>Customer profile <b>*</b></span><div class="customer-picker" @focusout="handleCustomerPickerFocusout"><input v-model="customerSearch" class="ui-input" type="search" placeholder="Focus to load, then search customers…" autocomplete="off" required @focus="openCustomerPicker" @input="form.customer_profile_id = ''; customerPickerOpen = true" /><div v-if="customerPickerOpen" class="customer-picker-results" role="listbox"><p v-if="customersLoading" class="customer-picker-message">Loading customers…</p><p v-else-if="!filteredCustomers.length" class="customer-picker-message">{{ customerSearch ? "No matching customers found." : "No customer profiles available." }}</p><button v-for="customer in filteredCustomers" :key="customer.id || customer.customer_profile_id" type="button" class="customer-picker-option" role="option" @click="chooseCustomer(customer)">{{ customerLabel(customer) }}</button></div></div></label>
        <label class="module-form-field"><span>Identity type <b>*</b></span><select v-model="form.id_type" required><option value="PASSPORT">Passport</option><option value="NATIONAL_ID">National ID</option><option value="DRIVER_LICENSE">Driver license</option></select></label>
        <label class="module-form-field"><span>Date of birth <b>*</b></span><input v-model="form.dob" type="date" required /></label>
        <label class="module-form-field"><span>Address <b>*</b></span><BaseInput v-model="form.address" required placeholder="Street address" /></label>
        <label class="module-form-field"><span>City <b>*</b></span><BaseInput v-model="form.city" required placeholder="City" /></label>
        <label class="module-form-field"><span>Country <b>*</b></span><BaseInput v-model="form.country" required placeholder="Country" /></label>
        <label class="module-form-field"><span>Identity document photo {{ editingId ? '(optional replacement)' : '*' }}</span><input type="file" accept="image/*" :required="!editingId" @change="idPhoto = $event.target.files?.[0] || null" /><small>Maximum 5 MB. {{ editingId ? 'Leave empty to keep the existing file.' : 'Required.' }}</small></label>
        <label class="module-form-field"><span>Selfie photo {{ editingId ? '(optional replacement)' : '*' }}</span><input type="file" accept="image/*" :required="!editingId" @change="selfie = $event.target.files?.[0] || null" /><small>Maximum 5 MB. {{ editingId ? 'Leave empty to keep the existing file.' : 'Required.' }}</small></label>
        <div class="module-form-footer" style="grid-column:1/-1"><span>Photo uploads use multipart form data.</span><div style="display:flex;gap:8px"><BaseButton type="button" variant="secondary" @click="resetForm">Cancel</BaseButton><BaseButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create record' }}</BaseButton></div></div>
      </form>
    </section>

    <section v-if="detailRow" class="module-panel kyc-detail-panel">
      <div class="module-panel-header"><div><h3>KYC record details</h3><p class="module-description">Reference #{{ detailRow.id }} · Submitted {{ formatDateTime(detailRow.created_at) }}</p></div><BaseButton variant="secondary" @click="closeDetails">Close details</BaseButton></div>
      <div class="kyc-detail-content">
        <section class="kyc-detail-section"><h4>Verification overview</h4><div class="kyc-detail-stats"><div><span>Status</span><strong class="module-status-chip" :class="rowStatus(detailRow) === 'VERIFIED' ? 'verified' : rowStatus(detailRow) === 'REJECTED' ? 'rejected' : 'pending'">{{ rowStatus(detailRow).replaceAll('_',' ') }}</strong></div><div><span>Identity type</span><strong>{{ detailRow.id_type || '—' }}</strong></div><div><span>Date of birth</span><strong>{{ formatDate(detailRow.dob) }}</strong></div><div><span>Verified at</span><strong>{{ formatDate(detailRow.verified_at) }}</strong></div></div></section>
        <section class="kyc-detail-section"><h4>Customer information</h4><dl class="kyc-detail-grid"><div><dt>Full name</dt><dd>{{ customerDisplayForRow(detailRow) }}</dd></div><div><dt>Phone</dt><dd>{{ getCustomer(detailRow)?.phone || getCustomer(detailRow)?.phone_number || '—' }}</dd></div><div><dt>Email</dt><dd>{{ getCustomer(detailRow)?.email || '—' }}</dd></div><div><dt>Nationality</dt><dd>{{ getCustomer(detailRow)?.nationality || '—' }}</dd></div><div><dt>Identity number</dt><dd>{{ getCustomer(detailRow)?.id_number || '—' }}</dd></div><div><dt>Customer KYC status</dt><dd>{{ getCustomer(detailRow)?.kyc_status || '—' }}</dd></div><div><dt>Risk level</dt><dd>{{ getCustomer(detailRow)?.risk_level || '—' }}</dd></div></dl></section>
        <section class="kyc-detail-section"><h4>Address information</h4><dl class="kyc-detail-grid"><div><dt>KYC address</dt><dd>{{ detailRow.address || '—' }}</dd></div><div><dt>City / country</dt><dd>{{ [detailRow.city, detailRow.country].filter(Boolean).join(', ') || '—' }}</dd></div><div><dt>Customer address</dt><dd>{{ [getCustomer(detailRow)?.address_line1, getCustomer(detailRow)?.address_line2, getCustomer(detailRow)?.city, getCustomer(detailRow)?.country].filter(Boolean).join(', ') || '—' }}</dd></div></dl></section>
        <section class="kyc-detail-section"><h4>Identity document and selfie</h4><div class="kyc-image-grid">
          <div class="kyc-image-card"><h5><span>01</span> Identity document</h5><a v-if="imageUrl(detailRow.id_photo_path || detailRow.id_photo_url)" :href="imageUrl(detailRow.id_photo_path || detailRow.id_photo_url)" target="_blank" rel="noopener noreferrer"><img :src="imageUrl(detailRow.id_photo_path || detailRow.id_photo_url)" alt="Customer identity document" loading="lazy" @error="handleImageError" /></a><p class="kyc-image-empty" :style="{ display: imageUrl(detailRow.id_photo_path || detailRow.id_photo_url) ? 'none' : 'block' }">No identity document image available or image could not be loaded.</p><a v-if="imageUrl(detailRow.id_photo_path || detailRow.id_photo_url)" :href="imageUrl(detailRow.id_photo_path || detailRow.id_photo_url)" target="_blank" rel="noopener noreferrer">Open full image ↗</a></div>
          <div class="kyc-image-card"><h5><span>02</span> Customer selfie</h5><a v-if="imageUrl(detailRow.selfie_photo_path || detailRow.selfie_photo_url || detailRow.selfie_path)" :href="imageUrl(detailRow.selfie_photo_path || detailRow.selfie_photo_url || detailRow.selfie_path)" target="_blank" rel="noopener noreferrer"><img :src="imageUrl(detailRow.selfie_photo_path || detailRow.selfie_photo_url || detailRow.selfie_path)" alt="Customer selfie" loading="lazy" @error="handleImageError" /></a><p class="kyc-image-empty" :style="{ display: imageUrl(detailRow.selfie_photo_path || detailRow.selfie_photo_url || detailRow.selfie_path) ? 'none' : 'block' }">No selfie image available or image could not be loaded.</p><a v-if="imageUrl(detailRow.selfie_photo_path || detailRow.selfie_photo_url || detailRow.selfie_path)" :href="imageUrl(detailRow.selfie_photo_path || detailRow.selfie_url || detailRow.selfie_path)" target="_blank" rel="noopener noreferrer">Open full image ↗</a></div>
        </div></section>
      </div>
    </section>

    <section class="module-panel">
      <div class="module-panel-header kyc-register-header"><div><h3>KYC register</h3><p class="module-description">Browse submissions and narrow the register with filters.</p></div><label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search name, email, phone…" aria-label="Search KYC records by customer" size="sm" /></label></div>
      <div class="kyc-filters"><label><span>Verification status</span><select v-model="statusFilter"><option value="">All statuses</option><option value="PENDING_REVIEW">Pending review</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option></select></label><label><span>Sort by</span><select v-model="sortBy"><option value="created_at">Created date</option><option value="dob">Date of birth</option><option value="id_type">Identity type</option><option value="id">Record number</option></select></label><label><span>Order</span><select v-model="sortOrder"><option value="DESC">Newest / descending</option><option value="ASC">Oldest / ascending</option></select></label><label><span>Rows per page</span><select v-model.number="pageSize" @change="currentPage = 1; loadRows()"><option :value="10">10</option><option :value="25">25</option><option :value="50">50</option></select></label></div>
      <div class="module-table-wrap"><table class="module-table"><thead><tr><th>Record</th><th>Customer</th><th>Identity document</th><th>Date of birth</th><th>Location</th><th>Verification status</th><th class="module-actions-head">Actions</th></tr></thead><tbody>
        <tr v-if="loading"><td colspan="7" class="module-empty-state">Loading KYC records…</td></tr><tr v-else-if="!filteredRows.length"><td colspan="7" class="module-empty-state">No KYC records found.</td></tr>
        <tr v-for="row in filteredRows" :key="row.id"><td>#{{ row.id ?? '—' }}</td><td><strong>{{ customerDisplayForRow(row) }}</strong><small class="kyc-customer-email">{{ getCustomer(row)?.email || getCustomer(row)?.phone || getCustomer(row)?.phone_number || '' }}</small></td><td><span class="kyc-type-pill">{{ row.id_type || '—' }}</span></td><td>{{ readDate(row.dob) || '—' }}</td><td>{{ [row.city,row.country].filter(Boolean).join(', ') || '—' }}</td><td><span class="module-status-chip" :class="rowStatus(row) === 'VERIFIED' ? 'verified' : rowStatus(row) === 'REJECTED' ? 'rejected' : 'pending'"><i></i>{{ rowStatus(row).replaceAll('_',' ') }}</span></td><td class="module-row-actions"><button type="button" @click="showDetails(row)">View</button><button type="button" @click="beginEdit(row)">Edit</button><button type="button" @click="toggleVerification(row)">{{ isVerified(row) ? 'Unverify' : 'Verify' }}</button><button type="button" class="module-delete-action" @click="deleteRecord(row)">Delete</button></td></tr>
      </tbody></table></div>
      <div class="module-table-footer kyc-pagination"><span>Showing {{ filteredRows.length }} records on this page · Page {{ currentPage }} of {{ totalPages }}</span><div><BaseButton size="sm" variant="secondary" :disabled="currentPage <= 1 || loading" @click="currentPage--; loadRows()">Previous</BaseButton><BaseButton size="sm" variant="secondary" :disabled="currentPage >= totalPages || loading" @click="currentPage++; loadRows()">Next</BaseButton></div></div>
    </section>
  </section>
</template>
<style scoped>
.customer-picker{position:relative}.customer-picker-results{position:absolute;z-index:20;top:100%;left:0;right:0;max-height:240px;overflow-y:auto;background:var(--surface-color,#fff);border:1px solid var(--border-color,#d1d5db);border-radius:6px;box-shadow:0 8px 20px #00000018}.customer-picker-option{display:block;width:100%;padding:10px 12px;text-align:left;border:0;background:transparent;cursor:pointer;color:inherit}.customer-picker-option:hover{background:var(--surface-muted-color,#f3f4f6)}.customer-picker-message{padding:10px 12px;margin:0}
.kyc-page-hero{align-items:flex-end;margin-bottom:22px}.kyc-eyebrow{margin:0 0 8px;font-size:11px;letter-spacing:.14em;font-weight:800;color:var(--brand-base-color,#4665a8)}.kyc-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}.kyc-summary-card{display:flex;align-items:center;gap:13px;padding:18px;background:var(--surface-color,#fff);border:1px solid var(--border-color,#e5e7eb);border-radius:12px;box-shadow:0 3px 12px #10182808}.kyc-summary-icon{display:grid;place-items:center;width:42px;height:42px;flex-shrink:0;border-radius:10px;background:#eef2ff;color:#4059a8;font-size:22px;font-weight:700}.kyc-summary-icon.pending-icon{background:#fff5df;color:#a66a08}.kyc-summary-icon.verified-icon{background:#e5f7ee;color:#17764a}.kyc-summary-icon.rejected-icon{background:#ffeded;color:#b43f4a}.kyc-summary-card div{display:flex;flex-direction:column;gap:5px;min-width:0}.kyc-summary-card div span{font-size:12px;color:var(--text-muted-color,#6b7280)}.kyc-summary-card strong{font-size:24px;line-height:1.1;font-weight:750}.kyc-type-pill{display:inline-block;padding:5px 8px;border-radius:6px;background:var(--surface-muted-color,#f3f4f6);font-size:11px;font-weight:750;letter-spacing:.03em}.module-status-chip i{display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:6px;vertical-align:middle}.kyc-image-card h5{display:flex;align-items:center;gap:9px}.kyc-image-card h5 span{display:grid;place-items:center;width:25px;height:25px;border-radius:6px;background:var(--surface-muted-color,#f3f4f6);font-size:10px}.kyc-filters{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:12px;padding:16px 20px;border-bottom:1px solid var(--border-color,#e5e7eb)}.kyc-filters label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text-muted-color,#6b7280)}.kyc-filters select{width:100%;min-width:0;padding:9px 10px;border:1px solid var(--border-color,#d1d5db);border-radius:6px;background:var(--surface-color,#fff);color:inherit}.kyc-register-header{gap:16px}.kyc-customer-email{display:block;margin-top:4px;font-size:12px;color:var(--text-muted-color,#6b7280)}.kyc-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px}.kyc-pagination>div{display:flex;gap:8px}.kyc-detail-panel{margin-bottom:20px}.kyc-detail-content{padding:20px;display:grid;gap:22px}.kyc-detail-section h4{margin:0 0 14px;font-size:14px}.kyc-detail-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kyc-detail-stats>div{display:flex;flex-direction:column;gap:8px;padding:14px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px}.kyc-detail-stats span,.kyc-detail-grid dt{font-size:12px;color:var(--text-muted-color,#6b7280)}.kyc-detail-stats strong{font-size:14px}.kyc-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 20px;margin:0}.kyc-detail-grid>div{min-width:0}.kyc-detail-grid dd{margin:5px 0 0;overflow-wrap:anywhere}.kyc-image-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.kyc-image-card{padding:14px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;min-width:0}.kyc-image-card h5{margin:0 0 12px;font-size:13px}.kyc-image-card img{display:block;width:100%;height:300px;object-fit:contain;background:#f3f4f6;border-radius:6px}.kyc-image-card>a:last-child{display:inline-block;margin-top:10px;font-size:13px}.kyc-image-empty{padding:40px 12px;text-align:center;color:var(--text-muted-color,#6b7280)}@media(max-width:800px){.kyc-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kyc-filters,.kyc-detail-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.kyc-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kyc-image-grid{grid-template-columns:1fr}.kyc-register-header{align-items:flex-start;flex-direction:column}}@media(max-width:480px){.kyc-summary-grid{grid-template-columns:1fr}.kyc-filters,.kyc-detail-stats,.kyc-detail-grid{grid-template-columns:1fr}.kyc-pagination{align-items:flex-start;flex-direction:column}}
</style>

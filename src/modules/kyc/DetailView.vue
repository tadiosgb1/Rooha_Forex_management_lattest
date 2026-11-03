<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { confirmAction } from '../../composables/confirmAction'
import { kycService } from '../../services/kycService'

const route = useRoute()
const router = useRouter()
const record = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const actionMessage = ref('')
const actionBusy = ref(false)
const activeTab = ref('evidence')
function unwrap(response) {
  let body = response?.data ?? response
  if (body?.data && !Array.isArray(body.data) && typeof body.data === 'object') body = body.data
  return body?.item ?? body
}
const profile = computed(() => record.value?.customerProfile || record.value?.customer_profile || record.value?.customer || {})
const fullName = computed(() => profile.value.full_name || profile.value.customer_name || profile.value.name || [profile.value.first_name, profile.value.middle_name, profile.value.last_name].filter(Boolean).join(' ') || 'Customer name unavailable')
const customerProfileId = computed(() => profile.value.id || record.value?.customer_profile_id || record.value?.customerProfileId || '')
const status = computed(() => {
  const r = record.value || {}
  const value = String(r.status || r.verification_status || r.kyc_status || '').toUpperCase()
  if (r.verified === true || r.is_verified === true || r.verified_at || ['VERIFIED', 'APPROVED'].includes(value)) return 'APPROVED'
  if (['REJECTED', 'DECLINED'].includes(value)) return 'REJECTED'
  if (['PENDING', 'PENDING_REVIEW', 'IN_REVIEW', 'UNDER_REVIEW'].includes(value)) return 'PENDING_REVIEW'
  return value || 'UNKNOWN'
})
const idImage = computed(() => record.value?.file_path || record.value?.id_photo_path || record.value?.id_photo_url || record.value?.id_photo || '')
const documentType = computed(() => record.value?.documentTypeRef?.display_label || record.value?.documentTypeRef?.code || profile.value?.idTypeRef?.display_label || profile.value?.id_type || record.value?.id_type || record.value?.document_type || '—')
const isPdf = computed(() => /\.pdf(?:$|[?#])/i.test(idImage.value))
const selfieImage = computed(() => record.value?.selfie_photo_path || record.value?.selfie_photo_url || record.value?.selfie_path || record.value?.selfie_url || '')
function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}
function imageError(event) {
  event.target.style.display = 'none'
  const fallback = event.target.parentElement?.querySelector('.image-fallback')
  if (fallback) fallback.style.display = 'grid'
}
async function loadRecord() {
  loading.value = true
  errorMessage.value = ''
  try { record.value = unwrap(await kycService.get(route.params.id)) }
  catch (error) { errorMessage.value = error?.message || 'Unable to load KYC details.' }
  finally { loading.value = false }
}
async function editRecord() {
  if (!hasPermission('kyc:update') || !customerProfileId.value) return
  router.push(`/kyc/${encodeURIComponent(customerProfileId.value)}/edit`)
}
async function deleteRecord() {
  if (!hasPermission('kyc:delete') || !record.value || actionBusy.value) return
  const confirmed = await confirmAction({ title: 'Delete KYC record', message: `Delete the KYC document for ${fullName.value}? This action cannot be undone.`, confirmText: 'Delete', confirmVariant: 'danger' })
  if (!confirmed) return
  actionBusy.value = true
  errorMessage.value = ''
  actionMessage.value = ''
  try {
    if (!customerProfileId.value) throw new Error('Customer profile ID is missing for this KYC record.')
    await kycService.remove(customerProfileId.value)
    router.push('/kyc')
  } catch (error) { errorMessage.value = error?.message || 'Unable to delete KYC record.' }
  finally { actionBusy.value = false }
}
async function toggleVerification() {
  if (!record.value || actionBusy.value) return
  const wasVerified = ['APPROVED', 'VERIFIED'].includes(status.value)
  if (wasVerified ? !hasPermission('kyc:unverify') : !hasPermission('kyc:verify')) return
  const confirmed = await confirmAction({
    title: wasVerified ? 'Confirm KYC unverification' : 'Confirm KYC verification',
    message: wasVerified
      ? `Do you want to confirm removing verification from KYC record #${record.value.id} for ${fullName.value}?`
      : `Do you want to confirm verification of KYC record #${record.value.id} for ${fullName.value}?`,
    confirmText: wasVerified ? 'Unverify' : 'Verify',
    confirmVariant: wasVerified ? 'danger' : 'primary',
  })
  if (!confirmed) return
  actionBusy.value = true
  errorMessage.value = ''
  actionMessage.value = ''
  try {
    if (!customerProfileId.value) throw new Error('Customer profile ID is missing for this KYC record.')
    if (wasVerified) await kycService.unverify(customerProfileId.value)
    else await kycService.verify(customerProfileId.value)
    actionMessage.value = 'Verification status updated.'
    await loadRecord()
  } catch (error) { errorMessage.value = error?.message || 'Unable to update verification status.' }
  finally { actionBusy.value = false }
}
onMounted(loadRecord)
</script>

<template>
  <section class="module-page kyc-detail-page">
    <header class="detail-hero">
      <div><button type="button" class="back-link" @click="router.push('/kyc')">← Back to KYC</button><h2>KYC details</h2></div>
      <div class="hero-actions"><BaseButton v-if="hasPermission('kyc:update')" variant="secondary" :disabled="actionBusy || !record" @click="editRecord">Edit record</BaseButton><BaseButton v-if="( ['APPROVED', 'VERIFIED'].includes(status) && hasPermission('kyc:unverify')) || (!(['APPROVED', 'VERIFIED'].includes(status)) && hasPermission('kyc:verify'))" variant="secondary" :disabled="actionBusy || !record" @click="toggleVerification">{{ actionBusy ? 'Updating…' : ['APPROVED', 'VERIFIED'].includes(status) ? 'Unverify' : 'Verify' }}</BaseButton><BaseButton v-if="hasPermission('kyc:delete')" variant="danger" :disabled="actionBusy || !record" @click="deleteRecord">Delete</BaseButton></div>
    </header>
    <p v-if="loading" class="state-message">Loading KYC record…</p>
    <p v-if="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>
    <p v-if="actionMessage" class="notice success" role="status">{{ actionMessage }}</p>

    <template v-if="record && !loading">
      <section class="record-banner">
        <div class="record-avatar">{{ fullName.split(' ').filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase() }}</div>
        <div class="record-identity"><span class="record-reference">KYC RECORD #{{ record.id }}</span><h3>{{ fullName }}</h3><p>{{ profile.phone || profile.phone_number || 'No phone number' }}</p><router-link v-if="customerProfileId" class="customer-profile-link" :to="`/customers/${encodeURIComponent(customerProfileId)}`">View customer profile ↗</router-link></div>
        <span class="status-pill" :class="status.toLowerCase()"><i></i>{{ status.replaceAll('_',' ') }}</span>
      </section>

      <nav class="detail-tabs" aria-label="KYC detail sections">
        <button type="button" :class="{ active: activeTab === 'evidence' }" :aria-selected="activeTab === 'evidence'" @click="activeTab = 'evidence'">Documents & photos</button>
        <button type="button" :class="{ active: activeTab === 'overview' }" :aria-selected="activeTab === 'overview'" @click="activeTab = 'overview'">KYC overview</button>
      </nav>

      <section v-if="activeTab === 'overview'" class="detail-grid">
        <article class="module-panel detail-card"><div class="card-heading"><h3>Verification overview</h3><span class="status-pill" :class="status.toLowerCase()"><i></i>{{ status.replaceAll('_',' ') }}</span></div><dl class="field-grid"><div><dt>Identity document</dt><dd>{{ documentType }}</dd></div><div><dt>Document number</dt><dd>{{ record.id_number || profile.id_number || '—' }}</dd></div><div><dt>Expiry date</dt><dd>{{ formatDate(record.expiry_date) }}</dd></div><div><dt>Date of birth</dt><dd>{{ formatDate(record.dob) }}</dd></div><div><dt>Submitted on</dt><dd>{{ formatDateTime(record.created_at) }}</dd></div><div><dt>Verified on</dt><dd>{{ formatDateTime(record.verified_at) }}</dd></div><div><dt>Record reference</dt><dd>#{{ record.id }}</dd></div></dl></article>
        <article class="module-panel detail-card"><div class="card-heading"><h3>KYC address</h3></div><dl class="field-grid"><div><dt>Address</dt><dd>{{ record.address || '—' }}</dd></div><div><dt>City</dt><dd>{{ record.city || '—' }}</dd></div><div><dt>Country</dt><dd>{{ record.country || '—' }}</dd></div></dl></article>
      </section>

      <section v-else class="module-panel evidence-panel">
        <div class="evidence-toolbar"><span class="document-status-copy">Current status: <strong>{{ status.replaceAll('_', ' ') }}</strong></span><BaseButton v-if="hasPermission('kyc:update')" variant="secondary" :disabled="actionBusy" @click="editRecord">Edit</BaseButton><BaseButton v-if="( ['APPROVED', 'VERIFIED'].includes(status) && hasPermission('kyc:unverify')) || (!(['APPROVED', 'VERIFIED'].includes(status)) && hasPermission('kyc:verify'))" variant="secondary" :disabled="actionBusy" @click="toggleVerification">{{ actionBusy ? 'Updating…' : ['APPROVED', 'VERIFIED'].includes(status) ? 'Unverify' : 'Verify' }}</BaseButton><BaseButton v-if="hasPermission('kyc:delete')" variant="danger" :disabled="actionBusy" @click="deleteRecord">Delete</BaseButton></div>
        <div class="evidence-grid">
          <article class="evidence-card"><div class="evidence-card-heading"><div><h4>Identity document</h4><p>{{ documentType }}<span v-if="record.id_number"> · No. {{ record.id_number }}</span></p></div><span class="file-state" :class="idImage ? 'available' : 'missing'">{{ idImage ? 'Uploaded' : 'Unavailable' }}</span></div><a v-if="idImage && isPdf" class="document-file-link" :href="idImage" target="_blank" rel="noopener noreferrer"><span class="document-file-icon">PDF</span><span><strong>Open identity document</strong><small>View or download the uploaded PDF</small></span><span>↗</span></a><a v-else-if="idImage" class="image-link" :href="idImage" target="_blank" rel="noopener noreferrer"><img :src="idImage" alt="Customer identity document" @error="imageError" /><span class="image-fallback" style="display:none">Image could not be loaded. Use Open original to access the uploaded document.</span></a><div v-else class="image-fallback">No identity document file was included in the API response.</div><a v-if="idImage && !isPdf" class="open-image" :href="idImage" target="_blank" rel="noopener noreferrer">Open original ↗</a></article>
          <article class="evidence-card"><div class="evidence-card-heading"><div><h4>Customer selfie</h4><p>Face / liveness reference</p></div><span class="file-state" :class="selfieImage ? 'available' : 'missing'">{{ selfieImage ? 'Uploaded' : 'Unavailable' }}</span></div><a v-if="selfieImage" class="image-link" :href="selfieImage" target="_blank" rel="noopener noreferrer"><img :src="selfieImage" alt="Customer selfie" @error="imageError" /><span class="image-fallback" style="display:none">Image could not be loaded. Check the upload server and image URL.</span></a><div v-else class="image-fallback">No selfie image was included in the API response.</div><a v-if="selfieImage" class="open-image" :href="selfieImage" target="_blank" rel="noopener noreferrer">Open original ↗</a></article>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.kyc-detail-page{display:grid;gap:12px}.detail-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.detail-hero h2{margin:4px 0 8px;font-size:28px;letter-spacing:-.035em}.back-link{display:block;margin:0 0 18px;padding:0;border:0;background:transparent;color:var(--brand-base-color,#435fb0);font:inherit;font-size:13px;font-weight:700;cursor:pointer}.eyebrow{margin:0 0 7px;color:var(--brand-base-color,#435fb0);font-size:10px;font-weight:800;letter-spacing:.15em}.hero-actions{display:flex;gap:9px;flex-shrink:0}.record-banner{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-color,#e5e7eb);border-radius:0;background:var(--surface-color,#fff)}.record-avatar{display:grid;place-items:center;width:58px;height:58px;flex-shrink:0;border-radius:0;background:#edf1ff;color:#4059a8;font-size:18px;font-weight:800}.record-identity{min-width:0;flex:1}.record-reference{font-size:10px;letter-spacing:.1em;font-weight:800;color:var(--text-muted-color,#667085)}.record-identity h3{margin:5px 0;font-size:20px}.record-identity p{margin:0;color:var(--text-muted-color,#667085);font-size:13px;overflow-wrap:anywhere}.record-identity p span{padding:0 5px}.customer-profile-link{display:inline-block;margin-top:7px;color:var(--brand-base-color,#435fb0);font-size:12px;font-weight:700;text-decoration:none}.customer-profile-link:hover{text-decoration:underline}.status-pill{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:0;font-size:10px;font-weight:800;white-space:nowrap}.status-pill i{width:6px;height:6px;border-radius:50%;background:currentColor}.status-pill.pending_review{color:#99630b;background:#fff4d8}.status-pill.verified,.status-pill.approved{color:#167349;background:#e7f7ef}.status-pill.rejected{color:#b42332;background:#fff0f1}.detail-tabs{display:flex;gap:0;border-bottom:1px solid var(--border-color,#d9dde5)}.detail-tabs button{padding:10px 14px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--text-muted-color,#667085);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.detail-tabs button.active{border-bottom-color:var(--brand-base-color,#435fb0);color:var(--brand-base-color,#435fb0)}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.detail-card{padding:20px;min-width:0}.card-heading{display:flex;align-items:center;gap:11px;padding-bottom:17px;margin-bottom:16px;border-bottom:1px solid var(--border-color,#e5e7eb)}.section-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:0;background:var(--surface-muted-color,#f3f5f9);font-size:19px}.card-heading h3,.evidence-heading h3{margin:0 0 4px;font-size:15px}.card-heading p{margin:0;color:var(--text-muted-color,#667085);font-size:12px}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 20px;margin:0}.field-grid>div{min-width:0}.field-grid dt{margin-bottom:5px;color:var(--text-muted-color,#667085);font-size:11px}.field-grid dd{margin:0;font-size:13px;font-weight:600;overflow-wrap:anywhere}.risk-pill{display:inline-block;padding:4px 8px;border-radius:0;background:#edf7ef;color:#247346;font-size:11px}.risk-pill.high{background:#fff0f1;color:#b42332}.risk-pill.medium{background:#fff4d8;color:#99630b}.address-card{grid-column:1/-1}.evidence-panel{padding:10px}.evidence-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-bottom:8px}.document-status-copy{margin-right:auto;color:var(--text-muted-color,#667085);font-size:12px}.document-file-link{display:flex;align-items:center;gap:12px;min-height:110px;padding:18px;border:1px solid var(--border-color,#e5e7eb);background:var(--surface-muted-color,#f8fafc);color:inherit;text-decoration:none}.document-file-link>span:nth-child(2){display:grid;gap:5px;flex:1}.document-file-link small{color:var(--text-muted-color,#667085)}.document-file-icon{display:grid;place-items:center;width:42px;height:48px;background:#fff0f1;color:#b42332;font-size:12px;font-weight:800}.evidence-toolbar :deep(button){min-height:28px;padding:4px 10px;font-size:11px;line-height:1.2}.evidence-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;margin-bottom:18px}.evidence-heading h3{font-size:18px;margin-bottom:6px}.evidence-count{font-size:11px;font-weight:700;color:var(--text-muted-color,#667085);white-space:nowrap}.evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.evidence-card{min-width:0;padding:15px;border:1px solid var(--border-color,#e5e7eb);border-radius:0}.evidence-card-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.evidence-card-heading>div{display:flex;align-items:center;gap:10px;min-width:0}.evidence-number{display:grid;place-items:center;width:30px;height:30px;flex-shrink:0;border-radius:0;background:var(--surface-muted-color,#f2f4f7);font-size:11px;font-weight:800}.evidence-card h4{margin:0 0 4px;font-size:13px}.evidence-card-heading p{margin:0;font-size:11px;color:var(--text-muted-color,#667085)}.file-state{padding:5px 8px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}.file-state.available{background:#e7f7ef;color:#167349}.file-state.missing{background:#fff0f1;color:#b42332}.image-link{display:block;position:relative;overflow:hidden;border-radius:8px;background:#f5f6f8}.image-link img{display:block;width:100%;height:220px;object-fit:contain;background:#f5f6f8}.image-fallback{display:grid;place-items:center;min-height:200px;padding:24px;text-align:center;background:var(--surface-muted-color,#f5f6f8);color:var(--text-muted-color,#667085);font-size:12px;border-radius:8px}.image-link .image-fallback{min-height:220px}.open-image{display:inline-block;margin-top:12px;color:var(--brand-base-color,#435fb0);font-size:12px;font-weight:700}.notice{margin:0;padding:12px 14px;border-radius:8px}.error{background:#fff0f1;color:#a62d39}.success{background:#eaf8f0;color:#167349}.state-message{padding:18px;border-radius:8px;background:var(--surface-color,#fff);color:var(--text-muted-color,#667085)}@media(max-width:800px){.detail-grid{grid-template-columns:1fr}.address-card{grid-column:auto}.evidence-grid{grid-template-columns:1fr}.detail-hero{align-items:flex-start;flex-direction:column}.hero-actions{flex-wrap:wrap}}@media(max-width:520px){.record-banner{align-items:flex-start;flex-wrap:wrap}.record-identity{flex-basis:calc(100% - 75px)}.record-banner>.status-pill{margin-left:74px}.field-grid{grid-template-columns:1fr}.evidence-panel{padding:14px}.image-link img{height:200px}.image-link .image-fallback{min-height:200px}}
</style>
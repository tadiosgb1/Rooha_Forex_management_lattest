<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { confirmAction } from '../../composables/confirmAction'
import { customerProfileService } from '../../services/customerProfileService'
import { kycService } from '../../services/kycService'

const route = useRoute()
const router = useRouter()
const record = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const activeTab = ref('overview')
const kycRecord = ref(null)
const kycLoading = ref(false)
const kycError = ref('')
const kycLoaded = ref(false)
const documentModalOpen = ref(false)

const fullName = computed(() =>
  [record.value?.first_name, record.value?.middle_name, record.value?.last_name]
    .filter(Boolean)
    .join(' ') || 'Customer profile',
)

const profileKycStatus = computed(() => kycStatus(kycRecord.value || { status: record.value?.kyc_status }))

const initials = computed(() =>
  [record.value?.first_name, record.value?.last_name]
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'C',
)

function display(value) {
  return value === null || value === undefined || String(value).trim() === '' ? '—' : value
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function unwrapKyc(response) {
  let body = response?.data ?? response
  if (body?.data !== undefined) body = body.data
  if (body?.item) body = body.item
  if (Array.isArray(body)) return body[0] || null
  if (Array.isArray(body?.items)) return body.items[0] || null
  if (Array.isArray(body?.results)) return body.results[0] || null
  return body && typeof body === 'object' ? body : null
}
function kycStatus(row) {
  if (!row) return 'NOT FOUND'
  const value = String(row.status || row.verification_status || row.kyc_status || '').toUpperCase()
  if (row.verified === true || row.is_verified === true || row.verified_at || ['VERIFIED', 'APPROVED'].includes(value)) return 'APPROVED'
  if (['REJECTED', 'DECLINED'].includes(value)) return 'REJECTED'
  if (['PENDING', 'PENDING_REVIEW', 'IN_REVIEW', 'UNDER_REVIEW'].includes(value)) return 'PENDING REVIEW'
  return value || 'UNKNOWN'
}
async function loadKyc(force = false) {
  if (!hasPermission('kyc:read')) return
  if (kycLoading.value || (kycLoaded.value && !force)) return
  const profileId = record.value?.id || record.value?.customer_profile_id || route.params.id
  if (!profileId) { kycError.value = 'Customer profile ID is unavailable.'; return }
  kycLoading.value = true
  kycError.value = ''
  try {
    kycRecord.value = unwrapKyc(await kycService.get(profileId))
    kycLoaded.value = true
  } catch (error) {
    kycError.value = error?.message || 'Unable to load KYC for this customer.'
  } finally { kycLoading.value = false }
}
const kycDocumentUrl = computed(() => kycRecord.value?.file_path || '')
const kycDocumentKind = computed(() => {
  const file = String(kycDocumentUrl.value).split(/[?#]/)[0].toLowerCase()
  const type = String(kycRecord.value?.mime_type || kycRecord.value?.file_type || kycRecord.value?.content_type || '').toLowerCase()
  if (type.includes('pdf') || file.endsWith('.pdf')) return 'pdf'
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/.test(file)) return 'image'
  return 'other'
})
function openDocumentModal() {
  if (kycDocumentUrl.value) documentModalOpen.value = true
}
function closeDocumentModal() {
  documentModalOpen.value = false
}

function openKyc() {
  if (!hasPermission('kyc:read')) return
  activeTab.value = 'kyc'
  loadKyc()
}
async function toggleKycVerification() {
  if (!kycRecord.value || kycLoading.value) return
  const profileId = record.value?.id || record.value?.customer_profile_id || route.params.id
  const wasVerified = ['APPROVED', 'VERIFIED'].includes(kycStatus(kycRecord.value))
  if (wasVerified ? !hasPermission('kyc:unverify') : !hasPermission('kyc:verify')) return
  const confirmed = await confirmAction({
    title: wasVerified ? 'Unverify KYC document?' : 'Verify KYC document?',
    message: wasVerified ? 'Remove verification from this customer KYC document?' : 'Mark this customer KYC document as verified?',
    confirmText: wasVerified ? 'Unverify' : 'Verify',
    confirmVariant: wasVerified ? 'danger' : 'primary',
  })
  if (!confirmed) return
  kycError.value = ''
  try {
    if (wasVerified) await kycService.unverify(profileId)
    else await kycService.verify(profileId)
    kycLoaded.value = false
    await loadKyc(true)
  } catch (error) { kycError.value = error?.message || 'Unable to update KYC verification.' }
}
async function deleteKyc() {
  if (!hasPermission('kyc:delete') || !kycRecord.value || kycLoading.value) return
  const confirmed = await confirmAction({ title: 'Delete KYC document?', message: 'Delete this KYC document? This action cannot be undone.', confirmText: 'Delete', confirmVariant: 'danger' })
  if (!confirmed) return
  kycError.value = ''
  try {
    await kycService.remove(record.value?.id || record.value?.customer_profile_id || route.params.id)
    kycRecord.value = null
    kycLoaded.value = true
  } catch (error) { kycError.value = error?.message || 'Unable to delete KYC document.' }
}

function statusClass(value) {
  const normalized = String(value || '').toLowerCase()
  if (['verified', 'active', 'approved', 'low'].includes(normalized)) return 'is-positive'
  if (['rejected', 'blocked', 'inactive', 'high'].includes(normalized)) return 'is-negative'
  if (['in_review', 'pending', 'pending review', 'pending_review', 'medium'].includes(normalized)) return 'is-pending'
  return 'is-neutral'
}

async function loadRecord() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await customerProfileService.get(route.params.id)
    record.value = response?.data?.data || response?.data || response
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load customer profile.'
  } finally {
    loading.value = false
  }
}

onMounted(loadRecord)
</script>

<template>
  <section class="module-page customer-detail-page">
    <div class="module-page-intro detail-page-heading">
      <div>
        <p class="eyebrow">CUSTOMER MANAGEMENT</p>
        <h2>Customer profile</h2>
        
      </div>
      <div class="detail-actions">
        <BaseButton variant="secondary" @click="router.push('/customers')">← Back to customers</BaseButton>
        <BaseButton v-if="hasPermission('customer-profiles:update')" :disabled="!record || loading" @click="router.push(`/customers/${route.params.id}/edit`)">Edit customer</BaseButton>
      </div>
    </div>

    <p v-if="loading" class="module-description detail-state">Loading customer profile…</p>
    <section v-else-if="errorMessage" class="module-panel detail-state" role="alert">
      <p>{{ errorMessage }}</p>
      <BaseButton variant="secondary" @click="loadRecord">Try again</BaseButton>
    </section>

    <template v-else-if="record">
      <section class="customer-profile-hero">
        <div class="customer-avatar">{{ initials }}</div>
        <div class="customer-hero-copy">
          <h3>{{ fullName }}</h3>
          <div class="customer-contact-line">
            <span v-if="record.email">{{ record.email }}</span>
            <span v-if="record.email && record.phone" class="contact-separator">·</span>
            <span v-if="record.phone">{{ record.phone }}</span>
          </div>
          <div class="customer-badges">
            <span class="detail-badge" :class="statusClass(profileKycStatus)">KYC {{ profileKycStatus }}</span>
            <span class="detail-badge" :class="statusClass(record.risk_level)">Risk {{ display(record.risk_level) }}</span>
          </div>
        </div>
      </section>

      <nav class="customer-detail-tabs" aria-label="Customer detail sections" role="tablist">
        <button type="button" role="tab" :aria-selected="activeTab === 'overview'" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">Overview</button>
        <button type="button" role="tab" :aria-selected="activeTab === 'address'" :class="{ active: activeTab === 'address' }" @click="activeTab = 'address'">Address</button>
        <button type="button" role="tab" :aria-selected="activeTab === 'compliance'" :class="{ active: activeTab === 'compliance' }" @click="activeTab = 'compliance'">Compliance</button>
        <button v-if="hasPermission('kyc:read')" type="button" role="tab" :aria-selected="activeTab === 'kyc'" :class="{ active: activeTab === 'kyc' }" @click="openKyc">KYC</button>
      </nav>

      <div v-if="activeTab === 'overview'" class="customer-detail-sections">
        <section class="module-panel customer-detail-card">
          <div class="customer-section-heading">
            <span class="customer-section-icon">01</span>
            <div><h3>Identity information</h3></div>
          </div>
          <dl class="customer-detail-grid">
            <div><dt>First name</dt><dd>{{ display(record.first_name) }}</dd></div>
            <div><dt>Middle name</dt><dd>{{ display(record.middle_name) }}</dd></div>
            <div><dt>Last name</dt><dd>{{ display(record.last_name) }}</dd></div>
            <div><dt>Nationality</dt><dd>{{ display(record.nationality) }}</dd></div>
            <div><dt>Identity type</dt><dd>{{ display(record.idTypeRef?.display_label || record.id_type) }}</dd></div>
            <div><dt>Identity number</dt><dd>{{ display(record.id_number) }}</dd></div>
          </dl>
        </section>

        <section class="module-panel customer-detail-card">
          <div class="customer-section-heading">
            <span class="customer-section-icon">02</span>
            <div><h3>Contact information</h3></div>
          </div>
          <dl class="customer-detail-grid">
            <div><dt>Email address</dt><dd>{{ display(record.email) }}</dd></div>
            <div><dt>Phone number</dt><dd>{{ display(record.phone) }}</dd></div>
          </dl>
        </section>

      </div>

      <div v-else-if="activeTab === 'address'" class="customer-detail-sections address-tab">
        <section class="module-panel customer-detail-card">
          <div class="customer-section-heading">
            <span class="customer-section-icon">03</span>
            <div><h3>Address</h3></div>
          </div>
          <dl class="customer-detail-grid">
            <div class="detail-span-two"><dt>Street address</dt><dd>{{ [record.address_line1, record.address_line2].filter(Boolean).join(', ') || '—' }}</dd></div>
            <div><dt>City</dt><dd>{{ display(record.city) }}</dd></div>
            <div><dt>State / province</dt><dd>{{ display(record.state_province) }}</dd></div>
            <div><dt>Postal code</dt><dd>{{ display(record.postal_code) }}</dd></div>
            <div><dt>Country</dt><dd>{{ display(record.country) }}</dd></div>
          </dl>
        </section>

      </div>

      <div v-else-if="activeTab === 'compliance'" class="customer-detail-sections compliance-tab">
        <section class="module-panel customer-detail-card">
          <div class="customer-section-heading">
            <span class="customer-section-icon">04</span>
            <div><h3>Branch and compliance</h3></div>
          </div>
          <dl class="customer-detail-grid">
            <div><dt>Assigned branch</dt><dd>{{ display(record.branch?.branch_name || record.branch?.branch_code || record.branch_id) }}</dd></div>
            <div><dt>Branch code</dt><dd>{{ display(record.branch?.branch_code) }}</dd></div>
            <div><dt>Branch location</dt><dd>{{ display(record.branch?.address) }}</dd></div>
            <div><dt>KYC status</dt><dd><span class="detail-badge" :class="statusClass(profileKycStatus)">{{ profileKycStatus }}</span></dd></div>
            <div><dt>Risk level</dt><dd><span class="detail-badge" :class="statusClass(record.risk_level)">{{ display(record.risk_level) }}</span></dd></div>
            <div><dt>Created by</dt><dd>{{ [record.maker?.first_name, record.maker?.last_name].filter(Boolean).join(' ') || display(record.maker_id) }}</dd></div>
            <div><dt>Maker email</dt><dd>{{ display(record.maker?.email) }}</dd></div>
          </dl>
        </section>
      </div>

      <section v-if="activeTab === 'kyc'" class="module-panel customer-detail-card kyc-panel">
        <div class="customer-section-heading">
          <span class="customer-section-icon">KYC</span><div><h3>KYC record</h3></div>
          <button v-if="kycError" type="button" class="kyc-refresh" @click="loadKyc(true)">Retry</button>
        </div>
        <p v-if="kycLoading" class="kyc-message">Loading KYC…</p>
        <p v-else-if="kycError" class="kyc-message kyc-error" role="alert">{{ kycError }}</p>
        <div v-else-if="kycRecord" class="customer-detail-grid kyc-fields">
          <div><dt>Status</dt><dd><span class="detail-badge" :class="statusClass(kycStatus(kycRecord))">{{ kycStatus(kycRecord) }}</span></dd></div>
          <div><dt>Document type</dt><dd>{{ display(kycRecord.documentTypeRef?.display_label || kycRecord.documentTypeRef?.code || record.idTypeRef?.display_label || record.id_type || kycRecord.id_type || kycRecord.document_type) }}</dd></div>
          <div><dt>Date of birth</dt><dd>{{ formatDate(kycRecord.dob) }}</dd></div>
          <div><dt>Submitted</dt><dd>{{ formatDate(kycRecord.created_at) }}</dd></div>
          <div><dt>Verified</dt><dd>{{ formatDate(kycRecord.verified_at) }}</dd></div>
          <div><dt>Document number</dt><dd>{{ display(kycRecord.id_number) }}</dd></div>
          <div><dt>Expiry date</dt><dd>{{ formatDate(kycRecord.expiry_date) }}</dd></div>
          <div><dt>Uploaded document</dt><dd><button v-if="kycRecord.file_path" type="button" class="kyc-document-link" @click="openDocumentModal">Preview document ↗</button><span v-else>—</span></dd></div>
          <div class="kyc-actions"><BaseButton v-if="hasPermission('kyc:read')" @click="router.push('/kyc/' + encodeURIComponent(record.id || route.params.id))">Open KYC details</BaseButton><BaseButton v-if="hasPermission('kyc:update')" variant="secondary" @click="router.push('/kyc/' + encodeURIComponent(record.id || route.params.id) + '/edit')">Edit</BaseButton><BaseButton v-if="( ['APPROVED', 'VERIFIED'].includes(kycStatus(kycRecord)) && hasPermission('kyc:unverify')) || (!(['APPROVED', 'VERIFIED'].includes(kycStatus(kycRecord))) && hasPermission('kyc:verify'))" variant="secondary" :disabled="kycLoading" @click="toggleKycVerification">{{ ['APPROVED', 'VERIFIED'].includes(kycStatus(kycRecord)) ? 'Unverify' : 'Verify' }}</BaseButton><BaseButton v-if="hasPermission('kyc:delete')" variant="danger" :disabled="kycLoading" @click="deleteKyc">Delete</BaseButton></div>
        </div>
        <div v-else class="kyc-empty"><p>No KYC record found for this customer.</p>
          <BaseButton v-if="hasPermission('kyc:create')" @click="router.push({ path: '/kyc/new', query: { customer_profile_id: record.id || route.params.id } })">Add KYC record</BaseButton>
        </div>
      </section>

      <Teleport to="body">
        <div v-if="documentModalOpen" class="kyc-document-overlay" role="presentation" @click.self="closeDocumentModal">
          <section class="kyc-document-modal" role="dialog" aria-modal="true" aria-labelledby="kyc-document-modal-title">
            <header class="kyc-document-modal-header">
              <div><p class="eyebrow">CUSTOMER KYC</p><h3 id="kyc-document-modal-title">Identity document</h3></div>
              <button type="button" class="kyc-modal-close" aria-label="Close document preview" @click="closeDocumentModal">×</button>
            </header>
            <div class="kyc-document-preview">
              <iframe v-if="kycDocumentKind === 'pdf'" :src="kycDocumentUrl" title="KYC document PDF preview" class="kyc-document-frame" />
              <img v-else-if="kycDocumentKind === 'image'" :src="kycDocumentUrl" alt="Uploaded KYC identity document" class="kyc-document-image" />
              <div v-else class="kyc-document-unavailable"><p>Preview is not available for this file type.</p><a :href="kycDocumentUrl" target="_blank" rel="noopener noreferrer">Open document in a new tab ↗</a></div>
            </div>
            <footer class="kyc-document-modal-footer">
              <span class="detail-badge" :class="statusClass(kycStatus(kycRecord))">{{ kycStatus(kycRecord) }}</span>
              <div class="kyc-document-modal-actions">
                <a :href="kycDocumentUrl" target="_blank" rel="noopener noreferrer" class="kyc-open-new-tab">Open in new tab ↗</a>
                <BaseButton v-if="( ['APPROVED', 'VERIFIED'].includes(kycStatus(kycRecord)) && hasPermission('kyc:unverify')) || (!(['APPROVED', 'VERIFIED'].includes(kycStatus(kycRecord))) && hasPermission('kyc:verify'))" variant="secondary" :disabled="kycLoading" @click="toggleKycVerification">{{ ['APPROVED', 'VERIFIED'].includes(kycStatus(kycRecord)) ? 'Unverify' : 'Verify' }}</BaseButton>
                <BaseButton variant="secondary" @click="closeDocumentModal">Close</BaseButton>
              </div>
            </footer>
            <p v-if="kycError" class="kyc-message kyc-error" role="alert">{{ kycError }}</p>
          </section>
        </div>
      </Teleport>

      <section class="customer-record-footer">
        <div><span>Last updated</span><strong>{{ formatDate(record.updated_at) }}</strong></div>
        <div><span>Record status</span><strong>{{ record.is_deleted ? 'Deleted' : 'Active record' }}</strong></div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.customer-detail-page { gap: 22px; }
.detail-page-heading { align-items: center; gap: 18px; }
.eyebrow { margin: 0 0 6px; color: var(--brand-base-color, #4263c7); font-size: .7rem; font-weight: 750; letter-spacing: .12em; }
.detail-actions { display: flex; gap: 9px; flex-wrap: wrap; }
.detail-state { padding: 22px; }
.customer-profile-hero {
  display: flex; align-items: center; gap: 18px;
  padding: 24px 28px; border: 1px solid #dfe7f5; border-radius: 18px;
  background: linear-gradient(115deg, #f2f6ff 0%, #f8faff 54%, #f1f8f7 100%);
  box-shadow: 0 8px 24px rgba(35, 57, 99, .045);
}
.customer-avatar {
  display: flex; align-items: center; justify-content: center; flex: 0 0 54px;
  width: 54px; height: 54px; border-radius: 17px;
  background: #dfe8ff; color: #3154a3; font-size: 1.05rem; font-weight: 750;
}
.customer-hero-copy { min-width: 0; flex: 1; }
.customer-hero-copy h3 { margin: 0; color: #202d43; font-size: clamp(1.3rem, 2vw, 1.65rem); letter-spacing: -.025em; }
.customer-contact-line { display: flex; gap: 8px; flex-wrap: wrap; margin: 7px 0 13px; color: #647187; font-size: .9rem; overflow-wrap: anywhere; }
.contact-separator { color: #a0aabb; }
.customer-badges { display: flex; gap: 8px; flex-wrap: wrap; }
.detail-badge {
  display: inline-flex; align-items: center; width: fit-content; padding: 5px 10px;
  border-radius: 999px; font-size: .76rem; font-weight: 700; letter-spacing: .01em;
  background: #edf0f5; color: #4f5b6e; white-space: nowrap;
}
.detail-badge.is-positive { background: #e6f6ed; color: #23764b; }
.detail-badge.is-negative { background: #fff0f0; color: #a63e43; }
.detail-badge.is-pending { background: #fff4dc; color: #8c6217; }
.customer-detail-tabs { display: flex; align-items: center; gap: 0; width: 100%; max-width: 100%; border-bottom: 1px solid var(--border-color, #d9dde5); overflow-x: auto; }
.customer-detail-tabs button { position: relative; flex: 0 0 auto; padding: 12px 17px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: var(--text-muted-color, #667085); font: inherit; font-size: .84rem; font-weight: 700; cursor: pointer; transition: color .18s ease, border-color .18s ease; }
.customer-detail-tabs button.active { border-bottom-color: var(--brand-base-color, #435fb0); color: var(--brand-base-color, #435fb0); background: transparent; box-shadow: none; }
.customer-detail-tabs button:focus-visible { outline: 2px solid #6b8be7; outline-offset: 2px; }
.customer-detail-tabs button:hover { color: var(--brand-base-color, #435fb0); }
.customer-detail-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.address-tab, .compliance-tab { grid-template-columns: minmax(0, 1fr); }
.address-tab .customer-detail-card, .compliance-tab .customer-detail-card { width: 100%; }
.customer-detail-card { padding: 22px; min-width: 0; }
.kyc-panel { display: grid; gap: 18px; }
.kyc-panel .customer-section-heading { align-items: center; }
.kyc-refresh { margin-left: auto; border: 0; background: transparent; color: var(--brand-base-color, #4263c7); font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; }
.kyc-message { margin: 0; color: #657188; font-size: .9rem; }
.kyc-error { color: #a63e43; }
.kyc-fields { padding-top: 0; }
.kyc-actions { grid-column: 1 / -1; padding-top: 4px; display:flex; gap:8px; flex-wrap:wrap; }.kyc-document-link { padding:0;border:0;background:transparent;color:var(--brand-base-color,#4263c7);font:inherit;font-weight:700;text-decoration:none;cursor:pointer; }
.kyc-document-overlay { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(15,23,42,.68); backdrop-filter:blur(3px); }
.kyc-document-modal { display:flex; flex-direction:column; width:min(1080px,100%); max-height:min(92vh,1000px); overflow:hidden; border:1px solid #e1e7f0; border-radius:18px; background:#fff; box-shadow:0 24px 80px rgba(0,0,0,.28); }
.kyc-document-modal-header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 22px; border-bottom:1px solid #e8ecf2; }
.kyc-document-modal-header .eyebrow { margin-bottom:4px; }
.kyc-document-modal-header h3 { margin:0;color:#202d43;font-size:1.1rem; }
.kyc-modal-close { display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:0;border-radius:10px;background:#f1f4f8;color:#334155;font-size:1.6rem;cursor:pointer; }
.kyc-document-preview { display:flex;align-items:center;justify-content:center;min-height:260px;flex:1;overflow:auto;padding:16px;background:#f3f5f9; }
.kyc-document-frame { display:block;width:100%;height:min(68vh,760px);border:0;border-radius:8px;background:#fff; }
.kyc-document-image { display:block;max-width:100%;max-height:68vh;object-fit:contain;border-radius:6px;box-shadow:0 4px 18px rgba(20,30,50,.12); }
.kyc-document-unavailable { text-align:center;color:#647187; }
.kyc-document-unavailable a,.kyc-open-new-tab { color:var(--brand-base-color,#4263c7);font-size:.85rem;font-weight:700;text-decoration:none; }
.kyc-document-modal-footer { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 22px;border-top:1px solid #e8ecf2; }
.kyc-document-modal-actions { display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap; }
.kyc-document-modal > .kyc-message { padding:0 22px 14px; }
@media (max-width:600px) { .kyc-document-overlay { padding:10px; }.kyc-document-modal { max-height:96vh;border-radius:14px; }.kyc-document-modal-header,.kyc-document-modal-footer { padding:14px; }.kyc-document-preview { padding:8px; }.kyc-document-frame { height:65vh; }.kyc-document-modal-footer { align-items:flex-start;flex-direction:column; }.kyc-document-modal-actions { width:100%;justify-content:flex-start; } }
.kyc-empty { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.kyc-empty p { margin: 0; color: #657188; font-size: .9rem; }
.customer-section-heading { display: flex; align-items: center; gap: 12px; padding-bottom: 18px; border-bottom: 1px solid #edf0f5; }
.customer-section-icon {
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 38px;
  width: 38px; height: 38px; border-radius: 12px; background: #f0f4fc; color: #4662a6;
  font-size: .75rem; font-weight: 800;
}
.customer-section-heading h3 { margin: 0; font-size: 1rem; color: var(--text-primary, #273449); }
.customer-section-heading p { margin: 4px 0 0; font-size: .8rem; color: #7b8494; }
.customer-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 18px; margin: 0; padding-top: 20px; }
.customer-detail-grid > div { min-width: 0; }
.customer-detail-grid dt { margin-bottom: 6px; color: #7b8494; font-size: .76rem; font-weight: 550; }
.customer-detail-grid dd { margin: 0; color: #273449; font-size: .9rem; font-weight: 600; overflow-wrap: anywhere; }
.detail-span-two { grid-column: 1 / -1; }
.customer-record-footer {
  display: flex; gap: 24px; flex-wrap: wrap; padding: 17px 22px;
  border: 1px solid #e8ecf2; border-radius: 14px; background: #fbfcfe;
}
.customer-record-footer div { display: flex; flex-direction: column; gap: 5px; }
.customer-record-footer span { color: #7b8494; font-size: .75rem; }
.customer-record-footer strong { color: #3d4a5f; font-size: .82rem; font-weight: 600; }
@media (max-width: 760px) {
  .customer-detail-sections { grid-template-columns: 1fr; }
  .customer-detail-tabs { width: 100%; }
  .customer-detail-tabs button { padding: 11px 12px; }
  .customer-profile-hero { padding: 20px; gap: 15px; }
}
@media (max-width: 520px) {
  .detail-page-heading { align-items: flex-start; flex-direction: column; }
  .customer-detail-card { padding: 17px; }
  .customer-detail-grid { gap: 17px 12px; }
}
</style>

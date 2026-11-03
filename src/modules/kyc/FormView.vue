<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import SearchableSelect from '../../components/ui/SearchableSelect.vue'
import { kycService } from '../../services/kycService'
import { apiRequest } from '../../services/apiClient'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => Boolean(route.params.id))
const loading = ref(false)
const saving = ref(false)
const loadingOptions = ref(false)
const errorMessage = ref('')
const customers = ref([])
const documentTypes = ref([])
const selectedFile = ref(null)
let customerRequestId = 0
let lastCustomerQuery = ''
const form = reactive({
  customer_profile_id: '',
  document_type: '',
  id_number: '',
  expiry_date: '',
})
const customerOptions = computed(() => customers.value.map(customer => ({
  value: String(customer.id || customer.customer_profile_id || ''),
  label: customerLabel(customer),
})).filter(option => option.value))
const documentTypeOptions = computed(() => documentTypes.value.map(item => ({
  value: String(item.id || item.uuid || item.document_type_id || ''),
  label: item.display_label || item.name || item.label || item.document_type_name || item.code || String(item.id || item.uuid || ''),
})).filter(option => option.value))
function customerLabel(customer) {
  const name = customer.full_name || customer.customer_name || customer.name || [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(' ') || 'Customer'
  const phone = customer.phone_number || customer.phone
  return phone ? `${name} · ${phone}` : name
}
function normalize(response) {
  let value = response?.data ?? response
  if (value?.data && !Array.isArray(value.data) && typeof value.data === 'object') value = value.data
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.records)) return value.records
  return []
}

async function fetchCustomers(query = '') {
  const term = String(query || '').trim()
  if (term === lastCustomerQuery && customers.value.length) return
  lastCustomerQuery = term
  const requestId = ++customerRequestId
  try {
    const params = new URLSearchParams({ page: '1', page_size: '100' })
    if (term) params.set('search', term)
    const response = await apiRequest('customer-profiles?' + params.toString())
    if (requestId !== customerRequestId) return
    customers.value = normalize(response)
  } catch (error) {
    if (requestId === customerRequestId) errorMessage.value = error?.message || 'Unable to search customer profiles.'
  }
}

function validateFile(file) {
  if (!file) return true
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'Document file must be 5 MB or smaller.'
    return false
  }
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
    errorMessage.value = 'Document must be a JPG, PNG, or PDF file.'
    return false
  }
  return true
}
async function loadOptions() {
  loadingOptions.value = true
  errorMessage.value = ''
  try {
    const typeResponse = await apiRequest('reference-id-types?page=1&page_size=100')
    documentTypes.value = normalize(typeResponse)
    if (!documentTypes.value.length) {
      errorMessage.value = 'No ID document types were returned by reference-id-types.'
    }
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load customer profiles, document types, or current user.'
  } finally {
    loadingOptions.value = false
  }
}
async function loadRecord() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const response = await kycService.get(route.params.id)
    let row = response?.data ?? response
    if (row?.data && !Array.isArray(row.data)) row = row.data
    row = row?.item ?? row
    const existingCustomer = row.customer_profile || row.customerProfile || row.customer || null
    if (existingCustomer) customers.value = [existingCustomer, ...customers.value.filter(item => String(item.id || item.customer_profile_id) !== String(existingCustomer.id || existingCustomer.customer_profile_id))]
    Object.assign(form, {
      customer_profile_id: String(row.customer_profile_id || row.customerProfileId || row.customer_profile?.id || row.customerProfile?.id || ''),
      document_type: String(row.documentTypeRef?.id || row.document_type || row.document_type_id || row.documentType?.id || row.document_type_reference?.id || ''),
      id_number: row.id_number || '',
      expiry_date: row.expiry_date ? String(row.expiry_date).slice(0, 10) : '',
    })
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load KYC document.'
  } finally {
    loading.value = false
  }
}
async function save() {
  errorMessage.value = ''
  if (!form.customer_profile_id) { errorMessage.value = 'Select a customer profile.'; return }
  if (!form.document_type) { errorMessage.value = 'Select a document type.'; return }
  if (!isEdit.value) {
    // New uploads must be attributed to the signed-in user.
    const uploaderId = Number(localStorage.getItem('userId') || '')
    if (!Number.isInteger(uploaderId) || uploaderId <= 0) { errorMessage.value = 'Unable to determine the current user ID. Please sign in again.'; return }
  }
  if (selectedFile.value && !validateFile(selectedFile.value)) return
  saving.value = true
  try {
    const payload = {
      customer_profile_id: form.customer_profile_id,
      document_type: form.document_type,
    }
    if (form.id_number.trim()) payload.id_number = form.id_number.trim()
    if (form.expiry_date) payload.expiry_date = form.expiry_date
    if (selectedFile.value) payload.document = selectedFile.value
    if (isEdit.value) await kycService.update(form.customer_profile_id || route.params.id, payload)
    else {
      payload.uploaded_by = Number(localStorage.getItem('userId') || '')
      if (!selectedFile.value) { errorMessage.value = 'Please select the document file.'; return }
      await kycService.create(payload)
    }
    router.push('/kyc')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to save KYC document.'
  } finally {
    saving.value = false
  }
}
onMounted(async () => {
  await loadOptions()
  await loadRecord()
})
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>{{ isEdit ? 'Edit KYC Document' : 'Add KYC Document' }}</h2><p class="module-description">{{ isEdit ? 'Update document details or optionally replace the uploaded file.' : 'Attach an identity document to a customer profile.' }} JPG, PNG, or PDF files up to 5 MB are accepted.</p></div>
      <BaseButton variant="secondary" @click="router.push('/kyc')">← Back to KYC</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Customer document information</h3></div>
      <p v-if="loadingOptions || loading" class="module-description" style="padding:16px 24px">Loading document form…</p>
      <form v-else @submit.prevent="save">
        <div class="module-form-grid">
          <label class="module-form-field"><span>Customer profile *</span><SearchableSelect v-model="form.customer_profile_id" :options="customerOptions" placeholder="Search customer profiles…" aria-label="Customer profile" required @focus="fetchCustomers()" @search="fetchCustomers" /></label>
          <label class="module-form-field"><span>Document type *</span><select v-model="form.document_type" class="ui-input" aria-label="Document type" required><option value="" disabled>Select reference document type…</option><option v-for="option in documentTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
          <label class="module-form-field"><span>ID number (optional)</span><input v-model="form.id_number" class="ui-input" type="text" autocomplete="off" placeholder="ID number printed on document" /></label>
          <label class="module-form-field"><span>Expiry date (optional)</span><input v-model="form.expiry_date" class="ui-input" type="date" /></label>
          <label class="module-form-field"><span>Document file {{ isEdit ? '(optional)' : '*' }}</span><input class="ui-input" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" :required="!isEdit" @change="selectedFile = $event.target.files?.[0] || null" /><small>JPG, PNG, or PDF. Maximum 5 MB. {{ isEdit ? 'Leave empty to keep the current file.' : 'Choose the document to upload.' }}</small></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer"><span>Document uploads are sent as multipart form data.</span><div><BaseButton type="button" variant="secondary" @click="router.push('/kyc')">Cancel</BaseButton><BaseButton type="submit" :disabled="saving || loading || loadingOptions">{{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add document' }}</BaseButton></div></div>
      </form>
    </section>
  </section>
</template>

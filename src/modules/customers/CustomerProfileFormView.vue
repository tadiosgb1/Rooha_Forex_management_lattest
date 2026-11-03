<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { customerProfileService } from '../../services/customerProfileService'
import { listBranches } from '../../services/branchService'
import { referenceIdTypeService } from '../../services/referenceIdTypeService'
import { kycService } from '../../services/kycService'
import { useToast } from '../../composables/toast'
import { countryOptions, nationalityOptions } from '../../services/countryService'
import { hasPermission } from '../../utils/permissions'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const isEdit = computed(() => Boolean(route.params.id))
const loading = ref(false)
const loadingOptions = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const branchOptions = ref([])
const identityTypeOptions = ref([])
const currentStep = ref(0)
const createdCustomerId = ref('')
const kycSaving = ref(false)
const kycErrorMessage = ref('')
const kycSelectedFile = ref(null)
const kycForm = reactive({ document_type: '', id_number: '', expiry_date: '' })

const steps = [
  { title: 'Identity', description: 'Customer identity and branch details' },
  { title: 'Contact', description: 'Phone and email details' },
  { title: 'Address', description: 'Residential or business address' },
  { title: 'Review', description: 'Review customer details and risk classification' },
  { title: 'KYC', description: 'Optionally attach an identity document' },
]
const visibleSteps = computed(() => isEdit.value || !hasPermission('kyc:create') ? steps.slice(0, 4) : steps)

const form = reactive({
  branch_id: '',
  id_type: '',
  id_number: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  nationality: '',
  phone: '',
  email: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state_province: '',
  postal_code: '',
  country: '',
  kyc_status: 'PENDING',
  risk_level: 'LOW',
})

const fields = [
  { key: 'id_number', label: 'Identity number', required: true, step: 0 },
  { key: 'first_name', label: 'First name', required: true, step: 0 },
  { key: 'middle_name', label: 'Middle name', step: 0 },
  { key: 'last_name', label: 'Last name', required: true, step: 0 },
  { key: 'nationality', label: 'Nationality', required: true, step: 0 },
  { key: 'phone', label: 'Phone', required: true, type: 'tel', step: 1 },
  { key: 'email', label: 'Email', required: true, type: 'email', step: 1 },
  { key: 'address_line1', label: 'Address line 1', required: true, step: 2 },
  { key: 'address_line2', label: 'Address line 2', step: 2 },
  { key: 'city', label: 'City', required: true, step: 2 },
  { key: 'state_province', label: 'State / province', step: 2 },
  { key: 'postal_code', label: 'Postal code', step: 2 },
  { key: 'country', label: 'Country', required: true, step: 2 },
]
const currentFields = computed(() => fields.filter(field => field.step === currentStep.value))
const statusOptions = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
]
const riskOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]
const kycDocumentTypeOptions = computed(() => identityTypeOptions.value.map(type => ({
  value: String(type.id || type.uuid || type.document_type_id || ''),
  label: type.display_label || type.name || type.label || type.document_type_name || type.code || String(type.id || type.uuid || ''),
})).filter(option => option.value))

function unwrap(value) {
  let result = value
  for (let i = 0; i < 3 && result && !Array.isArray(result); i += 1) {
    if (Array.isArray(result.data)) return result.data
    if (result.data && typeof result.data === 'object') result = result.data
    else break
  }
  return Array.isArray(result) ? result : []
}

function normalizeRecord(value) {
  let row = value
  for (let i = 0; i < 3 && row?.data && !Array.isArray(row.data); i += 1) row = row.data
  return row
}

async function loadOptions() {
  loadingOptions.value = true
  errorMessage.value = ''
  try {
    const [branchesResult, typesResult] = await Promise.allSettled([
      listBranches({ page: 1, pageSize: 100, search: '', sortBy: 'created_at', isActive: true }),
      referenceIdTypeService.list({ is_active: true }),
    ])
    branchOptions.value = branchesResult.status === 'fulfilled'
      ? unwrap(branchesResult.value).filter(branch => branch.is_active !== false)
      : []
    identityTypeOptions.value = typesResult.status === 'fulfilled'
      ? unwrap(typesResult.value).filter(type => type.is_active !== false)
      : []
    const unavailable = []
    if (branchesResult.status === 'rejected') unavailable.push('branches')
    if (typesResult.status === 'rejected') unavailable.push('identity types')
    if (!identityTypeOptions.value.length && !unavailable.includes('identity types')) unavailable.push('active identity types')
    if (unavailable.length) {
      errorMessage.value = `Some customer form options are unavailable (${unavailable.join(', ')}). Check permissions or contact an administrator.`
    }
  } finally {
    loadingOptions.value = false
  }
}

async function loadRecord() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const row = normalizeRecord(await customerProfileService.get(route.params.id))
    for (const key of Object.keys(form)) {
      if (row?.[key] !== undefined && row[key] !== null) form[key] = row[key]
    }
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load customer profile.'
  } finally {
    loading.value = false
  }
}

function validateStep(step) {
  const stepFields = fields.filter(field => field.step === step)
  for (const field of stepFields) {
    if (field.required && !String(form[field.key] ?? '').trim()) {
      errorMessage.value = `${field.label} is required.`
      return false
    }
  }
  if (step === 0 && !form.branch_id) {
    errorMessage.value = 'Please select a branch.'
    return false
  }
  if (step === 0 && !form.id_type) {
    errorMessage.value = 'Please select an identity type.'
    return false
  }
  if (step === 1 && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errorMessage.value = 'Enter a valid email address.'
    return false
  }
  errorMessage.value = ''
  return true
}

function nextStep() {
  if (!validateStep(currentStep.value)) return
  currentStep.value = Math.min(currentStep.value + 1, steps.length - 1)
}

function previousStep() {
  errorMessage.value = ''
  currentStep.value = Math.max(currentStep.value - 1, 0)
}

async function saveKycForCreatedCustomer() {
  if (!hasPermission('kyc:create')) {
    kycErrorMessage.value = 'You do not have permission to create KYC records.'
    return false
  }
  kycErrorMessage.value = ''
  if (!createdCustomerId.value) return false
  if (!kycForm.document_type || !kycSelectedFile.value) {
    kycErrorMessage.value = 'Select a document type and file to upload, or skip KYC.'
    return false
  }
  if (!validateKycFile(kycSelectedFile.value)) return false
  const uploaderId = Number(localStorage.getItem('userId') || '')
  if (!Number.isInteger(uploaderId) || uploaderId <= 0) {
    kycErrorMessage.value = 'Unable to determine the current user ID. Please sign in again.'
    return false
  }
  kycSaving.value = true
  try {
    const payload = {
      customer_profile_id: createdCustomerId.value,
      document_type: kycForm.document_type,
      uploaded_by: uploaderId,
      id_number: kycForm.id_number.trim() || form.id_number.trim(),
      document: kycSelectedFile.value,
    }
    if (kycForm.expiry_date) payload.expiry_date = kycForm.expiry_date
    await kycService.create(payload)
    toast.success('Customer and KYC document created successfully.')
    router.push('/customers')
    return true
  } catch (error) {
    kycErrorMessage.value = error?.message || 'Customer was created, but the KYC document could not be uploaded. Retry the upload or skip KYC.'
    return false
  } finally {
    kycSaving.value = false
  }
}

function validateKycFile(file) {
  if (!file) {
    kycErrorMessage.value = 'Select a KYC document file, or leave both KYC fields empty to skip.'
    return false
  }
  if (file.size > 5 * 1024 * 1024) {
    kycErrorMessage.value = 'Document file must be 5 MB or smaller.'
    return false
  }
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
    kycErrorMessage.value = 'Document must be a JPG, PNG, or PDF file.'
    return false
  }
  return true
}

async function skipKyc() {
  // Before customer creation, skipping KYC should still save the customer profile.
  if (!isEdit.value && !createdCustomerId.value) {
    kycForm.document_type = ''
    kycForm.expiry_date = ''
    kycSelectedFile.value = null
    await save()
    return
  }
  toast.info('Customer created successfully. KYC was skipped.')
  router.push('/customers')
}

async function save() {
  if (isEdit.value) {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) return
  } else if (currentStep.value < visibleSteps.value.length - 1) {
    return
  } else {
    const hasType = Boolean(kycForm.document_type)
    const hasFile = Boolean(kycSelectedFile.value)
    if (hasType !== hasFile) {
      kycErrorMessage.value = 'To upload KYC, select both a document type and a file. Leave both empty to skip.'
      return
    }
    if (hasFile && !validateKycFile(kycSelectedFile.value)) return
    if (createdCustomerId.value) {
      if (hasFile) await saveKycForCreatedCustomer()
      else skipKyc()
      return
    }
  }

  errorMessage.value = ''
  const makerId = localStorage.getItem('userId')
  if (!isEdit.value && !makerId) {
    errorMessage.value = 'Your user ID was not found in local storage. Please sign in again.'
    currentStep.value = 3
    return
  }

  const payload = { ...form }
  if (!hasPermission('customer-profiles:kyc-status')) delete payload.kyc_status
  if (!hasPermission('customer-profiles:risk-level')) delete payload.risk_level
  if (isEdit.value) {
    delete payload.branch_id
    delete payload.id_type
    delete payload.id_number
    delete payload.maker_id
  } else {
    payload.maker_id = makerId
  }
  for (const key of ['middle_name', 'address_line2', 'state_province', 'postal_code']) {
    payload[key] = String(payload[key] ?? '').trim()
  }

  saving.value = true
  try {
    if (isEdit.value) {
      await customerProfileService.update(route.params.id, payload)
      toast.success('Customer updated successfully.')
      router.push('/customers')
    } else {
      // Create the customer profile first. KYC requires the ID returned by this successful request.
      const response = await customerProfileService.create(payload)
      const record = normalizeRecord(response)
      const id = record?.id || record?.customer_profile_id || record?.customerProfileId
      if (!id) {
        errorMessage.value = 'Customer profile request succeeded, but its response did not include the customer ID required for KYC. Check the customer register before retrying; do not submit the profile again.'
        return
      }

      // Save the returned ID immediately so a failed KYC upload can be retried
      // without creating the customer profile a second time.
      createdCustomerId.value = String(id)

      if (kycSelectedFile.value && kycForm.document_type) {
        await saveKycForCreatedCustomer()
      } else {
        toast.success('Customer created successfully. KYC was skipped.')
        router.push('/customers')
      }
    }
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to save customer profile.'
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
      <div>
        <h2>{{ isEdit ? 'Edit customer' : 'Add customer' }}</h2>
        <p class="module-description">{{ isEdit ? 'Update the customer profile details.' : 'Complete the customer profile and optionally add KYC in the final step.' }}</p>
      </div>
      <BaseButton variant="secondary" @click="router.push('/customers')">← Back to customers</BaseButton>
    </div>

    <section class="module-panel module-form-panel">
      <div class="module-panel-header">
        <div>
          <h3>{{ steps[currentStep].title }}</h3>
          <p class="module-description">{{ createdCustomerId ? `Customer ID: ${createdCustomerId}. Retry the KYC upload or skip it.` : steps[currentStep].description }}</p>
        </div>
        <span class="module-description">Step {{ currentStep + 1 }} of {{ visibleSteps.length }}</span>
      </div>

      <div class="customer-stepper" :class="{ 'customer-stepper--edit': isEdit }" aria-label="Customer form progress">
        <div v-for="(step, index) in visibleSteps" :key="step.title" class="customer-stepper-item" :class="{ 'is-current': index === currentStep, 'is-complete': index < currentStep }">
          <span class="customer-stepper-number">{{ index < currentStep ? '✓' : index + 1 }}</span>
          <span>{{ step.title }}</span>
        </div>
      </div>

      <p v-if="loading || loadingOptions" class="module-description" style="padding:16px 24px">
        {{ loadingOptions ? 'Loading branches and identity types…' : 'Loading customer profile…' }}
      </p>

      <form v-else @submit.prevent="currentStep < visibleSteps.length - 1 ? nextStep() : save()">
        <div v-if="!isEdit && currentStep === 4" class="module-form-grid">
          <label class="module-form-field">
            <span>KYC document type (optional)</span>
            <select v-model="kycForm.document_type" :required="Boolean(kycSelectedFile) || Boolean(kycForm.document_type)">
              <option value="" disabled>Select document type</option>
              <option v-for="option in kycDocumentTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <small v-if="!kycDocumentTypeOptions.length">No active document types are available.</small>
          </label>
          <label class="module-form-field">
            <span>ID number</span>
            <input v-model="kycForm.id_number" type="text" autocomplete="off" placeholder="ID number printed on document" />
          </label>
          <label class="module-form-field">
            <span>Expiry date (optional)</span>
            <input v-model="kycForm.expiry_date" type="date" />
          </label>
          <label class="module-form-field">
            <span>Document file (optional)</span>
            <input class="ui-input" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" :required="Boolean(kycSelectedFile) || Boolean(kycForm.document_type)" @change="kycSelectedFile = $event.target.files?.[0] || null" />
            <small>JPG, PNG, or PDF. Maximum 5 MB.</small>
          </label>
        </div>
        <div v-else class="module-form-grid">
          <template v-if="currentStep === 0">
            <label class="module-form-field">
              <span>Branch *</span>
              <select v-model="form.branch_id" :disabled="isEdit" required>
                <option value="" disabled>Select a branch</option>
                <option v-for="branch in branchOptions" :key="branch.id" :value="branch.id">
                  {{ branch.branch_name || branch.name || branch.branch_code || branch.id }}{{ branch.branch_code && branch.branch_name ? ` (${branch.branch_code})` : '' }}
                </option>
              </select>
              <small v-if="!branchOptions.length">No active branches are available.</small>
            </label>
            <label class="module-form-field">
              <span>Identity type *</span>
              <select v-model="form.id_type" :disabled="isEdit" required>
                <option value="" disabled>Select an identity type</option>
                <option v-for="type in identityTypeOptions" :key="type.code" :value="type.code">
                  {{ type.display_label || type.label || type.code }}
                </option>
              </select>
              <small v-if="!identityTypeOptions.length">No active identity types are available.</small>
            </label>
          </template>

          <template v-for="field in currentFields" :key="field.key">
            <label v-if="field.key === 'nationality'" class="module-form-field">
              <span>{{ field.label }} *</span>
              <input v-model="form.nationality" list="customer-nationality-options" autocomplete="off" placeholder="Search nationality…" required />
              <datalist id="customer-nationality-options">
                <option v-for="nationality in nationalityOptions" :key="nationality.value" :value="nationality.value" />
              </datalist>
            </label>
            <label v-else-if="field.key === 'country'" class="module-form-field">
              <span>{{ field.label }} *</span>
              <input v-model="form.country" list="customer-country-options" autocomplete="country-name" placeholder="Search country…" required />
              <datalist id="customer-country-options">
                <option v-for="country in countryOptions" :key="country.code" :value="country.name" />
              </datalist>
            </label>
            <label v-else class="module-form-field">
              <span>{{ field.label }}{{ field.required ? ' *' : '' }}</span>
              <input v-model="form[field.key]" :type="field.type || 'text'" :required="field.required" :placeholder="field.label" :disabled="isEdit && field.key === 'id_number'" />
            </label>
          </template>

          <template v-if="currentStep === 3">
            <label v-if="hasPermission('customer-profiles:kyc-status')" class="module-form-field">
              <span>KYC status *</span>
              <select v-model="form.kyc_status" required>
                <option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <label v-if="hasPermission('customer-profiles:risk-level')" class="module-form-field">
              <span>Risk level *</span>
              <select v-model="form.risk_level" required>
                <option v-for="option in riskOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <div class="customer-review-summary">
              <h4>Review customer details</h4>
              <p><strong>Name:</strong> {{ [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ') || '—' }}</p>
              <p><strong>Identity:</strong> {{ form.id_type || '—' }} · {{ form.id_number || '—' }}</p>
              <p><strong>Nationality:</strong> {{ form.nationality || '—' }}</p>
              <p><strong>Contact:</strong> {{ form.email || '—' }} · {{ form.phone || '—' }}</p>
              <p><strong>Address:</strong> {{ [form.address_line1, form.address_line2, form.city, form.state_province, form.postal_code, form.country].filter(Boolean).join(', ') || '—' }}</p>
            </div>
          </template>
        </div>

        <p v-if="kycErrorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ kycErrorMessage }}</p>
        <p v-else-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer customer-form-navigation">
          <span>{{ !isEdit && currentStep === 4 ? 'KYC is optional. Leave both fields empty to skip, or choose a type and file to upload.' : 'Required fields are marked with *.' }}</span>
          <div>
            <template v-if="!isEdit && currentStep === 4">
              <BaseButton v-if="hasPermission('kyc:create')" type="button" variant="secondary" :disabled="saving || kycSaving" @click="skipKyc">Skip KYC</BaseButton>
              <BaseButton type="submit" :disabled="saving || kycSaving">{{ kycSaving ? 'Uploading KYC…' : createdCustomerId ? 'Retry KYC upload' : 'Create customer' }}</BaseButton>
            </template>
            <template v-else>
              <BaseButton type="button" variant="secondary" @click="router.push('/customers')">Cancel</BaseButton>
              <BaseButton v-if="currentStep > 0" type="button" variant="secondary" @click="previousStep">Previous</BaseButton>
              <BaseButton v-if="currentStep < visibleSteps.length - 1" type="submit" :disabled="saving || loading || loadingOptions || !branchOptions.length || !identityTypeOptions.length">Next</BaseButton>
              <BaseButton v-else type="submit" :disabled="saving || loading || loadingOptions || !branchOptions.length || !identityTypeOptions.length">
                {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create customer' }}
              </BaseButton>
            </template>
          </div>
        </div>
      </form>
    </section>
  </section>
</template>

<style scoped>
.customer-stepper {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 18px 24px 22px;
}
.customer-stepper--edit {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.customer-stepper-item {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  white-space: nowrap;
  color: var(--text-muted, #737b87);
  font-size: 0.9rem;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border-color, #e4e7ec);
}
.customer-stepper-item.is-current {
  color: var(--brand-base-color, #315bd6);
  border-color: var(--brand-base-color, #315bd6);
  font-weight: 600;
}
.customer-stepper-item.is-complete {
  color: var(--brand-base-color, #315bd6);
  border-color: var(--brand-base-color, #315bd6);
}
.customer-stepper-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  flex: 0 0 27px;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 0.8rem;
}
.customer-review-summary {
  grid-column: 1 / -1;
  padding: 18px;
  border: 1px solid var(--border-color, #e4e7ec);
  border-radius: 10px;
  background: var(--surface-subtle, #f8f9fb);
}
.customer-review-summary h4 { margin: 0 0 12px; }
.customer-review-summary p { margin: 7px 0; overflow-wrap: anywhere; }
.customer-form-navigation > div { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 900px) {
  .customer-stepper {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding: 16px 18px 20px;
    scrollbar-width: thin;
  }
  .customer-stepper-item {
    flex: 0 0 auto;
    gap: 6px;
    font-size: 0.8rem;
  }
  .customer-stepper-number {
    width: 25px;
    height: 25px;
    flex-basis: 25px;
  }
}
@media (max-width: 640px) {
  .customer-stepper { padding: 14px 16px 18px; gap: 12px; }
  .customer-stepper-item { font-size: 0.75rem; }
  .customer-form-navigation { align-items: flex-start; gap: 12px; flex-direction: column; }
}
</style>

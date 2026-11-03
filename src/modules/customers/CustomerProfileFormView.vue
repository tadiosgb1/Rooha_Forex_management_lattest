<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { customerProfileService } from '../../services/customerProfileService'
import { listBranches } from '../../services/branchService'
import { useToast } from '../../composables/toast'
import { countryOptions } from '../../services/countryService'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const isEdit = computed(() => Boolean(route.params.id))
const loading = ref(false)
const loadingOptions = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const branchOptions = ref([])
const currentStep = ref(0)
const steps = [
  { title: 'Customer', description: 'Customer name and branch' },
  { title: 'Contact', description: 'Phone and email details' },
  { title: 'Address', description: 'Customer address' },
  { title: 'Review', description: 'Review customer profile details' },
]
const form = reactive({
  branch_id: '', first_name: '', middle_name: '', last_name: '',
  phone: '', email: '', address_line1: '', address_line2: '',
  city: '', state_province: '', postal_code: '', country: '',
})
const fields = [
  { key: 'first_name', label: 'First name', required: true, step: 0 },
  { key: 'middle_name', label: 'Middle name', step: 0 },
  { key: 'last_name', label: 'Last name', required: true, step: 0 },
  { key: 'phone', label: 'Phone', required: true, type: 'tel', step: 1 },
  { key: 'email', label: 'Email', type: 'email', step: 1 },
  { key: 'address_line1', label: 'Address line 1', required: true, step: 2 },
  { key: 'address_line2', label: 'Address line 2', step: 2 },
  { key: 'city', label: 'City', required: true, step: 2 },
  { key: 'state_province', label: 'State / province', step: 2 },
  { key: 'postal_code', label: 'Postal code', step: 2 },
  { key: 'country', label: 'Country', required: true, step: 2 },
]
const currentFields = computed(() => fields.filter(field => field.step === currentStep.value))
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
  try {
    const result = await listBranches({ page: 1, pageSize: 100, search: '', sortBy: 'created_at', isActive: true })
    branchOptions.value = unwrap(result).filter(branch => branch.is_active !== false && String(branch.status || '').toUpperCase() !== 'INACTIVE')
  } catch {
    branchOptions.value = []
    errorMessage.value = 'Unable to load branches. Check your permissions or contact an administrator.'
  } finally { loadingOptions.value = false }
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
  } finally { loading.value = false }
}
function validateStep(step) {
  for (const field of fields.filter(item => item.step === step)) {
    if (field.required && !String(form[field.key] ?? '').trim()) {
      errorMessage.value = `${field.label} is required.`
      return false
    }
  }
  if (step === 0 && !isEdit.value && !form.branch_id) {
    errorMessage.value = 'Please select a branch.'
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
  if (validateStep(currentStep.value)) currentStep.value = Math.min(currentStep.value + 1, steps.length - 1)
}
function previousStep() { errorMessage.value = ''; currentStep.value = Math.max(currentStep.value - 1, 0) }
async function save() {
  if (!steps.every((_, index) => validateStep(index))) return
  const payload = { ...form }
  if (isEdit.value) delete payload.branch_id
  else {
    const makerId = localStorage.getItem('userId')
    if (!makerId) {
      errorMessage.value = 'Your user ID was not found. Please sign in again.'
      return
    }
    payload.maker_id = makerId
  }
  for (const key of ['middle_name', 'address_line2', 'state_province', 'postal_code']) payload[key] = String(payload[key] ?? '').trim()
  saving.value = true
  try {
    if (isEdit.value) {
      await customerProfileService.update(route.params.id, payload)
      toast.success('Customer updated successfully.')
    } else {
      await customerProfileService.create(payload)
      toast.success('Customer created successfully.')
    }
    router.push('/customers')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to save customer profile.'
  } finally { saving.value = false }
}
onMounted(async () => { await loadOptions(); await loadRecord() })
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>{{ isEdit ? 'Edit customer' : 'Add customer' }}</h2><p class="module-description">{{ isEdit ? 'Update the customer profile details.' : 'Create a customer profile with contact and address details.' }}</p></div>
      <BaseButton variant="secondary" @click="router.push('/customers')">← Back to customers</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><div><h3>{{ steps[currentStep].title }}</h3><p class="module-description">{{ steps[currentStep].description }}</p></div><span class="module-description">Step {{ currentStep + 1 }} of {{ steps.length }}</span></div>
      <div class="customer-stepper" aria-label="Customer form progress">
        <div v-for="(step, index) in steps" :key="step.title" class="customer-stepper-item" :class="{ 'is-current': index === currentStep, 'is-complete': index < currentStep }"><span class="customer-stepper-number">{{ index < currentStep ? '✓' : index + 1 }}</span><span>{{ step.title }}</span></div>
      </div>
      <p v-if="loading || loadingOptions" class="module-description" style="padding:16px 24px">{{ loadingOptions ? 'Loading branches…' : 'Loading customer profile…' }}</p>
      <form v-else @submit.prevent="currentStep < steps.length - 1 ? nextStep() : save()">
        <div class="module-form-grid">
          <label v-if="currentStep === 0 && !isEdit" class="module-form-field"><span>Branch *</span><select v-model="form.branch_id" required><option value="" disabled>Select a branch</option><option v-for="branch in branchOptions" :key="branch.id" :value="branch.id">{{ branch.branch_name || branch.name || branch.branch_code || branch.id }}{{ branch.branch_code && branch.branch_name ? ` (${branch.branch_code})` : '' }}</option></select><small v-if="!branchOptions.length">No active branches are available.</small></label>
          <template v-for="field in currentFields" :key="field.key">
            <label v-if="field.key === 'country'" class="module-form-field"><span>{{ field.label }} *</span><input v-model="form.country" list="customer-country-options" autocomplete="country-name" placeholder="Search country…" required /><datalist id="customer-country-options"><option v-for="country in countryOptions" :key="country.code" :value="country.name" /></datalist></label>
            <label v-else class="module-form-field"><span>{{ field.label }}{{ field.required ? ' *' : '' }}</span><input v-model="form[field.key]" :type="field.type || 'text'" :required="field.required" :placeholder="field.label" /></label>
          </template>
          <div v-if="currentStep === 3" class="customer-review-summary">
            <h4>Review customer details</h4>
            <p><strong>Name:</strong> {{ [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ') || '—' }}</p>
            <p><strong>Contact:</strong> {{ form.email || '—' }} · {{ form.phone || '—' }}</p>
            <p><strong>Address:</strong> {{ [form.address_line1, form.address_line2, form.city, form.state_province, form.postal_code, form.country].filter(Boolean).join(', ') || '—' }}</p>
          </div>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer customer-form-navigation"><span>Required fields are marked with *.</span><div>
          <BaseButton type="button" variant="secondary" @click="router.push('/customers')">Cancel</BaseButton>
          <BaseButton v-if="currentStep > 0" type="button" variant="secondary" @click="previousStep">Previous</BaseButton>
          <BaseButton v-if="currentStep < steps.length - 1" type="submit" :disabled="saving || loading || loadingOptions || (!isEdit && !branchOptions.length)">Next</BaseButton>
          <BaseButton v-else type="submit" :disabled="saving || loading || loadingOptions || (!isEdit && !branchOptions.length)">{{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create customer' }}</BaseButton>
        </div></div>
      </form>
    </section>
  </section>
</template>

<style scoped>
.customer-stepper { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;width:100%;min-width:0;padding:18px 24px 22px; }
.customer-stepper-item { display:flex;align-items:center;gap:9px;min-width:0;white-space:nowrap;color:var(--text-muted,#737b87);font-size:.9rem;padding-bottom:10px;border-bottom:2px solid var(--border-color,#e4e7ec); }
.customer-stepper-item.is-current,.customer-stepper-item.is-complete { color:var(--brand-base-color,#315bd6);border-color:var(--brand-base-color,#315bd6);font-weight:600; }
.customer-stepper-number { display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;flex:0 0 27px;border:1px solid currentColor;border-radius:50%;font-size:.8rem; }
.customer-review-summary { grid-column:1/-1;padding:18px;border:1px solid var(--border-color,#e4e7ec);border-radius:10px;background:var(--surface-subtle,#f8f9fb); }
.customer-review-summary h4 { margin:0 0 12px; }.customer-review-summary p { margin:7px 0;overflow-wrap:anywhere; }.customer-form-navigation>div { display:flex;gap:8px;flex-wrap:wrap; }
@media(max-width:900px){.customer-stepper{display:flex;gap:8px;overflow-x:auto;padding:16px 18px 20px}.customer-stepper-item{flex:0 0 auto;gap:6px;font-size:.8rem}.customer-stepper-number{width:25px;height:25px;flex-basis:25px}}
@media(max-width:640px){.customer-stepper{padding:14px 16px 18px;gap:12px}.customer-stepper-item{font-size:.75rem}.customer-form-navigation{align-items:flex-start;gap:12px;flex-direction:column}}
</style>

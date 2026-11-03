<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasPermission } from '../../utils/permissions'
import BaseButton from '../../components/ui/BaseButton.vue'
import { serviceFeeService } from '../../services/serviceFeeService'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => Boolean(route.params.id))
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const form = reactive({
  service_charge_type: 'FOREX_TRANSACTION',
  service_charge_percent: '0.025',
  effective_date: '2026-11-03T00:00',
})

function unwrap(response) {
  let value = response?.data ?? response
  if (value?.data && !Array.isArray(value.data)) value = value.data
  if (value?.item) value = value.item
  return Array.isArray(value) ? value[0] : value
}
function toDateTimeLocal(value) {
  if (!value) return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return text.slice(0, 16)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
onMounted(async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const row = unwrap(await serviceFeeService.get(route.params.id))
    if (!row) throw new Error('Service fee was not found.')
    form.service_charge_type = row.service_charge_type || 'FOREX_TRANSACTION'
    form.service_charge_percent = String(row.service_charge_percent ?? '')
    form.effective_date = toDateTimeLocal(row.effective_date)
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load service fee.'
  } finally {
    loading.value = false
  }
})
async function save() {
  errorMessage.value = ''
  const charge = Number(form.service_charge_percent)
  if (!form.service_charge_type) {
    errorMessage.value = 'Service charge type is required.'
    return
  }
  if (form.service_charge_percent === '' || !Number.isFinite(charge) || charge < 0) {
    errorMessage.value = 'Service charge percent must be a valid non-negative number.'
    return
  }
  if (!form.effective_date) {
    errorMessage.value = 'Effective date is required.'
    return
  }
  const payload = {
    service_charge_type: form.service_charge_type,
    service_charge_percent: charge,
    effective_date: form.effective_date.length === 16 ? `${form.effective_date}:00` : form.effective_date,
  }
  saving.value = true
  try {
    if (isEdit.value) await serviceFeeService.update(route.params.id, payload)
    else await serviceFeeService.create(payload)
    router.push('/service-fees')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to save service fee.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>{{ isEdit ? 'Edit Service Fee' : 'Create Service Fee' }}</h2>
        <p class="module-description">Set the service charge type, decimal percentage, and effective date.</p>
      </div>
      <BaseButton variant="secondary" @click="router.push('/service-fees')">← Back to service fees</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Service fee configuration</h3></div>
      <p v-if="loading" class="module-description" style="padding:16px 24px">Loading service fee…</p>
      <form v-else @submit.prevent="save">
        <div class="module-form-grid">
          <label class="module-form-field">
            <span>Service charge type *</span>
            <select v-model="form.service_charge_type" class="ui-input" required>
              <option value="FOREX_TRANSACTION">Forex transaction</option>
            </select>
          </label>
          <label class="module-form-field">
            <span>Service charge percent (decimal) *</span>
            <input v-model="form.service_charge_percent" class="ui-input" type="number" min="0" step="any" required placeholder="0.025" />
            <small class="module-description">0.025 is displayed as 2.5%.</small>
          </label>
          <label class="module-form-field">
            <span>Effective date *</span>
            <input v-model="form.effective_date" class="ui-input" type="datetime-local" step="1" required />
          </label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer">
          <span>All fields are required.</span>
          <div>
            <BaseButton type="button" variant="secondary" @click="router.push('/service-fees')">Cancel</BaseButton>
            <BaseButton v-if="hasPermission(isEdit ? 'service-fees:update' : 'service-fees:create')" type="submit" :disabled="saving || loading">{{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create service fee' }}</BaseButton>
          </div>
        </div>
      </form>
    </section>
  </section>
</template>

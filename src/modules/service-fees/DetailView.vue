<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasPermission } from '../../utils/permissions'
import BaseButton from '../../components/ui/BaseButton.vue'
import { serviceFeeService } from '../../services/serviceFeeService'

const route = useRoute()
const router = useRouter()
const record = ref(null)
const loading = ref(false)
const errorMessage = ref('')
function unwrap(response) {
  let value = response?.data ?? response
  if (value?.data && !Array.isArray(value.data)) value = value.data
  if (value?.item) value = value.item
  return Array.isArray(value) ? value[0] : value
}
const chargePercent = computed(() => {
  const value = Number(record.value?.service_charge_percent)
  return Number.isFinite(value) ? `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}%` : '—'
})
const fields = computed(() => [
  { label: 'Service fee ID', value: record.value?.id ?? record.value?.service_fee_id ?? record.value?.service_charge_id ?? route.params.id },
  { label: 'Service charge type', value: record.value?.service_charge_type },
  { label: 'Service charge percent', value: record.value?.service_charge_percent },
  { label: 'Charge as percentage', value: chargePercent.value },
  { label: 'Effective date', value: record.value?.effective_date ? new Date(record.value.effective_date).toLocaleString() : '—' },
  { label: 'Status', value: record.value?.status ?? (record.value?.is_active === false ? 'Inactive' : 'Active') },
  { label: 'Created at', value: record.value?.created_at ? new Date(record.value.created_at).toLocaleString() : '—' },
  { label: 'Updated at', value: record.value?.updated_at ? new Date(record.value.updated_at).toLocaleString() : '—' },
])
onMounted(async () => {
  loading.value = true
  try {
    record.value = unwrap(await serviceFeeService.get(route.params.id))
    if (!record.value) throw new Error('Service fee was not found.')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load service fee details.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Service Fee Details</h2><p class="module-description">Configuration and effective date for this service charge.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <BaseButton variant="secondary" @click="router.push('/service-fees')">← Back</BaseButton>
        <BaseButton v-if="record && hasPermission('service-fees:update')" @click="router.push('/service-fees/' + encodeURIComponent(route.params.id) + '/edit')">Edit</BaseButton>
      </div>
    </div>
    <p v-if="loading" class="module-description">Loading service fee…</p>
    <section v-else-if="errorMessage" class="module-panel" style="padding:24px" role="alert">
      <p>{{ errorMessage }}</p><BaseButton variant="secondary" @click="$router.go(0)">Try again</BaseButton>
    </section>
    <section v-else-if="record" class="module-panel">
      <div class="module-panel-header"><h3>Service fee information</h3><strong>{{ chargePercent }}</strong></div>
      <dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:20px;padding:8px 24px 24px;margin:0">
        <div v-for="field in fields" :key="field.label"><dt style="color:var(--text-muted,#778196);font-size:.78rem;margin-bottom:6px">{{ field.label }}</dt><dd style="margin:0;font-weight:650;overflow-wrap:anywhere">{{ field.value ?? '—' }}</dd></div>
      </dl>
    </section>
  </section>
</template>

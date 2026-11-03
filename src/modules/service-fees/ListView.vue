<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../utils/permissions'
import { confirmAction } from '../../composables/confirmAction'
import BaseButton from '../../components/ui/BaseButton.vue'
import { serviceFeeService } from '../../services/serviceFeeService'

const router = useRouter()
const rows = ref([])
const loading = ref(false)
const deletingId = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')

function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
function idOf(row) {
  return row?.id ?? row?.service_fee_id ?? row?.service_charge_id ?? row?.uuid
}
function percent(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}%` : '—'
}
function date(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString()
}
const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  return rows.value.filter(row => !query || [
    idOf(row), row.service_charge_type, row.service_charge_percent, row.effective_date, row.status,
  ].some(value => String(value ?? '').toLowerCase().includes(query)))
})
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    rows.value = normalize(await serviceFeeService.list())
  } catch (error) {
    rows.value = []
    errorMessage.value = error?.message || 'Unable to load service fees.'
  } finally {
    loading.value = false
  }
}
async function remove(row) {
  const id = idOf(row)
  if (id == null || deletingId.value) return
  const confirmed = await confirmAction({
    title: 'Delete service fee',
    message: 'Delete this service fee? This action cannot be undone.',
    confirmText: 'Delete',
    confirmVariant: 'danger',
  })
  if (!confirmed) return
  deletingId.value = String(id)
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await serviceFeeService.remove(id)
    successMessage.value = 'Service fee deleted successfully.'
    await load()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to delete service fee.'
  } finally {
    deletingId.value = ''
  }
}
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Service Fees</h2>
        <p class="module-description">Configure the service charge applied to forex transactions.</p>
      </div>
      <BaseButton v-if="hasPermission('service-fees:create')" @click="router.push('/service-fees/new')">＋ Add Service Fee</BaseButton>
    </div>
    <section class="module-panel">
      <div class="module-panel-header">
        <h3>Service fee register</h3>
        <input v-model="search" class="ui-input" placeholder="Search service fees…" aria-label="Search service fees" style="max-width:280px" />
      </div>
      <p v-if="successMessage" role="status" style="padding:0 24px;color:#237747">{{ successMessage }}</p>
      <p v-if="errorMessage" role="alert" style="padding:0 24px;color:#b43f4a">{{ errorMessage }}</p>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead><tr><th>Service charge type</th><th>Charge</th><th>Effective date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="5" class="module-empty-state">Loading service fees…</td></tr>
            <tr v-else-if="!filteredRows.length"><td colspan="5" class="module-empty-state">No service fees found.</td></tr>
            <tr v-for="row in filteredRows" :key="idOf(row)">
              <td><strong>{{ String(row.service_charge_type || '—').replaceAll('_', ' ') }}</strong></td>
              <td>{{ percent(row.service_charge_percent) }} <small>({{ row.service_charge_percent ?? '—' }})</small></td>
              <td>{{ date(row.effective_date) }}</td>
              <td><span class="module-status-chip" :class="row.is_active === false || String(row.status || '').toUpperCase() === 'INACTIVE' ? 'blocked' : 'active'">{{ row.status || (row.is_active === false ? 'Inactive' : 'Active') }}</span></td>
              <td class="module-row-actions">
                <button type="button" @click="router.push('/service-fees/' + encodeURIComponent(idOf(row)))">View</button>
                <button v-if="hasPermission('service-fees:update')" type="button" @click="router.push('/service-fees/' + encodeURIComponent(idOf(row)) + '/edit')">Edit</button>
                <button v-if="hasPermission('service-fees:delete')" type="button" class="module-delete-action" :disabled="Boolean(deletingId)" @click="remove(row)">{{ deletingId === String(idOf(row)) ? 'Deleting…' : 'Delete' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">Showing {{ filteredRows.length }} of {{ rows.length }} service fees</div>
    </section>
  </section>
</template>

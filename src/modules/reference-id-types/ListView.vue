<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { confirmAction } from '../../composables/confirmAction'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { referenceIdTypeService } from '../../services/referenceIdTypeService'

const router = useRouter()
const rows = ref([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const deletingCode = ref('')

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  return query
    ? rows.value.filter(row => [row.code, row.display_label].some(value => String(value ?? '').toLowerCase().includes(query)))
    : rows.value
})

async function loadRows() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await referenceIdTypeService.list()
    rows.value = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load reference ID types.'
  } finally {
    loading.value = false
  }
}

async function removeRow(row) {
  if (!row?.code || deletingCode.value) return
  const confirmed = await confirmAction({
    title: 'Delete reference ID type',
    message: `Delete reference ID type "${row.code}"? This action cannot be undone.`,
  })
  if (!confirmed) return

  deletingCode.value = row.code
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await referenceIdTypeService.remove(row.code)
    successMessage.value = `Reference ID type "${row.code}" was deleted.`
    await loadRows()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to delete reference ID type.'
  } finally {
    deletingCode.value = ''
  }
}

onMounted(loadRows)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Reference ID Types</h2>
        <p class="module-description">Manage identity document types used in customer KYC.</p>
      </div>
      <BaseButton v-if="hasPermission('reference-id-types:create')" @click="router.push('/reference-id-types/new')">＋ Add ID type</BaseButton>
    </div>

    <p v-if="errorMessage" role="alert" style="color:#b43f4a;margin-bottom:12px">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status" style="color:var(--brand-base-color);margin-bottom:12px">{{ successMessage }}</p>

    <section class="module-panel">
      <div class="module-panel-header">
        <h3>Reference ID type register</h3>
        <label class="module-search">
          <span>⌕</span>
          <BaseInput v-model="search" placeholder="Search types…" size="sm" />
        </label>
      </div>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead><tr><th>Code</th><th>Display label</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="4" class="module-empty-state">Loading…</td></tr>
            <tr v-else-if="!filteredRows.length"><td colspan="4" class="module-empty-state">No ID types found.</td></tr>
            <tr v-for="row in filteredRows" :key="row.code">
              <td><strong>{{ row.code }}</strong></td>
              <td>{{ row.display_label }}</td>
              <td><span class="module-status-chip" :class="row.is_active ? 'active' : 'blocked'">{{ row.is_active ? 'Active' : 'Inactive' }}</span></td>
              <td class="module-row-actions">
                <button v-if="hasPermission('reference-id-types:update')" :disabled="Boolean(deletingCode)" @click="router.push(`/reference-id-types/${encodeURIComponent(row.code)}/edit`)">Edit</button>
                <button v-if="hasPermission('reference-id-types:delete')" class="module-delete-action" :disabled="Boolean(deletingCode)" @click="removeRow(row)">{{ deletingCode === row.code ? 'Deleting…' : 'Delete' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">Showing {{ filteredRows.length }} ID types</div>
    </section>
  </section>
</template>

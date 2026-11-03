<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import { confirmAction } from '../../composables/confirmAction'
import { vaultTransferService } from '../../services/vaultTransferService'

const router = useRouter()
const transfers = ref([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const actionLoadingId = ref('')
const search = ref('')
function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
function idOf(row) { return row.id ?? row.transfer_id ?? row.vault_transfer_id ?? row.reference }
function vaultLabel(vault, fallback) {
  if (vault && typeof vault === 'object') {
    const code = vault.vault_code || ''
    const name = vault.vault_name || vault.name || ''
    if (code && name && code !== name) return `${name} (${code})`
    return name || code || fallback || '—'
  }
  return vault || fallback || '—'
}
function fromLabel(row) { return vaultLabel(row.fromVault || row.from_vault, row.from_vault_name || row.from_vault_id) }
function toLabel(row) { return vaultLabel(row.toVault || row.to_vault, row.to_vault_name || row.to_vault_id) }
function makerLabel(row) {
  const person = row.maker || row.created_by_user
  if (person && typeof person === 'object') return [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || '—'
  return row.maker_name || '—'
}
function transferReference(row) {
  if (row.reference || row.transfer_code) return row.reference || row.transfer_code
  const id = idOf(row)
  return id ? `Transfer ${String(id).slice(0, 8).toUpperCase()}` : '—'
}
function formatAmount(row) {
  const amount = Number(row.amount)
  return Number.isFinite(amount) ? `${row.currency_code || row.currency?.code || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim() : '—'
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}
const filteredTransfers = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return transfers.value
  return transfers.value.filter(row => [transferReference(row), fromLabel(row), toLabel(row), row.currency_code || row.currency?.code, row.transfer_type, row.status, makerLabel(row), row.reason].some(value => String(value ?? '').toLowerCase().includes(query)))
})
async function runAction(row, action) {
  const permission = action === 'approve' ? 'vault-transfers:approve' : 'vault-transfers:reject'
  if (!hasPermission(permission)) return
  const id = idOf(row)
  if (!id) {
    errorMessage.value = 'Cannot process this transfer because its ID is missing.'
    successMessage.value = ''
    return
  }
  const label = action === 'approve' ? 'Approve' : 'Reject'
  const confirmed = await confirmAction({
    title: `${label} cash movement`,
    message: `${label} transfer ${transferReference(row)}?`,
    confirmText: label,
    confirmVariant: action === 'reject' ? 'danger' : 'primary',
  })
  if (!confirmed) return
  actionLoadingId.value = String(id)
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await vaultTransferService[action](id)
    successMessage.value = action === 'approve' ? 'Cash movement approved successfully.' : 'Cash movement rejected successfully.'
    await load()
  } catch (error) {
    errorMessage.value = error?.message || `Unable to ${action} cash movement.`
  } finally {
    actionLoadingId.value = ''
  }
}
async function load() {
  loading.value = true
  errorMessage.value = ''
  try { transfers.value = normalize(await vaultTransferService.list({ page: 1, page_size: 100 })) }
  catch (error) {
    transfers.value = []
    errorMessage.value = error?.message || 'Unable to load cash movements.'
  } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Cash Movements</h2><p class="module-description">Track vault-to-vault and vault-to-till transfers in one place.</p></div>
      <BaseButton v-if="hasPermission('vault-transfers:create')" class="module-primary-btn" @click="router.push('/vault/new')"><span>＋</span> New Cash Movement</BaseButton>
    </div>
    <div class="module-stat-row">
      <BaseCard class="module-stat-card"><span class="module-stat-label">Total movements</span><strong>{{ transfers.length }}</strong></BaseCard>
      <BaseCard class="module-stat-card"><span class="module-stat-label">Matching results</span><strong>{{ filteredTransfers.length }}</strong></BaseCard>
      <BaseCard class="module-stat-card"><span class="module-stat-label">API endpoint</span><strong>vault-transfers</strong></BaseCard>
    </div>
    <BaseCard as="section" class="module-panel">
      <div class="module-panel-header">
        <div><h3>Transfer register</h3><p class="module-description">Review source, destination, amount, type, and status.</p></div>
        <label class="module-search"><span>⌕</span><input v-model="search" class="ui-input" type="search" placeholder="Search movements…" aria-label="Search cash movements" /></label>
      </div>
      <p v-if="successMessage" role="status" style="padding: 12px 24px; color: #237747">{{ successMessage }}</p>\n      <p v-if="errorMessage" role="alert" style="padding: 12px 24px; color: #b43f4a">{{ errorMessage }}</p>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead><tr><th>Reference</th><th>From</th><th>To</th><th>Currency / Amount</th><th>Transfer type</th><th>Status</th><th>Created by</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="9" class="module-empty-cell">Loading cash movements…</td></tr>
            <tr v-else-if="filteredTransfers.length === 0"><td colspan="9" class="module-empty-cell">No cash movements found.</td></tr>
            <tr v-for="row in filteredTransfers" :key="String(idOf(row))">
              <td><strong>{{ transferReference(row) }}</strong></td>
              <td>{{ fromLabel(row) }}</td><td>{{ toLabel(row) }}</td><td>{{ formatAmount(row) }}</td>
              <td>{{ String(row.transfer_type || '—').replaceAll('_', ' ') }}</td>
              <td><BaseBadge tone="neutral" class="module-status-chip">{{ row.status || '—' }}</BaseBadge></td>
              <td>{{ makerLabel(row) }}</td><td>{{ formatDate(row.made_at || row.created_at || row.createdAt) }}</td>
              <td>
                <div class="vault-transfer-row-actions">
                  <BaseButton variant="ghost" size="sm" :disabled="!idOf(row)" @click="router.push('/vault/' + encodeURIComponent(idOf(row)))">View details</BaseButton>
                  <BaseButton v-if="String(row.status || '').toUpperCase() === 'PENDING' && hasPermission('vault-transfers:approve')" size="sm" :disabled="actionLoadingId === String(idOf(row))" @click="runAction(row, 'approve')">{{ actionLoadingId === String(idOf(row)) ? 'Processing…' : 'Approve' }}</BaseButton>
                  <BaseButton v-if="String(row.status || '').toUpperCase() === 'PENDING' && hasPermission('vault-transfers:reject')" variant="danger" size="sm" :disabled="actionLoadingId === String(idOf(row))" @click="runAction(row, 'reject')">{{ actionLoadingId === String(idOf(row)) ? 'Processing…' : 'Reject' }}</BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">Showing {{ filteredTransfers.length }} of {{ transfers.length }} movements</div>
    </BaseCard>
  </section>
</template>

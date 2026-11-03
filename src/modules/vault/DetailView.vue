<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import { vaultTransferService } from '../../services/vaultTransferService'

const route = useRoute()
const router = useRouter()
const transfer = ref(null)
const loading = ref(false)
const errorMessage = ref('')
function normalize(response) { return response?.data?.data ?? response?.data ?? response }
function vaultLabel(vault, fallback) {
  if (vault && typeof vault === 'object') {
    const code = vault.vault_code || ''
    const name = vault.vault_name || vault.name || ''
    if (code && name && code !== name) return `${name} (${code})`
    return name || code || fallback || '—'
  }
  return vault || fallback || '—'
}
function personLabel(person, fallbackId) {
  if (person && typeof person === 'object') {
    return [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.email || '—'
  }
  return fallbackId ? `User ${fallbackId}` : '—'
}
function transferReference(row) {
  if (row.reference || row.transfer_code) return row.reference || row.transfer_code
  const id = row.id || route.params.id
  return id ? `Transfer ${String(id).slice(0, 8).toUpperCase()}` : '—'
}
function formatAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}
async function load() {
  loading.value = true
  errorMessage.value = ''
  try { transfer.value = normalize(await vaultTransferService.get(route.params.id)) }
  catch (error) { errorMessage.value = error?.message || 'Unable to load cash movement details.' }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Cash Movement Details</h2><p class="module-description">Transfer record and audit information.</p></div>
      <BaseButton variant="secondary" @click="router.push('/vault')">← All movements</BaseButton>
    </div>
    <p v-if="errorMessage" role="alert" style="color: #b43f4a">{{ errorMessage }}</p>
    <BaseCard v-if="loading" class="module-panel"><p style="padding:24px">Loading transfer details…</p></BaseCard>
    <BaseCard v-else-if="transfer" class="module-panel module-detail-panel">
      <div class="module-panel-header"><div><h3>{{ transferReference(transfer) }}</h3><p class="module-description">Transfer reference</p></div><BaseBadge tone="neutral" class="module-status-chip">{{ transfer.status || 'Status unavailable' }}</BaseBadge></div>
      <dl class="module-detail-grid">
        <div class="module-detail-item"><dt>From vault / till</dt><dd>{{ vaultLabel(transfer.fromVault || transfer.from_vault, transfer.from_vault_name || transfer.from_vault_id) }}</dd></div>
        <div class="module-detail-item"><dt>To vault / till</dt><dd>{{ vaultLabel(transfer.toVault || transfer.to_vault, transfer.to_vault_name || transfer.to_vault_id) }}</dd></div>
        <div class="module-detail-item"><dt>Currency</dt><dd>{{ transfer.currency_code || transfer.currency?.code || '—' }}</dd></div>
        <div class="module-detail-item"><dt>Amount</dt><dd>{{ transfer.currency_code || transfer.currency?.code || '' }} {{ formatAmount(transfer.amount) }}</dd></div>
        <div class="module-detail-item"><dt>Transfer type</dt><dd>{{ String(transfer.transfer_type || '—').replaceAll('_', ' ') }}</dd></div>
        <div class="module-detail-item"><dt>Created</dt><dd>{{ formatDate(transfer.made_at || transfer.created_at || transfer.createdAt) }}</dd></div>
        <div class="module-detail-item"><dt>Reason</dt><dd>{{ transfer.reason || '—' }}</dd></div>
        <div class="module-detail-item"><dt>Created by</dt><dd>{{ personLabel(transfer.maker, transfer.maker_id) }}</dd></div>
        <div class="module-detail-item"><dt>Checked by</dt><dd>{{ personLabel(transfer.checker, transfer.checker_id) }}</dd></div>
        <div class="module-detail-item"><dt>Checked at</dt><dd>{{ formatDate(transfer.checked_at) }}</dd></div>
      </dl>
    </BaseCard>
    <BaseCard v-else class="module-panel"><p style="padding:24px">No transfer details were returned.</p></BaseCard>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import SearchableSelect from '../../components/ui/SearchableSelect.vue'
import { cashVaultService } from '../../services/cashVaultService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'
import { vaultTransferService } from '../../services/vaultTransferService'

const router = useRouter()
const loadingOptions = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const vaults = ref([])
const currencies = ref([])
const form = reactive({ from_vault_id: '', to_vault_id: '', currency_code: 'ETB', amount: '', transfer_type: 'REPLENISHMENT', reason: '' })
function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
const vaultOptions = computed(() => vaults.value.map(vault => ({
  value: String(vault.id ?? vault.vault_id ?? vault.cash_vault_id ?? ''),
  label: [vault.vault_code, vault.vault_name].filter(Boolean).join(' — ') || String(vault.id ?? vault.vault_id ?? ''),
})).filter(option => option.value))
const currencyOptions = computed(() => currencies.value.map(currency => ({
  value: String(currency.code ?? '').toUpperCase(),
  label: currency.code ? `${currency.code} — ${currency.name || currency.currency_name || 'Currency'}` : '',
})).filter(option => option.value))
const availableDestinations = computed(() => vaultOptions.value.filter(option => option.value !== form.from_vault_id))
const availableSources = computed(() => vaultOptions.value.filter(option => option.value !== form.to_vault_id))
async function loadOptions() {
  loadingOptions.value = true
  errorMessage.value = ''
  try {
    const [vaultResult, currencyResult] = await Promise.allSettled([
      cashVaultService.list({ page: 1, page_size: 100 }),
      referenceCurrencyService.list({ page: 1, page_size: 100 }),
    ])
    vaults.value = vaultResult.status === 'fulfilled'
      ? normalize(vaultResult.value).filter(vault => vault.is_active !== false && !['CLOSED', 'INACTIVE', 'SUSPENDED'].includes(String(vault.status || '').toUpperCase()))
      : []
    currencies.value = currencyResult.status === 'fulfilled'
      ? normalize(currencyResult.value).filter(currency => currency.is_active !== false)
      : []
    if (currencyOptions.value.some(option => option.value === 'ETB')) form.currency_code = 'ETB'
    else if (currencyOptions.value.length) form.currency_code = currencyOptions.value[0].value
    const unavailable = []
    if (vaultResult.status === 'rejected') unavailable.push('vaults')
    if (currencyResult.status === 'rejected') unavailable.push('currencies')
    if (unavailable.length) {
      errorMessage.value = `Cash movement options could not be loaded (${unavailable.join(', ')}). Check permissions or contact an administrator.`
    }
  } finally { loadingOptions.value = false }
}
async function save() {
  errorMessage.value = ''
  if (!form.from_vault_id) { errorMessage.value = 'Choose the source vault.'; return }
  if (!form.to_vault_id) { errorMessage.value = 'Choose the destination vault.'; return }
  if (form.from_vault_id === form.to_vault_id) { errorMessage.value = 'Source and destination vaults must be different.'; return }
  if (!form.currency_code) { errorMessage.value = 'Choose a currency.'; return }
  const amount = Number(form.amount)
  if (form.amount === '' || !Number.isFinite(amount) || amount <= 0) { errorMessage.value = 'Enter an amount greater than zero.'; return }
  if (!form.reason.trim()) { errorMessage.value = 'Enter a reason for this cash movement.'; return }
  const payload = { from_vault_id: form.from_vault_id, to_vault_id: form.to_vault_id, currency_code: form.currency_code, amount, transfer_type: form.transfer_type, reason: form.reason.trim() }
  saving.value = true
  try {
    await vaultTransferService.create(payload)
    router.push('/vault')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to create cash movement.'
  } finally { saving.value = false }
}
onMounted(loadOptions)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>New Cash Movement</h2><p class="module-description">Transfer funds between a source vault and a destination vault or teller till.</p></div>
      <BaseButton variant="secondary" @click="router.push('/vault')">← All cash movements</BaseButton>
    </div>
    <BaseCard as="section" class="module-panel module-form-panel">
      <div class="module-panel-header"><div><h3>Movement details</h3><p class="module-description">Enter the transfer information below.</p></div></div>
      <p v-if="loadingOptions" class="module-description" style="padding: 18px 24px">Loading available vaults and currencies…</p>
      <form v-else @submit.prevent="save">
        <div class="module-form-grid">
          <label class="module-form-field"><span>From vault / till *</span><SearchableSelect v-model="form.from_vault_id" :options="availableSources" placeholder="Select source vault or till…" aria-label="Source vault" required /></label>
          <label class="module-form-field"><span>To vault / till *</span><SearchableSelect v-model="form.to_vault_id" :options="availableDestinations" placeholder="Select destination vault or till…" aria-label="Destination vault" required /></label>
          <label class="module-form-field"><span>Currency *</span><SearchableSelect v-model="form.currency_code" :options="currencyOptions" placeholder="Select currency…" aria-label="Transfer currency" required /></label>
          <label class="module-form-field"><span>Amount *</span><input v-model="form.amount" class="ui-input" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label>
          <label class="module-form-field"><span>Transfer type *</span><select v-model="form.transfer_type" class="ui-input" required><option value="REPLENISHMENT">Replenishment</option></select></label>
          <label class="module-form-field module-form-field-full"><span>Reason *</span><textarea v-model="form.reason" class="ui-input" rows="3" maxlength="500" placeholder="Explain why these funds are being moved…" required></textarea></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin: 0 24px 16px; color: #b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer"><span>Please verify the source, destination, and amount before submitting.</span><div><BaseButton type="button" variant="secondary" @click="router.push('/vault')">Cancel</BaseButton><BaseButton type="submit" :disabled="saving || loadingOptions || !vaults.length">{{ saving ? 'Submitting…' : 'Create cash movement' }}</BaseButton></div></div>
      </form>
    </BaseCard>
  </section>
</template>

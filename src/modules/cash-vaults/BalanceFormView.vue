<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import SearchableSelect from '../../components/ui/SearchableSelect.vue'
import { cashVaultService } from '../../services/cashVaultService'
import { cashVaultBalanceService } from '../../services/cashVaultBalanceService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const vault = ref(null)
const currencies = ref([])
const form = reactive({ vault_id: String(route.query.vault_id || ''), currency_id: '', current_balance: '' })
function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
const currencyOptions = computed(() => currencies.value.map(currency => ({ value: String(currency.id), label: `${currency.code} — ${currency.name}` })))
onMounted(async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    // Currency choices are required for this form; vault details are only a label.
    // Do not block balance entry if the user cannot read the vault endpoint.
    const currencyResponse = await referenceCurrencyService.list({ page: 1, page_size: 100 })
    currencies.value = normalize(currencyResponse).filter(currency => currency.is_active !== false)
    if (form.vault_id) {
      try {
        const vaultResponse = await cashVaultService.get(form.vault_id)
        const value = vaultResponse?.data ?? vaultResponse
        vault.value = value?.data ?? value
      } catch {
        vault.value = null
      }
    }
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load currency choices for the form.'
  } finally {
    loading.value = false
  }
})
async function save() {
  errorMessage.value = ''
  const amount = Number(form.current_balance)
  if (!form.vault_id) { errorMessage.value = 'Select a cash vault from the cash vault register first.'; return }
  if (!form.currency_id) { errorMessage.value = 'Select a currency.'; return }
  if (form.current_balance === '' || !Number.isFinite(amount) || amount < 0) { errorMessage.value = 'Enter a valid balance of zero or more.'; return }
  saving.value = true
  try {
    await cashVaultBalanceService.create({ vault_id: form.vault_id, currency_id: form.currency_id, current_balance: amount })
    router.push('/cash-vaults')
  } catch (error) { errorMessage.value = error?.message || 'Unable to add the currency balance.' }
  finally { saving.value = false }
}
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro"><div><h2>Add Currency Balance</h2><p class="module-description">Record a separate balance for each currency held in a cash vault or teller till.</p></div><BaseButton variant="secondary" @click="router.push('/cash-vaults')">← Back to cash vaults</BaseButton></div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Balance details</h3></div>
      <p v-if="loading" class="module-description" style="padding:16px 24px">Loading currencies…</p>
      <form v-else @submit.prevent="save">
        <div class="module-form-grid">
          <div class="module-form-field"><span>Cash vault</span><div class="ui-input" style="display:flex;align-items:center;min-height:42px">{{ vault?.vault_name || vault?.vault_code || form.vault_id || 'Choose a vault from the cash vault register' }}</div></div>
          <label class="module-form-field"><span>Currency *</span><SearchableSelect v-model="form.currency_id" :options="currencyOptions" placeholder="Search currencies…" aria-label="Search currencies" required /></label>
          <label class="module-form-field"><span>Current balance *</span><input v-model="form.current_balance" class="ui-input" type="number" min="0" step="0.01" required placeholder="0.00" /></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer"><span>Each currency is recorded as a separate balance.</span><div><BaseButton type="button" variant="secondary" @click="router.push('/cash-vaults')">Cancel</BaseButton><BaseButton v-if="hasPermission('cash-vault-balances:create')" type="submit" :disabled="saving || loading">{{ saving ? 'Saving…' : 'Add balance' }}</BaseButton></div></div>
      </form>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import SearchableSelect from '../../components/ui/SearchableSelect.vue'
import { cashVaultService } from '../../services/cashVaultService'
import { cashVaultBalanceService } from '../../services/cashVaultBalanceService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'

const route = useRoute()
const router = useRouter()
const recordId = computed(() => String(route.params.id || ''))
const isEditing = computed(() => Boolean(recordId.value))
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const vault = ref(null)
const currencies = ref([])
const form = reactive({ vault_id: String(route.query.vault_id || '') })
const balances = ref([{ currency_id: '', current_balance: '' }])

function unwrap(response) {
  let value = response?.data ?? response
  if (value?.data && !Array.isArray(value.data)) value = value.data
  return value
}
function normalize(response) {
  const value = unwrap(response)
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
const currencyOptions = computed(() => currencies.value.map(currency => ({
  value: String(currency.id),
  label: `${currency.code} — ${currency.name}`,
})))

function addBalance() {
  balances.value.push({ currency_id: '', current_balance: '' })
}
function removeBalance(index) {
  if (balances.value.length > 1) balances.value.splice(index, 1)
}

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const currencyResponse = await referenceCurrencyService.list({ page: 1, page_size: 100 })
    currencies.value = normalize(currencyResponse).filter(currency => currency.is_active !== false)

    if (isEditing.value) {
      const response = await cashVaultBalanceService.get(recordId.value)
      const record = unwrap(response)
      const vaultData = record?.vault ?? record?.cashVault ?? record?.cash_vault
      form.vault_id = String(record?.vault_id ?? vaultData?.id ?? route.query.vault_id ?? '')
      vault.value = vaultData || null

      const recordBalances = Array.isArray(record?.balances) ? record.balances : (
        record?.currency_id || record?.currency?.id
          ? [record]
          : []
      )
      if (recordBalances.length) {
        balances.value = recordBalances.map(item => ({
          currency_id: String(item.currency_id ?? item.currency?.id ?? ''),
          current_balance: item.current_balance ?? item.balance ?? '',
        }))
      } else {
        balances.value = [{ currency_id: '', current_balance: '' }]
      }
    }

    if (form.vault_id && !vault.value) {
      try {
        const vaultResponse = await cashVaultService.get(form.vault_id)
        vault.value = unwrap(vaultResponse)
      } catch {
        vault.value = null
      }
    }
  } catch (error) {
    errorMessage.value = error?.message || (isEditing.value
      ? 'Unable to load this cash vault balance.'
      : 'Unable to load currency choices for the form.')
  } finally {
    loading.value = false
  }
})

async function save() {
  errorMessage.value = ''
  if (!form.vault_id) {
    errorMessage.value = 'Select a cash vault from the cash vault register first.'
    return
  }

  const normalizedBalances = []
  for (let index = 0; index < balances.value.length; index += 1) {
    const item = balances.value[index]
    const amount = Number(item.current_balance)
    if (!item.currency_id) {
      errorMessage.value = `Select a currency for balance ${index + 1}.`
      return
    }
    if (item.current_balance === '' || !Number.isFinite(amount) || amount < 0) {
      errorMessage.value = `Enter a valid balance of zero or more for balance ${index + 1}.`
      return
    }
    normalizedBalances.push({ currency_id: String(item.currency_id), current_balance: amount })
  }
  const currencyIds = normalizedBalances.map(item => item.currency_id)
  if (new Set(currencyIds).size !== currencyIds.length) {
    errorMessage.value = 'Each currency can only be included once.'
    return
  }

  saving.value = true
  try {
    if (isEditing.value) {
      await cashVaultBalanceService.update(recordId.value, {
        vault_id: form.vault_id,
        balances: normalizedBalances,
      })
    } else {
      await cashVaultBalanceService.create({
        vault_id: form.vault_id,
        currency_id: normalizedBalances[0].currency_id,
        current_balance: normalizedBalances[0].current_balance,
      })
    }
    router.push('/cash-vaults')
  } catch (error) {
    errorMessage.value = error?.message || (isEditing.value
      ? 'Unable to update cash vault balances.'
      : 'Unable to add the currency balance.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>{{ isEditing ? 'Edit Cash Vault Balances' : 'Add Currency Balance' }}</h2>
        <p class="module-description">Record a separate balance for each currency held in a cash vault or teller till.</p>
      </div>
      <BaseButton variant="secondary" @click="router.push('/cash-vaults')">← Back to cash vaults</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Balance details</h3></div>
      <p v-if="loading" class="module-description" style="padding:16px 24px">Loading balance details…</p>
      <form v-else @submit.prevent="save">
        <div class="module-form-grid">
          <div class="module-form-field">
            <span>Cash vault</span>
            <div class="ui-input" style="display:flex;align-items:center;min-height:42px">
              {{ vault?.vault_name || vault?.name || vault?.vault_code || form.vault_id || 'Choose a vault from the cash vault register' }}
            </div>
          </div>
        </div>
        <div style="padding:0 24px 20px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
            <h4 style="margin:0">Currency balances</h4>
            <BaseButton type="button" variant="secondary" @click="addBalance">+ Add currency</BaseButton>
          </div>
          <div v-for="(item, index) in balances" :key="index" class="module-form-grid" style="margin-bottom:12px">
            <label class="module-form-field">
              <span>Currency {{ index + 1 }} *</span>
              <SearchableSelect v-model="item.currency_id" :options="currencyOptions" placeholder="Search currencies…" aria-label="Search currencies" required />
            </label>
            <label class="module-form-field">
              <span>Current balance *</span>
              <input v-model="item.current_balance" class="ui-input" type="number" min="0" step="0.01" required placeholder="0.00" />
            </label>
            <div class="module-form-field" style="justify-content:flex-end">
              <span>&nbsp;</span>
              <BaseButton type="button" variant="secondary" :disabled="balances.length === 1" @click="removeBalance(index)">Remove</BaseButton>
            </div>
          </div>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer">
          <span>{{ isEditing ? 'Changes are saved to this cash vault balance record.' : 'Each currency is recorded as a separate balance.' }}</span>
          <div>
            <BaseButton type="button" variant="secondary" @click="router.push('/cash-vaults')">Cancel</BaseButton>
            <BaseButton type="submit" :disabled="saving || loading">{{ saving ? 'Saving…' : (isEditing ? 'Save changes' : 'Add balance') }}</BaseButton>
          </div>
        </div>
      </form>
    </section>
  </section>
</template>

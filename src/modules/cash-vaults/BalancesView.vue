<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { cashVaultService } from '../../services/cashVaultService'
import { cashVaultBalanceService } from '../../services/cashVaultBalanceService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'

const route = useRoute()
const router = useRouter()
const vaultId = computed(() => String(route.params.vault_id || ''))
const loading = ref(false)
const errorMessage = ref('')
const vault = ref(null)
const balances = ref([])
const currencies = ref([])

function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
function canEditBalance() { return hasPermission('cash-vault-balances:update') }
function currencyFor(balance) {
  return balance.currency ?? currencies.value.find(item => String(item.id) === String(balance.currency_id)) ?? null
}
function formatMoney(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}
async function load() {
  if (!vaultId.value) {
    errorMessage.value = 'A cash vault ID is required to view currency balances.'
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    // The balance permission controls the main table. Optional lookups must not
    // blank it if the user cannot list currencies or read the vault separately.
    const balanceResponse = await cashVaultBalanceService.list({ vault_id: vaultId.value })
    balances.value = normalize(balanceResponse).filter(item => String(item.vault_id ?? item.vault?.id ?? item.cash_vault_id) === vaultId.value)

    const [currencyResult, vaultResult] = await Promise.allSettled([
      referenceCurrencyService.list({ page: 1, page_size: 100 }),
      cashVaultService.get(vaultId.value),
    ])
    currencies.value = currencyResult.status === 'fulfilled' ? normalize(currencyResult.value) : []
    if (vaultResult.status === 'fulfilled') {
      const value = vaultResult.value?.data ?? vaultResult.value
      vault.value = value?.data ?? value
    } else {
      vault.value = null
    }
  } catch (error) {
    balances.value = []
    errorMessage.value = error?.message || 'Unable to load currency balances for this cash vault.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Cash Vault Currency Balances</h2>
        <p class="module-description">View each currency balance recorded for this cash vault.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <BaseButton variant="secondary" @click="router.push('/cash-vaults')">← Back to cash vaults</BaseButton>
        <BaseButton v-if="hasPermission('cash-vault-balances:create')" @click="router.push({ path: '/cash-vault-balance/new', query: { vault_id: vaultId } })">＋ Add currency balance</BaseButton>
      </div>
    </div>
    <section class="module-panel">
      <div class="module-panel-header">
        <div>
          <h3>{{ vault?.vault_name || vault?.vault_code || 'Selected cash vault' }}</h3>
          <p class="module-description" style="margin:4px 0 0">Vault ID: {{ vaultId }}</p>
        </div>
        <BaseButton variant="secondary" :disabled="loading" @click="load">Refresh</BaseButton>
      </div>
      <p v-if="errorMessage" role="alert" style="padding:0 24px;color:#b43f4a">{{ errorMessage }}</p>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead><tr><th>Currency</th><th>Current balance</th><th>Last updated</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="4" style="text-align:center;padding:28px">Loading currency balances…</td></tr>
            <tr v-else-if="!balances.length"><td colspan="4" style="text-align:center;padding:28px">No currency balances have been recorded for this vault.</td></tr>
            <tr v-for="balance in balances" :key="balance.id || balance.currency_id">
              <td><strong>{{ currencyFor(balance)?.code || balance.currency_code || '—' }}</strong><div>{{ currencyFor(balance)?.name || balance.currency_name || '' }}</div></td>
              <td>{{ currencyFor(balance)?.code || balance.currency_code || '' }} {{ formatMoney(balance.current_balance) }}</td>
              <td>{{ formatDate(balance.updated_at || balance.made_at || balance.created_at) }}</td>
              <td><BaseButton v-if="canEditBalance() && balance.id" variant="secondary" @click="router.push({ name: 'cash-vault-balances-edit', params: { id: balance.id } })">Edit</BaseButton><span v-else>—</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

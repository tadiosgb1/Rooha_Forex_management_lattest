<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import SearchableSelect from '../../components/ui/SearchableSelect.vue'
import { cashVaultService } from '../../services/cashVaultService'
import { cashVaultBalanceService } from '../../services/cashVaultBalanceService'
import { listBranches } from '../../services/branchService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'
import { apiRequest } from '../../services/apiClient'

const router = useRouter()
const route = useRoute()
const isEdit = computed(() => Boolean(route.params.id))
const loadingOptions = ref(false)
const saving = ref(false)
const savingBalance = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const branches = ref([])
const users = ref([])
const currencies = ref([])
const balanceStepOpen = ref(false)
const savedVaultId = ref('')
const balanceRows = ref([])
const form = reactive({
  branch_id: '',
  vault_code: '',
  vault_type: 'TELLER_TILL',
  vault_name: '',
  assigned_user_id: '',
})
function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
const branchOptions = computed(() => branches.value.map(branch => ({ value: String(branch.id), label: branch.branch_name || branch.name || branch.branch_code || String(branch.id) })))
const userOptions = computed(() => users.value.map(user => ({ value: String(user.id), label: userLabel(user) })))
const currencyOptions = computed(() => currencies.value
  .filter(currency => currency.is_active !== false && currency.is_deleted !== true)
  .map(currency => ({
    value: String(currency.id),
    label: [currency.code, currency.name].filter(Boolean).join(' — ') || String(currency.id),
  })))
function userLabel(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return name ? `${name} (${user.email || user.id})` : user.email || `User ${user.id}`
}
async function loadOptions() {
  loadingOptions.value = true
  errorMessage.value = ''
  try {
    const [branchResult, userResult, currencyResult, vaultResult] = await Promise.allSettled([
      listBranches({ page: 1, pageSize: 100, search: '', isActive: true }),
      apiRequest('users?page=1&page_size=100'),
      referenceCurrencyService.list({ page: 1, page_size: 100 }),
      isEdit.value ? cashVaultService.get(route.params.id) : Promise.resolve(null),
    ])
    branches.value = branchResult.status === 'fulfilled' ? normalize(branchResult.value) : []
    users.value = userResult.status === 'fulfilled'
      ? normalize(userResult.value).filter(user => user.is_active !== false && user.is_deleted !== true)
      : []
    currencies.value = currencyResult.status === 'fulfilled' ? normalize(currencyResult.value) : []
    balanceRows.value = currencies.value
      .filter(currency => currency.is_active !== false && currency.is_deleted !== true)
      .map(currency => ({
        currency_id: String(currency.id),
        label: [currency.code, currency.name].filter(Boolean).join(' — ') || String(currency.id),
        current_balance: '0',
      }))
    if (vaultResult.status === 'fulfilled' && vaultResult.value) {
      const responseValue = vaultResult.value?.data ?? vaultResult.value
      const vault = responseValue?.data ?? responseValue
      Object.assign(form, {
        branch_id: String(vault.branch_id ?? vault.branch?.id ?? ''),
        vault_code: vault.vault_code ?? '',
        vault_type: vault.vault_type === 'CASH_VAULT' ? 'MAIN_VAULT' : (vault.vault_type ?? 'TELLER_TILL'),
        vault_name: vault.vault_name ?? '',
        assigned_user_id: String(vault.assigned_user_id ?? vault.assigned_user?.id ?? ''),
      })
    } else if (isEdit.value && vaultResult.status === 'rejected') {
      errorMessage.value = vaultResult.reason?.message || 'Unable to load this cash vault for editing.'
    }
    const unavailable = []
    if (branchResult.status === 'rejected') unavailable.push('branches')
    if (userResult.status === 'rejected') unavailable.push('users')
    if (currencyResult.status === 'rejected') unavailable.push('currencies')
    if (unavailable.length && !errorMessage.value) {
      errorMessage.value = `Some form options could not be loaded (${unavailable.join(', ')}). Check your permissions or contact an administrator.`
    }
  } finally {
    loadingOptions.value = false
  }
}
async function save() {
  errorMessage.value = ''
  successMessage.value = ''
  if (!form.branch_id) { errorMessage.value = 'Select a branch.'; return }
  if (!form.vault_code.trim()) { errorMessage.value = 'Vault code is required.'; return }
  if (!form.vault_name.trim()) { errorMessage.value = 'Vault name is required.'; return }
  if (!form.assigned_user_id) { errorMessage.value = 'Select an assigned user.'; return }
  const payload = {
    branch_id: form.branch_id,
    vault_code: form.vault_code.trim(),
    vault_type: form.vault_type,
    vault_name: form.vault_name.trim(),
    assigned_user_id: Number(form.assigned_user_id),
  }
  if (!Number.isInteger(payload.assigned_user_id) || payload.assigned_user_id <= 0) {
    errorMessage.value = 'The selected user has an invalid ID.'
    return
  }
  saving.value = true
  try {
    let response
    if (isEdit.value) {
      response = await cashVaultService.update(route.params.id, payload)
    } else {
      response = await cashVaultService.create(payload)
    }
    const responseData = response?.data?.data ?? response?.data ?? response
    const id = responseData?.id ?? route.params.id
    if (!id) {
      errorMessage.value = 'Cash vault was saved, but its ID was not returned. Open the vault list to add balances.'
      return
    }
    savedVaultId.value = String(id)
    balanceRows.value = currencies.value
      .filter(currency => currency.is_active !== false && currency.is_deleted !== true)
      .map(currency => ({
        currency_id: String(currency.id),
        label: [currency.code, currency.name].filter(Boolean).join(' — ') || String(currency.id),
        current_balance: '0',
      }))
    successMessage.value = isEdit.value ? 'Cash vault updated successfully.' : 'Cash vault created successfully.'
    balanceStepOpen.value = true
  } catch (error) {
    errorMessage.value = error?.message || (isEdit.value ? 'Unable to update cash vault.' : 'Unable to create cash vault.')
  } finally {
    saving.value = false
  }
}
async function addBalance() {
  errorMessage.value = ''
  if (!savedVaultId.value) { errorMessage.value = 'Cash vault ID is missing.'; return }
  if (!balanceRows.value.length) { errorMessage.value = 'No active currencies are available to add.'; return }
  const balances = []
  for (const row of balanceRows.value) {
    const rawAmount = String(row.current_balance ?? '').trim()
    const amount = Number(rawAmount)
    if (!rawAmount || !Number.isFinite(amount) || amount < 0) {
      errorMessage.value = `Enter a valid balance of zero or more for ${row.label}.`
      return
    }
    balances.push({ currency_id: row.currency_id, current_balance: amount })
  }
  savingBalance.value = true
  try {
    await cashVaultBalanceService.create({
      vault_id: savedVaultId.value,
      balances,
    })
    successMessage.value = 'All currency balances submitted successfully.'
    finish()
  } catch (error) {
    errorMessage.value = error?.message || 'Cash vault was saved, but the currency balances could not be submitted.'
  } finally {
    savingBalance.value = false
  }
}
function finish() {
  router.push('/cash-vaults')
}
onMounted(loadOptions)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>{{ balanceStepOpen ? 'Add Cash Vault Balances' : (isEdit ? 'Edit Cash Vault' : 'Create Cash Vault') }}</h2>
        <p class="module-description">{{ balanceStepOpen ? 'All active currencies are listed below. Balances default to zero; edit any amounts before submitting them together.' : 'Register a vault or teller till and assign its branch and responsible user.' }}</p>
      </div>
      <BaseButton variant="secondary" @click="finish">← Back to cash vaults</BaseButton>
    </div>

    <section v-if="!balanceStepOpen" class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Cash vault information</h3></div>
      <p v-if="loadingOptions" class="module-description" style="padding:16px 24px">Loading branches, users, and currencies…</p>
      <form v-else @submit.prevent="save">
        <div class="module-form-grid">
          <label class="module-form-field"><span>Branch *</span><SearchableSelect v-model="form.branch_id" :options="branchOptions" placeholder="Search branches…" aria-label="Search branches" required /></label>
          <label class="module-form-field"><span>Vault code *</span><input v-model="form.vault_code" class="ui-input" required maxlength="80" placeholder="TELLER_TILL_01" /></label>
          <label class="module-form-field"><span>Vault type *</span><select v-model="form.vault_type" class="ui-input" required><option value="MAIN_VAULT">Main vault</option><option value="TELLER_TILL">Teller till</option></select></label>
          <label class="module-form-field"><span>Vault name *</span><input v-model="form.vault_name" class="ui-input" required maxlength="120" placeholder="Teller Till – Counter 1" /></label>
          <label class="module-form-field"><span>Assigned user *</span><SearchableSelect v-model="form.assigned_user_id" :options="userOptions" placeholder="Search users by name or email…" aria-label="Search assigned users by name or email" required /></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer"><span>After saving, you can add balances for one or more currencies.</span><div><BaseButton type="button" variant="secondary" @click="finish">Cancel</BaseButton><BaseButton type="submit" :disabled="saving || loadingOptions">{{ saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create cash vault') }}</BaseButton></div></div>
      </form>
    </section>

    <section v-else class="module-panel module-form-panel">
      <div class="module-panel-header"><div><h3>{{ form.vault_name || 'Cash vault' }}</h3><p class="module-description">Vault saved successfully. Enter opening balances for all currencies. Every balance defaults to zero.</p></div></div>
      <p v-if="successMessage" role="status" style="padding:12px 24px 0;color:#237747">{{ successMessage }}</p>
      <form @submit.prevent="addBalance">
        <div class="module-form-grid">
          <label v-for="row in balanceRows" :key="row.currency_id" class="module-form-field">
            <span>{{ row.label }}</span>
            <input v-model="row.current_balance" class="ui-input" type="number" min="0" step="any" required placeholder="0" />
          </label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer"><span>Submits one payload containing the vault ID and every currency balance.</span><div><BaseButton type="button" variant="secondary" :disabled="savingBalance" @click="finish">Cancel</BaseButton><BaseButton type="submit" :disabled="savingBalance || !balanceRows.length">{{ savingBalance ? 'Submitting…' : 'Submit all balances' }}</BaseButton></div></div>
      </form>
    </section>
  </section>
</template>

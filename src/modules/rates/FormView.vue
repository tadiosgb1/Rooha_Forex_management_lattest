<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../../composables/toast'
import BaseButton from '../../components/ui/BaseButton.vue'
import { rateService } from '../../services/rateService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const isEdit = computed(() => Boolean(route.params.id))
const loading = ref(false)
const loadingCurrencies = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const currencies = ref([])
const form = reactive({
  currency_id: '',
  rate_date: new Date().toISOString().slice(0, 10),
  buy_rate: '',
  sell_rate: '',
})

function unwrap(response) {
  const value = response?.data ?? response
  return Array.isArray(value) ? value[0] : value
}
function normalizeList(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
function currencyId(currency) {
  return currency?.id ?? currency?.currency_id ?? currency?.uuid ?? ''
}
function currencyLabel(currency) {
  const code = currency?.code ?? currency?.currency_code ?? ''
  const name = currency?.name ?? currency?.currency_name ?? ''
  return [code, name].filter(Boolean).join(' — ') || String(currencyId(currency))
}
const selectedCurrencyLabel = computed(() => {
  const selected = currencies.value.find(currency => String(currencyId(currency)) === String(form.currency_id))
  return selected ? currencyLabel(selected) : 'Currency selected on this exchange rate'
})

onMounted(async () => {
  loadingCurrencies.value = true
  try {
    const response = await referenceCurrencyService.list({ page: 1, page_size: 100 })
    currencies.value = normalizeList(response)
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load reference currencies.'
  } finally {
    loadingCurrencies.value = false
  }

  if (!isEdit.value) return
  loading.value = true
  try {
    const record = unwrap(await rateService.get(route.params.id))
    Object.assign(form, {
      currency_id: record?.currency_id ?? record?.currencyId ?? record?.currency?.id ?? record?.currency?.currency_id ?? '',
      rate_date: String(record?.rate_date ?? record?.rateDate ?? '').slice(0, 10),
      buy_rate: record?.buy_rate ?? record?.buyRate ?? '',
      sell_rate: record?.sell_rate ?? record?.sellRate ?? '',
    })
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load exchange rate.'
  } finally {
    loading.value = false
  }
})

async function save() {
  errorMessage.value = ''
  const currencyIdValue = String(form.currency_id ?? '').trim()
  const rateDate = String(form.rate_date ?? '').trim()
  const buyRate = Number(form.buy_rate)
  const sellRate = Number(form.sell_rate)

  if (!isEdit.value && (!currencyIdValue || !currencies.value.some(currency => String(currencyId(currency)) === currencyIdValue))) {
    errorMessage.value = 'Please select a currency from Reference Currencies.'
    return
  }
  if (!rateDate) {
    errorMessage.value = 'Rate date is required.'
    return
  }
  if (form.buy_rate === '' || !Number.isFinite(buyRate) || buyRate <= 0) {
    errorMessage.value = 'Buy rate must be a number greater than zero.'
    return
  }
  if (form.sell_rate === '' || !Number.isFinite(sellRate) || sellRate <= 0) {
    errorMessage.value = 'Sell rate must be a number greater than zero.'
    return
  }
  saving.value = true
  // The API treats currency_id as immutable on existing exchange rates.
  // Only include it when creating a new rate, never in an edit PATCH.
  const payload = {
    ...(isEdit.value ? {} : { currency_id: currencyIdValue }),
    rate_date: rateDate,
    buy_rate: buyRate,
    sell_rate: sellRate,
  }
  try {
    if (isEdit.value) await rateService.update(route.params.id, payload)
    else await rateService.create(payload)
    toast.success('Exchange rate saved successfully.');router.push('/rates')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to save exchange rate.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>{{ isEdit ? 'Edit Exchange Rate' : 'Create Exchange Rate' }}</h2><p class="module-description">Manage currency buy and sell rates for a specific date.</p></div>
      <BaseButton variant="secondary" @click="router.push('/rates')">← Back to rates</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Exchange rate information</h3></div>
      <p v-if="loading || loadingCurrencies" class="module-description" style="padding:16px 24px">Loading {{ loadingCurrencies ? 'reference currencies' : 'exchange rate' }}…</p>
      <form v-else @submit.prevent="save">
        <div class="module-form-grid">
          <label v-if="isEdit" class="module-form-field"><span>Currency</span><input class="ui-input" :value="selectedCurrencyLabel" readonly aria-readonly="true" /><small class="module-description">Currency cannot be changed after an exchange rate is created.</small></label>
          <label v-else class="module-form-field"><span>Currency *</span><select v-model="form.currency_id" class="ui-input" required><option value="" disabled>Select a reference currency</option><option v-for="currency in currencies" :key="currencyId(currency)" :value="String(currencyId(currency))">{{ currencyLabel(currency) }}</option></select></label>
          <label class="module-form-field"><span>Rate date *</span><input v-model="form.rate_date" class="ui-input" type="date" required /></label>
          <label class="module-form-field"><span>Buy rate *</span><input v-model="form.buy_rate" class="ui-input" type="number" min="0.000001" step="any" required placeholder="56.75" /></label>
          <label class="module-form-field"><span>Sell rate *</span><input v-model="form.sell_rate" class="ui-input" type="number" min="0.000001" step="any" required placeholder="57.25" /></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer"><span>All fields are required.</span><div><BaseButton type="button" variant="secondary" @click="router.push('/rates')">Cancel</BaseButton><BaseButton v-if="hasPermission(isEdit ? 'exchange-rates:update' : 'exchange-rates:create')" type="submit" :disabled="saving || loading || loadingCurrencies || !currencies.length">{{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create exchange rate' }}</BaseButton></div></div>
      </form>
      <p v-if="!loading && !loadingCurrencies && !currencies.length" role="alert" style="padding:0 24px 16px;color:#b43f4a">No reference currencies are available. Add a currency before creating an exchange rate.</p>
    </section>
  </section>
</template>

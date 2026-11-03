<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../../services/apiClient'
import { forexTransactionService } from '../../services/forexTransactionService'
import { rateService } from '../../services/rateService'
import SearchableSelect from '../../components/ui/SearchableSelect.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { useToast } from '../../composables/toast'
import { hasAnyPermission } from '../../utils/permissions'

const router = useRouter()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const currencies = ref([])
const serviceFees = ref([])
const serviceFeeLoading = ref(false)
const serviceFeeError = ref('')
const latestRate = ref(null)
const rateLoading = ref(false)
const rateError = ref('')
const form = reactive({
  fullname: '',
  nationality: 'Ethiopian',
  phone_number: '',
  id_or_passport_number: '',
  city: 'Addis Ababa',
  sub_city: '',
  wereda: '',
  currency_id: '',
  transaction_type: 'BUY',
  payment_method: 'CASH',
  service_fee: '0',
  fcy_amount: '100',
})

function records(response) {
  let value = response?.data ?? response
  for (let depth = 0; depth < 4 && value && !Array.isArray(value) && typeof value === 'object'; depth += 1) {
    const next = value.data ?? value.results ?? value.items ?? value.records ?? value.reference_currencies ?? value.exchange_rates ?? value.service_fees
    if (next === undefined || next === value) break
    value = next
  }
  if (value && !Array.isArray(value) && typeof value === 'object') value = [value]
  return Array.isArray(value) ? value : []
}
function idOf(item) {
  return item?.id ?? item?.currency_id ?? item?.uuid ?? ''
}
function labelOf(item) {
  return [item.code, item.currency_code, item.name, item.currency_name].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).join(' · ') || 'Unnamed currency'
}
const currencyOptions = computed(() => currencies.value.map(item => ({ value: String(idOf(item)), label: labelOf(item) })).filter(item => item.value))
const selectedCurrency = computed(() => currencies.value.find(item => String(idOf(item)) === String(form.currency_id)) ?? null)
const buyRate = computed(() => {
  const value = Number(latestRate.value?.buy_rate ?? latestRate.value?.buyRate)
  return Number.isFinite(value) && value > 0 ? value : null
})
const sellRate = computed(() => {
  const value = Number(latestRate.value?.sell_rate ?? latestRate.value?.sellRate)
  return Number.isFinite(value) && value > 0 ? value : null
})
const rateValue = computed(() => form.transaction_type === 'BUY' ? buyRate.value : sellRate.value)
const etbAmount = computed(() => {
  const amount = Number(form.fcy_amount)
  return rateValue.value != null && Number.isFinite(amount) && amount > 0 ? amount * rateValue.value : null
})
function formatMoney(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function currencyCode() {
  return selectedCurrency.value?.code ?? selectedCurrency.value?.currency_code ?? 'foreign currency'
}
async function loadLatestRate(currencyId) {
  latestRate.value = null
  rateError.value = ''
  if (!currencyId) return
  rateLoading.value = true
  try {
    const response = await rateService.latest({ currency_id: currencyId })
    const rows = records(response)
    const row = rows.find(item => String(item?.currency_id ?? item?.currency?.id ?? '') === String(currencyId)) ?? rows[0] ?? null
    if (!row) {
      rateError.value = 'No latest exchange rate is available for this currency.'
      return
    }
    latestRate.value = row
    const raw = form.transaction_type === 'BUY' ? row.buy_rate ?? row.buyRate : row.sell_rate ?? row.sellRate
    const rate = Number(raw)
    if (!Number.isFinite(rate) || rate <= 0) {
      rateError.value = 'The latest ' + form.transaction_type.toLowerCase() + ' rate is missing or invalid for this currency.'
      latestRate.value = null
    }
  } catch (error) {
    rateError.value = error?.message || 'Unable to fetch the latest exchange rate for the selected currency.'
  } finally {
    rateLoading.value = false
  }
}
watch(() => form.currency_id, currencyId => loadLatestRate(currencyId))
watch(() => form.transaction_type, async type => {
  if (!latestRate.value) return
  const raw = type === 'BUY' ? latestRate.value.buy_rate ?? latestRate.value.buyRate : latestRate.value.sell_rate ?? latestRate.value.sellRate
  const rate = Number(raw)
  if (!Number.isFinite(rate) || rate <= 0) await loadLatestRate(form.currency_id)
  else rateError.value = ''
})
onMounted(async () => {
  loading.value = true
  loadError.value = ''
  serviceFeeLoading.value = true
  serviceFeeError.value = ''
  try {
    const results = await Promise.allSettled([apiRequest('reference-currencies'), apiRequest('/service-fees')])
    const [currencyResult, serviceFeeResult] = results
    if (currencyResult.status === 'fulfilled') currencies.value = records(currencyResult.value)
    if (serviceFeeResult.status === 'fulfilled') {
      serviceFees.value = records(serviceFeeResult.value)
      const forexFee = serviceFees.value.find(item => item?.service_charge_type === 'FOREX_TRANSACTION')
      const percent = Number(forexFee?.service_charge_percent)
      if (Number.isFinite(percent) && percent >= 0) form.service_fee = String(percent)
      else serviceFeeError.value = 'No valid FOREX_TRANSACTION service fee was returned; enter the fee manually.'
    } else {
      serviceFeeError.value = serviceFeeResult.reason?.message || 'Unable to fetch service fees; enter the fee manually.'
    }
    if (currencyResult.status === 'rejected') loadError.value = currencyResult.reason?.message || 'Unable to load currencies. Check API connectivity and permissions.'
  } catch (error) {
    loadError.value = error?.message || 'Unable to load trade reference data.'
  } finally {
    loading.value = false
    serviceFeeLoading.value = false
  }
})
async function submit() {
  if (saving.value) return
  if (!latestRate.value || rateValue.value == null) {
    toast.error('Select a currency with an available latest exchange rate before submitting.')
    return
  }
  const customer = {
    fullname: form.fullname.trim(),
    nationality: form.nationality.trim(),
    phone_number: form.phone_number.trim(),
    id_or_passport_number: form.id_or_passport_number.trim(),
  }
  if (form.transaction_type === 'SELL') {
    customer.city = form.city.trim()
    customer.sub_city = form.sub_city.trim()
    customer.wereda = form.wereda.trim()
  }
  const payload = {
    customer,
    currency_id: form.currency_id,
    transaction_type: form.transaction_type,
    rate: rateValue.value,
    fcy_amount: Number(form.fcy_amount),
    payment_method: form.payment_method.trim().toUpperCase(),
    service_fee: Number(form.service_fee),
  }
  if (!customer.fullname || !customer.nationality || !customer.phone_number || !customer.id_or_passport_number ||
      !payload.currency_id || !payload.payment_method ||
      !Number.isFinite(payload.rate) || payload.rate <= 0 ||
      !Number.isFinite(payload.fcy_amount) || payload.fcy_amount <= 0 ||
      !Number.isFinite(payload.service_fee) || payload.service_fee < 0) {
    toast.error('Complete the customer, currency, payment and valid amount, rate and service fee fields.')
    return
  }
  if (payload.transaction_type === 'SELL' && (!customer.city || !customer.sub_city || !customer.wereda)) {
    toast.error('City, sub-city and wereda are required for SELL transactions.')
    return
  }
  saving.value = true
  try {
    await forexTransactionService.create(payload)
    toast.success('Forex transaction recorded successfully.')
    router.push('/trades')
  } catch (error) {
    toast.error(error?.message || 'Unable to record forex transaction.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="module-page trading-desk-page">
    <div class="module-page-intro trading-desk-heading">
      <div><h2>Trading Desk</h2><p class="trade-form-subtitle">Enter customer details directly for this transaction.</p></div>
      <BaseButton variant="secondary" class="module-secondary-btn" @click="router.push('/trades')">← Back to trades</BaseButton>
    </div>
    <div class="trade-side-switch" role="group" aria-label="Transaction type">
      <button type="button" class="trade-side-button trade-buy-button" :class="{ 'is-active': form.transaction_type === 'BUY' }" :aria-pressed="form.transaction_type === 'BUY'" @click="form.transaction_type = 'BUY'">BUY</button>
      <button type="button" class="trade-side-button trade-sell-button" :class="{ 'is-active': form.transaction_type === 'SELL' }" :aria-pressed="form.transaction_type === 'SELL'" @click="form.transaction_type = 'SELL'">SELL</button>
    </div>
    <BaseCard as="form" class="module-panel module-form-panel trading-desk-form" @submit.prevent="submit">
      <div v-if="loading" class="trade-loading">Loading currencies…</div>
      <div v-if="loadError" class="module-form-field" role="status"><p>{{ loadError }}</p><BaseButton type="button" variant="secondary" @click="router.go(0)">Reload</BaseButton></div>
      <section class="trade-form-section">
        <div class="trade-form-section-heading"><h3>Customer details</h3><p>Customer information is recorded with this trade; no existing customer profile is required.</p></div>
        <div class="module-form-grid">
          <div class="module-form-field"><BaseInput v-model="form.fullname" label="Full name" id="trade-customer-fullname" autocomplete="name" required /></div>
          <div class="module-form-field"><BaseInput v-model="form.nationality" label="Nationality" id="trade-customer-nationality" required /></div>
          <div class="module-form-field"><BaseInput v-model="form.phone_number" label="Phone number" id="trade-customer-phone" type="tel" autocomplete="tel" required /></div>
          <div class="module-form-field"><BaseInput v-model="form.id_or_passport_number" label="ID or passport number" id="trade-customer-id" required /></div>
          <template v-if="form.transaction_type === 'SELL'">
            <div class="module-form-field"><BaseInput v-model="form.city" label="City" id="trade-customer-city" required /></div>
            <div class="module-form-field"><BaseInput v-model="form.sub_city" label="Sub-city" id="trade-customer-sub-city" required /></div>
            <div class="module-form-field"><BaseInput v-model="form.wereda" label="Wereda" id="trade-customer-wereda" required /></div>
          </template>
        </div>
      </section>
      <section class="trade-form-section">
        <div class="trade-form-section-heading"><h3>Transaction details</h3></div>
        <div class="module-form-grid">
          <div class="module-form-field"><label for="currency">Currency</label><SearchableSelect id="currency" v-model="form.currency_id" :options="currencyOptions" placeholder="Search currency" aria-label="Currency" required /></div>
          <div class="module-form-field"><BaseInput v-model="form.fcy_amount" :label="'FCY amount (' + currencyCode() + ')'" id="fcy-amount" type="number" min="0.000001" step="any" required /></div>
          <div class="module-form-field"><BaseInput :model-value="rateValue == null ? '' : String(rateValue)" label="Rate" id="trade-rate" type="number" readonly /></div>
          <div class="module-form-field"><label for="payment-method">Payment method</label><select id="payment-method" v-model="form.payment_method" class="ui-input" required><option value="CASH">CASH</option></select></div>
          <div class="module-form-field"><BaseInput v-model="form.service_fee" label="Service fee (%)" id="trade-service-fee" type="number" min="0" step="any" required /><p v-if="serviceFeeLoading" class="trade-rate-status">Fetching default service fee…</p><p v-else-if="serviceFeeError" class="trade-rate-error" role="status">{{ serviceFeeError }}</p><p v-else class="trade-rate-status">Defaulted from FOREX_TRANSACTION service fee; you can edit it.</p></div>
        </div>
      </section>
      <div class="trade-rate-feedback">
        <p v-if="rateLoading" class="trade-rate-status">Updating rate…</p>
        <p v-if="rateError" class="trade-rate-error" role="alert">{{ rateError }}</p>
        <div v-if="form.currency_id && latestRate" class="trade-rate-badges" aria-live="polite">
          <span class="trade-rate-badge" :class="{ 'trade-rate-badge-active-buy': form.transaction_type === 'BUY' }"><span>BUY RATE</span><strong>{{ buyRate == null ? '—' : formatMoney(buyRate) + ' ETB' }}</strong></span>
          <span class="trade-rate-badge" :class="{ 'trade-rate-badge-active-sell': form.transaction_type === 'SELL' }"><span>SELL RATE</span><strong>{{ sellRate == null ? '—' : formatMoney(sellRate) + ' ETB' }}</strong></span>
          <span v-if="latestRate.rate_date" class="trade-rate-date">Rate date: {{ latestRate.rate_date }}</span>
        </div>
        <div v-if="form.currency_id && latestRate && rateValue != null" class="trade-etb-calculation" aria-live="polite">
          <div class="trade-calculation-line"><span>{{ form.transaction_type }} · {{ currencyCode() }}</span><strong>1 {{ currencyCode() }} = {{ formatMoney(rateValue) }} ETB</strong></div>
          <div class="trade-calculation-line"><span>ETB equivalent</span><strong class="trade-etb-total">{{ etbAmount == null ? '—' : formatMoney(etbAmount) + ' ETB' }}</strong></div>
        </div>
      </div>
      <div class="module-form-footer"><span></span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" @click="router.push('/trades')">Cancel</BaseButton><BaseButton v-if="hasAnyPermission(['forex_transactions.create', 'forex_transactions:create'])" type="submit" class="module-primary-btn" :disabled="saving || loading || rateLoading || !latestRate || rateValue == null">{{ saving ? 'Submitting…' : (form.transaction_type === 'BUY' ? 'Confirm BUY' : 'Confirm SELL') }}</BaseButton></div></div>
    </BaseCard>
  </section>
</template>
<style scoped>
.trading-desk-heading{align-items:center;margin-bottom:16px}.trading-desk-heading h2{margin:0}.trade-form-subtitle{margin:6px 0 0;color:var(--text-muted,#778196);font-size:.9rem}
.trade-side-switch{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px}.trade-side-button{min-height:48px;border:1px solid var(--border-color,#d9e0ea);border-radius:10px;background:var(--surface-color,#fff);font-weight:800;letter-spacing:.04em;cursor:pointer;transition:background .15s,border-color .15s,color .15s}.trade-buy-button.is-active{background:#e8f7ee;border-color:#218653;color:#17663f}.trade-sell-button.is-active{background:#fff0ef;border-color:#c83b36;color:#a52c28}
.trading-desk-form{padding-top:20px}.trade-loading,.trade-rate-status{color:var(--text-muted,#778196);font-size:.85rem}.trade-form-section{padding:0 24px 22px;margin-bottom:22px;border-bottom:1px solid var(--border-color,#e5e9ef)}.trade-form-section-heading{margin-bottom:15px}.trade-form-section-heading h3{margin:0;font-size:1rem}.trade-form-section-heading p{margin:5px 0 0;color:var(--text-muted,#778196);font-size:.82rem}.trade-rate-badges{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 12px}.trade-rate-badge{display:inline-flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border-color,#dfe5ed);border-radius:8px;background:var(--surface-subtle,#f8fafc);color:var(--text-primary,#263449)}.trade-rate-badge span{font-size:.7rem;font-weight:800;letter-spacing:.04em;color:var(--text-muted,#778196)}.trade-rate-badge strong{font-size:.88rem;font-variant-numeric:tabular-nums}.trade-rate-badge-active-buy{background:#e8f7ee;border-color:#218653;color:#17663f}.trade-rate-badge-active-sell{background:#fff0ef;border-color:#c83b36;color:#a52c28}.trade-rate-date{font-size:.78rem;color:var(--text-muted,#778196)}.trade-rate-feedback{margin:0 24px 20px}.trade-rate-error{color:#b4232f;margin:0 0 12px}.trade-etb-calculation{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px;border:1px solid var(--border-color,#e3e8f0);border-radius:12px;background:var(--surface-subtle,#f8fafc)}.trade-calculation-line{display:flex;flex-direction:column;gap:6px;min-width:0}.trade-calculation-line span{color:var(--text-muted,#778196);font-size:.78rem}.trade-calculation-line strong{color:var(--text-primary,#263449);font-size:.95rem;overflow-wrap:anywhere}.trade-calculation-line .trade-etb-total{font-size:1.15rem;color:var(--color-primary,#2357a5)}
@media(max-width:640px){.trade-form-section{padding-left:16px;padding-right:16px}.trade-etb-calculation{grid-template-columns:1fr}.trade-rate-badges{align-items:flex-start}}
</style>

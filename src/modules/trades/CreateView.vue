<script setup>
import { hasAnyPermission } from '../../utils/permissions'
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

const router = useRouter()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const customers = ref([])
const currencies = ref([])
const sessions = ref([])
const latestRate = ref(null)
const rateLoading = ref(false)
const rateError = ref('')
const form = reactive({
  customer_profile_id: '',
  till_session_id: '',
  currency_id: '',
  transaction_type: 'BUY',
  applied_rate: '',
  foreign_amount: '100',
})

function records(response) {
  let value = response?.data ?? response
  if (value && !Array.isArray(value) && typeof value === 'object') {
    value = value.data ?? value.results ?? value.items ?? value.records ?? value.customer_profiles ?? value.reference_currencies ?? value.exchange_rates ?? value.till_sessions ?? []
  }
  if (value && !Array.isArray(value) && typeof value === 'object') value = [value]
  return Array.isArray(value) ? value : []
}
function idOf(item) {
  return item?.id ?? item?.customer_profile_id ?? item?.currency_id ?? item?.till_session_id ?? item?.uuid ?? ''
}
function labelOf(item, kind) {
  if (kind === 'customer') {
    const name = [item.full_name, item.customer_name, item.name, item.first_name && [item.first_name, item.last_name].filter(Boolean).join(' ')].find(Boolean)
    return [name, item.phone_number ?? item.phone, item.email].filter(Boolean).join(' · ') || 'Unnamed customer'
  }
  if (kind === 'currency') {
    return [item.code, item.currency_code, item.name, item.currency_name].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).join(' · ') || 'Unnamed currency'
  }
  return [item.till_name, item.session_name, item.name, item.status, item.opened_at].filter(Boolean).join(' · ') || 'Till session'
}
function options(items, kind) {
  return items.map(item => ({ value: String(idOf(item)), label: labelOf(item, kind), raw: item })).filter(item => item.value && item.label)
}
const customerOptions = computed(() => options(customers.value, 'customer'))
const currencyOptions = computed(() => options(currencies.value, 'currency'))
const sessionOptions = computed(() => options(sessions.value, 'session'))
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
  const amount = Number(form.foreign_amount)
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
  form.applied_rate = ''
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
      rateError.value = `The latest ${form.transaction_type.toLowerCase()} rate is missing or invalid for this currency.`
      latestRate.value = null
      return
    }
    form.applied_rate = String(rate)
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
  if (Number.isFinite(rate) && rate > 0) {
    form.applied_rate = String(rate)
    rateError.value = ''
  } else {
    await loadLatestRate(form.currency_id)
  }
})
onMounted(async () => {
  loading.value = true
  loadError.value = ''
  try {
    const results = await Promise.allSettled([
      apiRequest('customer-profiles'),
      apiRequest('reference-currencies'),
      apiRequest('/till-sessions'),
    ])
    const [customerResult, currencyResult, sessionResult] = results
    if (customerResult.status === 'fulfilled') customers.value = records(customerResult.value)
    if (currencyResult.status === 'fulfilled') currencies.value = records(currencyResult.value)
    if (sessionResult.status === 'fulfilled') sessions.value = records(sessionResult.value)
    const failures = results.filter(result => result.status === 'rejected')
    if (failures.length) loadError.value = 'Some reference data could not be loaded. Check API connectivity and permissions, then retry.'
  } catch (error) {
    loadError.value = error?.message || 'Unable to load trade reference data.'
  } finally {
    loading.value = false
  }
})
async function submit() {
  if (saving.value) return
  if (!latestRate.value || rateValue.value == null) {
    toast.error('Select a currency with an available latest exchange rate before submitting.')
    return
  }
  const payload = {
    customer_profile_id: form.customer_profile_id,
    till_session_id: form.till_session_id,
    currency_id: form.currency_id,
    transaction_type: form.transaction_type,
    applied_rate: rateValue.value,
    foreign_amount: Number(form.foreign_amount),
  }
  if (!payload.customer_profile_id || !payload.till_session_id || !payload.currency_id ||
      !Number.isFinite(payload.applied_rate) || payload.applied_rate <= 0 ||
      !Number.isFinite(payload.foreign_amount) || payload.foreign_amount <= 0) {
    toast.error('Select a customer, till session and currency, and enter a valid positive amount with a valid latest rate.')
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
      <div><h2>Trading Desk</h2></div>
      <BaseButton variant="secondary" class="module-secondary-btn" @click="router.push('/trades')">← Back to trades</BaseButton>
    </div>

    <div class="trade-side-switch" role="group" aria-label="Transaction type">
      <button type="button" class="trade-side-button trade-buy-button" :class="{ 'is-active': form.transaction_type === 'BUY' }" :aria-pressed="form.transaction_type === 'BUY'" @click="form.transaction_type = 'BUY'">BUY</button>
      <button type="button" class="trade-side-button trade-sell-button" :class="{ 'is-active': form.transaction_type === 'SELL' }" :aria-pressed="form.transaction_type === 'SELL'" @click="form.transaction_type = 'SELL'">SELL</button>
    </div>

    <BaseCard as="form" class="module-panel module-form-panel trading-desk-form" @submit.prevent="submit">
      <div v-if="loading" class="trade-loading">Loading…</div>
      <div v-if="loadError" class="module-form-field" role="status"><p>{{ loadError }}</p><BaseButton type="button" variant="secondary" @click="router.go(0)">Reload</BaseButton></div>

      <div class="module-form-grid">
        <div class="module-form-field"><label for="customer-profile">Customer</label><SearchableSelect id="customer-profile" v-model="form.customer_profile_id" :options="customerOptions" placeholder="Search customer" aria-label="Customer" required /></div>
        <div class="module-form-field"><label for="till-session">Till session</label><SearchableSelect id="till-session" v-model="form.till_session_id" :options="sessionOptions" placeholder="Select till session" aria-label="Till session" required /></div>
        <div class="module-form-field"><label for="currency">Currency</label><SearchableSelect id="currency" v-model="form.currency_id" :options="currencyOptions" placeholder="Search currency" aria-label="Currency" required /></div>
        <div class="module-form-field"><BaseInput v-model="form.foreign_amount" :label="`Amount (${currencyCode()})`" id="foreign-amount" type="number" min="0.000001" step="any" required /></div>
      </div>

      <div class="trade-rate-feedback">
        <p v-if="rateLoading" class="trade-rate-status">Updating rates…</p>
        <p v-if="rateError" class="trade-rate-error" role="alert">{{ rateError }}</p>
        <div v-if="form.currency_id && latestRate" class="trade-rate-badges" aria-live="polite">
          <span class="trade-rate-badge" :class="{ 'trade-rate-badge-active-buy': form.transaction_type === 'BUY' }">
            <span>BUY RATE</span><strong>{{ buyRate == null ? '—' : formatMoney(buyRate) + ' ETB' }}</strong>
          </span>
          <span class="trade-rate-badge" :class="{ 'trade-rate-badge-active-sell': form.transaction_type === 'SELL' }">
            <span>SELL RATE</span><strong>{{ sellRate == null ? '—' : formatMoney(sellRate) + ' ETB' }}</strong>
          </span>
          <span v-if="latestRate.rate_date" class="trade-rate-date">Rate date: {{ latestRate.rate_date }}</span>
        </div>
        <div v-if="form.currency_id && latestRate && rateValue != null" class="trade-etb-calculation" aria-live="polite">
          <div class="trade-calculation-line"><span>{{ form.transaction_type }} · {{ currencyCode() }}</span><strong>1 {{ currencyCode() }} = {{ formatMoney(rateValue) }} ETB</strong></div>
          <div class="trade-calculation-line"><span>ETB equivalent</span><strong class="trade-etb-total">{{ etbAmount == null ? '—' : formatMoney(etbAmount) + ' ETB' }}</strong></div>
        </div>
      </div>

      <p v-if="!loading && !customerOptions.length" class="module-form-hint">No customers available.</p>
      <div class="module-form-footer"><span></span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" @click="router.push('/trades')">Cancel</BaseButton><BaseButton v-if="hasAnyPermission(['forex_transactions.create', 'forex_transactions:create'])" type="submit" class="module-primary-btn" :disabled="saving || loading || rateLoading || !latestRate || rateValue == null">{{ saving ? 'Submitting…' : (form.transaction_type === 'BUY' ? 'Confirm BUY' : 'Confirm SELL') }}</BaseButton></div></div>
    </BaseCard>
  </section>
</template>

<style scoped>
.trading-desk-heading { align-items:center; margin-bottom:16px; }
.trading-desk-heading h2 { margin:0; }
.trade-side-switch { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px; }
.trade-side-button { min-height:48px;border:1px solid var(--border-color,#d9e0ea);border-radius:10px;background:var(--surface-color,#fff);font-weight:800;letter-spacing:.04em;cursor:pointer;transition:background .15s,border-color .15s,color .15s; }
.trade-buy-button.is-active { background:#e8f7ee;border-color:#218653;color:#17663f; }
.trade-sell-button.is-active { background:#fff0ef;border-color:#c83b36;color:#a52c28; }
.trading-desk-form { padding-top:20px; }
.trade-loading,.trade-rate-status { color:var(--text-muted,#778196);font-size:.85rem; }
.trade-rate-badges { display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 12px; }
.trade-rate-badge { display:inline-flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border-color,#dfe5ed);border-radius:8px;background:var(--surface-subtle,#f8fafc);color:var(--text-primary,#263449); }
.trade-rate-badge span { font-size:.7rem;font-weight:800;letter-spacing:.04em;color:var(--text-muted,#778196); }
.trade-rate-badge strong { font-size:.88rem;font-variant-numeric:tabular-nums; }
.trade-rate-badge-active-buy { background:#e8f7ee;border-color:#218653;color:#17663f; }
.trade-rate-badge-active-sell { background:#fff0ef;border-color:#c83b36;color:#a52c28; }
.trade-rate-date { font-size:.78rem;color:var(--text-muted,#778196); }
.trade-rate-feedback { margin:0 24px 20px; }
.trade-rate-error { color:#b4232f;margin:0 0 12px; }
.trade-etb-calculation { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px;border:1px solid var(--border-color,#e3e8f0);border-radius:12px;background:var(--surface-subtle,#f8fafc); }
.trade-calculation-line { display:flex;flex-direction:column;gap:6px;min-width:0; }
.trade-calculation-line span { color:var(--text-muted,#778196);font-size:.78rem; }
.trade-calculation-line strong { color:var(--text-primary,#263449);font-size:.95rem;overflow-wrap:anywhere; }
.trade-calculation-line .trade-etb-total { font-size:1.15rem;color:var(--color-primary,#2357a5); }
@media(max-width:640px) { .trade-etb-calculation { grid-template-columns:1fr; } .trade-rate-badges { align-items:flex-start; } }
</style>

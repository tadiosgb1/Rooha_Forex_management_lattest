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
const exchangeRates = ref([])
const serviceFees = ref([])
const serviceFeeLoading = ref(false)
const serviceFeeError = ref('')
const countryOpen = ref(false)
const countrySearch = ref('')
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
  rate_id: '',
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

const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countryOptions = computed(() => countryCodes
  .map(code => ({ code, name: countryNames.of(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name)))
const filteredCountries = computed(() => {
  const query = countrySearch.value.trim().toLowerCase()
  return query ? countryOptions.value.filter(country => country.name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query)) : countryOptions.value
})
const selectedCountry = computed(() => countryOptions.value.find(country => country.name === form.nationality) || null)
function chooseCountry(country) {
  form.nationality = country.name
  countryOpen.value = false
  countrySearch.value = ''
}
const selectedRate = computed(() => exchangeRates.value.find(item => String(item?.id ?? '') === String(form.rate_id)) ?? null)
const selectedCurrency = computed(() => selectedRate.value?.currency ?? null)
const currencyOptions = computed(() => exchangeRates.value.map(item => {
  const currency = item?.currency ?? {}
  const code = currency.code ?? currency.currency_code ?? item?.currency_code ?? 'FCY'
  const buy = Number(item?.buy_rate ?? item?.buyRate)
  const sell = Number(item?.sell_rate ?? item?.sellRate)
  const buyLabel = Number.isFinite(buy) && buy > 0 ? formatMoney(buy) : '—'
  const sellLabel = Number.isFinite(sell) && sell > 0 ? formatMoney(sell) : '—'
  return { value: String(item?.id ?? ''), label: `${code} · BUY ${buyLabel} · SELL ${sellLabel} · ${item?.rate_date ?? 'Latest'}` }
}).filter(option => option.value))
const buyRate = computed(() => {
  const value = Number(selectedRate.value?.buy_rate ?? selectedRate.value?.buyRate)
  return Number.isFinite(value) && value > 0 ? value : null
})
const sellRate = computed(() => {
  const value = Number(selectedRate.value?.sell_rate ?? selectedRate.value?.sellRate)
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
  return selectedCurrency.value?.code ?? selectedCurrency.value?.currency_code ?? selectedRate.value?.currency_code ?? 'foreign currency'
}
function validateSelectedRate() {
  if (!selectedRate.value) {
    rateError.value = 'Select an approved exchange rate before continuing.'
    return false
  }
  const rate = form.transaction_type === 'BUY' ? buyRate.value : sellRate.value
  if (rate == null) {
    rateError.value = `The selected rate has no valid ${form.transaction_type.toLowerCase()} price.`
    return false
  }
  rateError.value = ''
  return true
}
watch(() => form.rate_id, validateSelectedRate)
watch(() => form.transaction_type, validateSelectedRate)
onMounted(async () => {
  loading.value = true
  loadError.value = ''
  serviceFeeLoading.value = true
  serviceFeeError.value = ''
  try {
    const results = await Promise.allSettled([rateService.latest(), apiRequest('/service-fees')])
    const [rateResult, serviceFeeResult] = results
    if (rateResult.status === 'fulfilled') {
      exchangeRates.value = records(rateResult.value).filter(item => item?.is_active !== false && (!item?.status || String(item.status).toUpperCase() === 'APPROVED'))
      if (!exchangeRates.value.length) rateError.value = 'No approved active exchange rates are currently available.'
    } else {
      rateError.value = rateResult.reason?.message || 'Unable to load the latest exchange rates.'
    }
    if (serviceFeeResult.status === 'fulfilled') {
      serviceFees.value = records(serviceFeeResult.value)
      const forexFee = serviceFees.value.find(item => item?.service_charge_type === 'FOREX_TRANSACTION')
      const percent = Number(forexFee?.service_charge_percent)
      if (Number.isFinite(percent) && percent >= 0) form.service_fee = String(percent)
      else serviceFeeError.value = 'No valid FOREX_TRANSACTION service fee was returned; enter the fee manually.'
    } else {
      serviceFeeError.value = serviceFeeResult.reason?.message || 'Unable to fetch service fees; enter the fee manually.'
    }
    if (rateResult.status === 'rejected') loadError.value = rateResult.reason?.message || 'Unable to load exchange rates. Check API connectivity and permissions.'
  } catch (error) {
    loadError.value = error?.message || 'Unable to load trade reference data.'
  } finally {
    loading.value = false
    serviceFeeLoading.value = false
  }
})
async function submit() {
  if (saving.value) return
  if (!selectedRate.value || !validateSelectedRate() || rateValue.value == null) {
    toast.error('Select an approved exchange rate with a valid ' + form.transaction_type.toLowerCase() + ' price before submitting.')
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
    currency_id: selectedRate.value.currency_id ?? selectedRate.value.currency?.id,
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
    const response = await forexTransactionService.create(payload)
    const record = response?.data?.transaction ?? response?.data?.forex_transaction ?? response?.data?.record ?? response?.data ?? response?.transaction ?? response?.forex_transaction ?? response?.record ?? response
    const transactionId = record?.id ?? record?.forex_transaction_id ?? record?.transaction_id ?? record?.uuid
    toast.success('Forex transaction recorded successfully. Your receipt is ready.')
    if (transactionId != null && String(transactionId).trim()) {
      router.push({ name: 'trades-receipt', params: { id: String(transactionId) } })
    } else {
      toast.error('The transaction was saved, but the API did not return an ID. Open the transaction register to print its receipt.')
      router.push('/trades')
    }
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
    <div class="trade-side-switch" role="tablist" aria-label="Trade actions">
      <button type="button" role="tab" class="trade-side-button trade-sell-button" :class="{ 'is-active': form.transaction_type === 'SELL' }" :aria-selected="form.transaction_type === 'SELL'" @click="form.transaction_type = 'SELL'">SELL</button>
      <button type="button" role="tab" class="trade-side-button trade-buy-button" :class="{ 'is-active': form.transaction_type === 'BUY' }" :aria-selected="form.transaction_type === 'BUY'" @click="form.transaction_type = 'BUY'">BUY</button>
      <button type="button" role="tab" class="trade-side-button trade-report-button" aria-selected="false" @click="router.push('/trades')">REPORT</button>
    </div>
    <BaseCard as="form" class="module-panel module-form-panel trading-desk-form" @submit.prevent="submit">
      <div v-if="loading" class="trade-loading">Loading approved exchange rates…</div>
      <div v-if="loadError" class="module-form-field" role="status"><p>{{ loadError }}</p><BaseButton type="button" variant="secondary" @click="router.go(0)">Reload</BaseButton></div>
      <section class="trade-form-section">
        <div class="trade-form-section-heading"><h3>Customer details</h3><p>Customer information is recorded with this trade; no existing customer profile is required.</p></div>
        <div class="module-form-grid">
          <div class="module-form-field"><BaseInput v-model="form.fullname" label="Full name" id="trade-customer-fullname" autocomplete="name" required /></div>
          <div class="module-form-field nationality-field">
            <label id="trade-customer-nationality-label">Nationality</label>
            <button type="button" class="ui-input nationality-trigger" aria-labelledby="trade-customer-nationality-label" :aria-expanded="countryOpen" @click="countryOpen = !countryOpen">
              <span v-if="selectedCountry" class="nationality-selected"><span class="fi" :class="'fi-' + selectedCountry.code.toLowerCase()" aria-hidden="true"></span>{{ selectedCountry.name }}</span>
              <span v-else>Select nationality</span><span class="nationality-chevron">▾</span>
            </button>
            <div v-if="countryOpen" class="nationality-menu">
              <input v-model="countrySearch" class="ui-input nationality-search" type="search" placeholder="Search countries…" aria-label="Search countries" autofocus />
              <div class="nationality-options" role="listbox" aria-label="Countries">
                <button v-for="country in filteredCountries" :key="country.code" type="button" class="nationality-option" :class="{ 'is-selected': form.nationality === country.name }" role="option" :aria-selected="form.nationality === country.name" @click="chooseCountry(country)">
                  <span class="fi" :class="'fi-' + country.code.toLowerCase()" aria-hidden="true"></span><span>{{ country.name }}</span><small>{{ country.code }}</small>
                </button>
                <p v-if="!filteredCountries.length" class="nationality-empty">No matching country found.</p>
              </div>
            </div>
          </div>
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
          <div class="module-form-field"><label for="exchange-rate">Approved exchange rate</label><SearchableSelect id="exchange-rate" v-model="form.rate_id" :options="currencyOptions" placeholder="Select a rate (currency and prices)" aria-label="Approved exchange rate" required /><p class="trade-rate-status">Rates are loaded once from the latest backend list. Choose the exact rate record to use.</p></div>
          <div class="module-form-field"><BaseInput v-model="form.fcy_amount" :label="'FCY amount (' + currencyCode() + ')'" id="fcy-amount" type="number" min="0.000001" step="any" required /></div>
          <div class="module-form-field"><BaseInput :model-value="rateValue == null ? '' : String(rateValue)" label="Rate" id="trade-rate" type="number" readonly /></div>
          <div class="module-form-field"><label for="payment-method">Payment method</label><select id="payment-method" v-model="form.payment_method" class="ui-input" required>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="MOBILE_MONEY">Mobile money</option>
              <option value="CARD">Card</option>
            </select></div>
          <div class="module-form-field"><BaseInput v-model="form.service_fee" label="Service fee (%)" id="trade-service-fee" type="number" min="0" step="any" required /><p v-if="serviceFeeLoading" class="trade-rate-status">Fetching default service fee…</p><p v-else-if="serviceFeeError" class="trade-rate-error" role="status">{{ serviceFeeError }}</p><p v-else class="trade-rate-status">Defaulted from FOREX_TRANSACTION service fee; you can edit it.</p></div>
        </div>
      </section>
      <div class="trade-rate-feedback">
        <p v-if="rateLoading" class="trade-rate-status">Updating rate…</p>
        <p v-if="rateError" class="trade-rate-error" role="alert">{{ rateError }}</p>
        <div v-if="selectedRate" class="trade-rate-badges" aria-live="polite">
          <span class="trade-rate-badge" :class="{ 'trade-rate-badge-active-buy': form.transaction_type === 'BUY' }"><span>BUY RATE</span><strong>{{ buyRate == null ? '—' : formatMoney(buyRate) + ' ETB' }}</strong></span>
          <span class="trade-rate-badge" :class="{ 'trade-rate-badge-active-sell': form.transaction_type === 'SELL' }"><span>SELL RATE</span><strong>{{ sellRate == null ? '—' : formatMoney(sellRate) + ' ETB' }}</strong></span>
          <span v-if="selectedRate.rate_date" class="trade-rate-date">Rate date: {{ selectedRate.rate_date }}</span>
        </div>
        <div v-if="selectedRate && rateValue != null" class="trade-etb-calculation" aria-live="polite">
          <div class="trade-calculation-line"><span>{{ form.transaction_type }} · {{ currencyCode() }}</span><strong>1 {{ currencyCode() }} = {{ formatMoney(rateValue) }} ETB</strong></div>
          <div class="trade-calculation-line"><span>ETB equivalent</span><strong class="trade-etb-total">{{ etbAmount == null ? '—' : formatMoney(etbAmount) + ' ETB' }}</strong></div>
        </div>
      </div>
      <div class="module-form-footer"><span></span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" @click="router.push('/trades')">Cancel</BaseButton><BaseButton v-if="hasAnyPermission(['forex_transactions.create', 'forex_transactions:create'])" type="submit" class="module-primary-btn" :disabled="saving || loading || rateLoading || !selectedRate || rateValue == null">{{ saving ? 'Submitting…' : (form.transaction_type === 'BUY' ? 'Confirm BUY' : 'Confirm SELL') }}</BaseButton></div></div>
    </BaseCard>
  </section>
</template>
<style scoped>
.nationality-field{position:relative}.nationality-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;cursor:pointer}.nationality-selected{display:flex;align-items:center;gap:10px}.nationality-selected .fi,.nationality-option .fi{width:1.35rem;height:1rem;flex:none;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.08)}.nationality-chevron{color:var(--text-muted,#778196)}.nationality-menu{position:absolute;z-index:30;top:calc(100% + 5px);left:0;right:0;padding:8px;background:var(--surface-color,#fff);border:1px solid var(--border-color,#d9e0ea);border-radius:10px;box-shadow:0 12px 30px rgba(20,30,50,.16)}.nationality-search{width:100%;margin-bottom:7px}.nationality-options{max-height:260px;overflow-y:auto}.nationality-option{display:flex;align-items:center;gap:10px;width:100%;padding:9px 8px;border:0;border-radius:6px;background:transparent;color:var(--text-primary,#263449);text-align:left;cursor:pointer}.nationality-option:hover,.nationality-option.is-selected{background:var(--surface-subtle,#f1f5f9)}.nationality-option small{margin-left:auto;color:var(--text-muted,#778196)}.nationality-empty{padding:10px;color:var(--text-muted,#778196);font-size:.85rem}.trading-desk-heading{align-items:center;margin-bottom:16px}.trading-desk-heading h2{margin:0}.trade-form-subtitle{margin:6px 0 0;color:var(--text-muted,#778196);font-size:.9rem}
.trade-side-switch{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 16px;padding:6px;border:1px solid var(--border-color,#d9e0ea);border-radius:14px;background:var(--surface-subtle,#f5f7fa)}.trade-side-button{min-height:46px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--text-muted,#778196);font-weight:800;letter-spacing:.06em;cursor:pointer;transition:background .15s,border-color .15s,color .15s,box-shadow .15s}.trade-side-button:hover{background:var(--surface-color,#fff);color:var(--text-primary,#263449)}.trade-buy-button.is-active{background:#e8f7ee;border-color:#218653;color:#17663f;box-shadow:0 2px 8px rgba(33,134,83,.12)}.trade-sell-button.is-active{background:#fff0ef;border-color:#c83b36;color:#a52c28;box-shadow:0 2px 8px rgba(200,59,54,.12)}.trade-report-button{color:var(--text-muted,#778196)}
.trading-desk-form{padding-top:20px}.trade-loading,.trade-rate-status{color:var(--text-muted,#778196);font-size:.85rem}.trade-form-section{padding:0 24px 22px;margin-bottom:22px;border-bottom:1px solid var(--border-color,#e5e9ef)}.trade-form-section-heading{margin-bottom:15px}.trade-form-section-heading h3{margin:0;font-size:1rem}.trade-form-section-heading p{margin:5px 0 0;color:var(--text-muted,#778196);font-size:.82rem}.trade-rate-badges{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 12px}.trade-rate-badge{display:inline-flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border-color,#dfe5ed);border-radius:8px;background:var(--surface-subtle,#f8fafc);color:var(--text-primary,#263449)}.trade-rate-badge span{font-size:.7rem;font-weight:800;letter-spacing:.04em;color:var(--text-muted,#778196)}.trade-rate-badge strong{font-size:.88rem;font-variant-numeric:tabular-nums}.trade-rate-badge-active-buy{background:#e8f7ee;border-color:#218653;color:#17663f}.trade-rate-badge-active-sell{background:#fff0ef;border-color:#c83b36;color:#a52c28}.trade-rate-date{font-size:.78rem;color:var(--text-muted,#778196)}.trade-rate-feedback{margin:0 24px 20px}.trade-rate-error{color:#b4232f;margin:0 0 12px}.trade-etb-calculation{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px;border:1px solid var(--border-color,#e3e8f0);border-radius:12px;background:var(--surface-subtle,#f8fafc)}.trade-calculation-line{display:flex;flex-direction:column;gap:6px;min-width:0}.trade-calculation-line span{color:var(--text-muted,#778196);font-size:.78rem}.trade-calculation-line strong{color:var(--text-primary,#263449);font-size:.95rem;overflow-wrap:anywhere}.trade-calculation-line .trade-etb-total{font-size:1.15rem;color:var(--color-primary,#2357a5)}
@media(max-width:640px){.trade-form-section{padding-left:16px;padding-right:16px}.trade-etb-calculation{grid-template-columns:1fr}.trade-rate-badges{align-items:flex-start}}
</style>

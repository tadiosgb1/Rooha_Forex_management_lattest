<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../../services/apiClient'
import { forexTransactionService } from '../../services/forexTransactionService'
import { customerService } from '../../services/customerService'
import { rateService } from '../../services/rateService'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { useToast } from '../../composables/toast'
import { hasAnyPermission } from '../../utils/permissions'

const router = useRouter()
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://10.195.49.18:3001').replace(/\/$/, '')
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
const rateError = ref('')
const activeTab = ref('SELL')
const showTradeForm = ref(false)
const currencyLines = ref([])
const addCurrencyRateId = ref('')
const currencyLineError = ref('')
const customerSearch = ref('')
const customerMatches = ref([])
const customerSearchLoading = ref(false)
const selectedCustomerId = ref('')
const customerSearchError = ref('')
const sellPurposeOptions = ['Travel', 'Tourist Travel', 'Visit Travel', 'Training Travel', 'Business Travel', 'Medical Travel', 'Meeting Travel', 'Holiday Travel', 'Education Travel', 'Sport Travel', 'Exhibition Travel', 'Haji Travel', 'Other']
const sellPurpose = ref('Travel')
let customerSearchRequest = 0
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
  fcy_amount: '',
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
function customerId(row) { return row?.id ?? row?.customer_id ?? row?.customer_profile_id ?? row?.uuid ?? '' }
function customerName(row) { return row?.fullname ?? [row?.first_name, row?.middle_name, row?.last_name].filter(Boolean).join(' ') }
async function searchCustomers() {
  const query = customerSearch.value.trim()
  const request = ++customerSearchRequest
  selectedCustomerId.value = ''
  if (query.length < 2) { customerMatches.value = []; customerSearchError.value = ''; customerSearchLoading.value = false; return }
  customerSearchLoading.value = true
  customerSearchError.value = ''
  try {
    const response = await customerService.list({ search: query })
    if (request !== customerSearchRequest) return
    customerMatches.value = records(response).filter(row => customerId(row))
  } catch (error) {
    if (request === customerSearchRequest) customerSearchError.value = error?.message || 'Unable to search customers.'
  } finally {
    if (request === customerSearchRequest) customerSearchLoading.value = false
  }
}
function selectCustomer(row) {
  selectedCustomerId.value = String(customerId(row))
  customerSearch.value = customerName(row) || row?.phone_number || row?.phone || 'Selected customer'
  customerMatches.value = []
  form.fullname = customerName(row) || ''
  form.nationality = row?.nationality || 'Ethiopian'
  form.phone_number = row?.phone_number || row?.phone || ''
  form.id_or_passport_number = row?.id_or_passport_number || row?.id_number || ''
  form.city = row?.city || 'Addis Ababa'
  form.sub_city = row?.sub_city || ''
  form.wereda = row?.wereda || ''
}
function useNewCustomer() { selectedCustomerId.value = ''; customerSearch.value = ''; customerMatches.value = [] }
const selectedRate = computed(() => exchangeRates.value.find(item => String(item?.id ?? '') === String(form.rate_id)) ?? null)
const selectedCurrency = computed(() => selectedRate.value?.currency ?? null)
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
function flagUrl(rate) {
  const path = rate?.currency?.flag_url
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return apiBaseUrl + '/' + String(path).replace(/^\/+/, '')
}
function formatMoney(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function currencyCode() {
  return selectedCurrency.value?.code ?? selectedCurrency.value?.currency_code ?? selectedRate.value?.currency_code ?? 'foreign currency'
}
function openRateForTrade(rate) {
  form.rate_id = String(rate?.id ?? '')
  form.transaction_type = activeTab.value
  form.fcy_amount = ''
  currencyLines.value = [{ rate_id: form.rate_id, fcy_amount: '' }]
  addCurrencyRateId.value = ''
  currencyLineError.value = ''
  showTradeForm.value = true
  validateSelectedRate()
}
function rateForLine(line) {
  return exchangeRates.value.find(item => String(item?.id ?? '') === String(line.rate_id)) ?? null
}
function lineRateValue(rate) {
  const value = Number(form.transaction_type === 'BUY' ? (rate?.buy_rate ?? rate?.buyRate) : (rate?.sell_rate ?? rate?.sellRate))
  return Number.isFinite(value) && value > 0 ? value : null
}
const additionalRateOptions = computed(() => exchangeRates.value.filter(rate =>
  !currencyLines.value.some(line => String(line.rate_id) === String(rate.id))
))
const currencyLineTotals = computed(() => currencyLines.value.map((line, index) => {
  const rate = rateForLine(line)
  const price = lineRateValue(rate)
  const amount = Number(index === 0 ? form.fcy_amount : line.fcy_amount)
  return { line, rate, price, amount, etb: price != null && Number.isFinite(amount) && amount > 0 ? amount * price : 0 }
}))
const totalEtbAmount = computed(() => currencyLineTotals.value.reduce((sum, line) => sum + line.etb, 0))
function addCurrencyLine() {
  const rate = rateForLine({ rate_id: addCurrencyRateId.value })
  if (!rate || !lineRateValue(rate)) {
    currencyLineError.value = 'Choose an approved currency with a valid transaction rate.'
    return
  }
  currencyLines.value.push({ rate_id: String(rate.id), fcy_amount: '' })
  addCurrencyRateId.value = ''
  currencyLineError.value = ''
}
function removeCurrencyLine(index) {
  if (index === 0) return
  currencyLines.value.splice(index, 1)
  currencyLineError.value = ''
}
function returnToRateList() {
  showTradeForm.value = false
  rateError.value = ''
}
function setTradeTab(tab) {
  if (tab === 'REPORT') {
    router.push('/trades')
    return
  }
  activeTab.value = tab
  form.transaction_type = tab
  showTradeForm.value = false
  rateError.value = ''
}
function validateSelectedRate() {
  if (!selectedRate.value) {
    rateError.value = ''
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
function buildPreviewTransaction() {
  const currencies = currencyLineTotals.value.map(({ rate, price, amount, etb }) => ({
    currency_id: rate?.currency_id ?? rate?.currency?.id,
    rate_id: rate?.id,
    currency: {
      code: rate?.currency?.code ?? rate?.currency?.currency_code ?? rate?.currency_code ?? 'FCY',
      name: rate?.currency?.name ?? rate?.currency?.currency_name ?? 'Foreign currency',
    },
    currency_code: rate?.currency?.code ?? rate?.currency?.currency_code ?? rate?.currency_code ?? 'FCY',
    transaction_type: form.transaction_type,
    fcy_amount: amount,
    rate: price,
    etb_amount: etb,
  }))
  const customer = {
    fullname: form.fullname.trim(),
    nationality: form.nationality.trim(),
    phone_number: form.phone_number.trim(),
    id_or_passport_number: form.id_or_passport_number.trim(),
    city: form.city.trim(),
    sub_city: form.sub_city.trim(),
    wereda: form.wereda.trim(),
  }
  return {
    id: 'LOCAL-TEST-PREVIEW',
    reference: 'TEST-PREVIEW',
    transaction_type: form.transaction_type,
    payment_method: form.payment_method,
    transaction_date: new Date().toISOString(),
    customer,
    customer_name: customer.fullname,
    customer_phone: customer.phone_number,
    currencies,
    total_etb: totalEtbAmount.value,
    service_fee: Number(form.service_fee) || 0,
    teller_name: 'Preview only',
    branch_name: 'Preview only',
    is_local_preview: true,
  }
}
function openReceiptPreview() {
  if (!currencyLines.value.length || currencyLineTotals.value.some(line =>
    !line.rate || line.price == null || !Number.isFinite(line.amount) || line.amount <= 0
  )) {
    toast.error('Add at least one currency line and enter a valid amount for every currency.')
    return
  }
  try {
    window.sessionStorage.setItem('rooha-forex-receipt-preview', JSON.stringify(buildPreviewTransaction()))
    router.push({ name: 'trades-receipt', params: { id: 'preview' }, query: { preview: '1' } })
  } catch (error) {
    toast.error(error?.message || 'Unable to prepare the local receipt preview.')
  }
}

async function submit() {
  if (saving.value) return
  if (!currencyLines.value.length || currencyLineTotals.value.some(line => !line.rate || !line.price || !Number.isFinite(line.amount) || line.amount <= 0)) { toast.error('Add at least one currency and enter a valid amount for every currency.'); return }
  if (!selectedCustomerId.value && (!form.fullname.trim() || !form.nationality.trim() || !form.phone_number.trim())) { toast.error('Select an existing customer or enter the new customer details.'); return }
  if (form.transaction_type === 'BUY' && !selectedCustomerId.value && (!form.id_or_passport_number.trim() || !form.city.trim() || !form.sub_city.trim() || !form.wereda.trim())) { toast.error('For a new BUY customer, complete the ID/passport and address fields.'); return }
  if (form.transaction_type === 'SELL' && (typeof sellPurpose.value !== 'string' || !sellPurpose.value.trim() || !sellPurposeOptions.includes(sellPurpose.value))) { toast.error('Select a valid purpose for the SELL transaction.'); return }
  const trades = currencyLineTotals.value.map(({ rate, amount }) => ({ currency_id: rate?.currency_id ?? rate?.currency?.id, fcy_amount: amount }))
  if (trades.some(trade => !trade.currency_id)) { toast.error('A selected exchange rate is missing its currency ID.'); return }
  const payload = { ...(selectedCustomerId.value ? { customer_id: selectedCustomerId.value } : { customer: form.transaction_type === 'BUY' ? { fullname: form.fullname.trim(), nationality: form.nationality.trim(), phone_number: form.phone_number.trim(), id_or_passport_number: form.id_or_passport_number.trim(), city: form.city.trim(), sub_city: form.sub_city.trim(), wereda: form.wereda.trim() } : { fullname: form.fullname.trim(), nationality: form.nationality.trim(), phone_number: form.phone_number.trim() } }), transaction_type: form.transaction_type, payment_method: form.payment_method.trim().toUpperCase(), trades }
  if (form.transaction_type === 'BUY') { payload.service_fee = Number(form.service_fee); if (!Number.isFinite(payload.service_fee) || payload.service_fee < 0) { toast.error('Enter a valid service fee.'); return } }
  else payload.sell_purpose = sellPurpose.value
  saving.value = true
  try {
    const response = await forexTransactionService.create(payload)
    const record = response?.data?.transaction ?? response?.data?.forex_transaction ?? response?.data?.record ?? response?.data ?? response?.transaction ?? response?.forex_transaction ?? response?.record ?? response
    const transactionId = record?.id ?? record?.forex_transaction_id ?? record?.transaction_id ?? record?.uuid
    toast.success('Forex transaction recorded successfully. Your receipt is ready.')
    if (transactionId != null && String(transactionId).trim()) router.push({ name: 'trades-receipt', params: { id: String(transactionId) } })
    else { toast.error('The transaction was saved, but the API did not return an ID. Open the transaction register to print its receipt.'); router.push('/trades') }
  } catch (error) { toast.error(error?.message || 'Unable to record forex transaction.') }
  finally { saving.value = false }
}
</script>

<template>
  <section class="module-page trading-desk-page">
    <div class="module-page-intro trading-desk-heading">
      <div><h2>Trading Desk</h2></div>
      <BaseButton variant="secondary" class="module-secondary-btn" @click="router.push('/trades')">← Back to trades</BaseButton>
    </div>
    <div class="trade-tabs" role="tablist" aria-label="Trading desk">
      <button id="trade-tab-sell" type="button" role="tab" class="trade-tab" :class="{ 'is-active': activeTab === 'SELL' }" :aria-selected="activeTab === 'SELL'" aria-controls="trade-rates-panel" :tabindex="activeTab === 'SELL' ? 0 : -1" @click="setTradeTab('SELL')">SELL</button>
      <button id="trade-tab-buy" type="button" role="tab" class="trade-tab" :class="{ 'is-active': activeTab === 'BUY' }" :aria-selected="activeTab === 'BUY'" aria-controls="trade-rates-panel" :tabindex="activeTab === 'BUY' ? 0 : -1" @click="setTradeTab('BUY')">BUY</button>
    </div>
    <button type="button" class="trade-report-link" @click="setTradeTab('REPORT')">REPORT</button>
    <section v-if="!showTradeForm" id="trade-rates-panel" class="trade-rates-panel module-panel" role="tabpanel" :aria-labelledby="activeTab === 'BUY' ? 'trade-tab-buy' : 'trade-tab-sell'">
      <div class="trade-rates-heading">
        <div><h3>{{ activeTab }} exchange rates</h3></div>
        <span class="trade-rates-count">{{ exchangeRates.length }} rates</span>
      </div>
      <div v-if="loading" class="trade-loading">Loading approved exchange rates…</div>
      <div v-else-if="loadError || rateError" class="trade-rates-empty" role="status">{{ loadError || rateError }}</div>
      <div v-else-if="!exchangeRates.length" class="trade-rates-empty">No approved active exchange rates are currently available.</div>
      <div v-else class="trade-rate-grid">
        <article v-for="rate in exchangeRates" :key="rate.id" class="trade-currency-card" role="button" tabindex="0" :aria-label="`Select ${rate.currency?.name ?? rate.currency?.code ?? 'currency'} for ${activeTab}`" @click="openRateForTrade(rate)" @keydown.enter.prevent="openRateForTrade(rate)" @keydown.space.prevent="openRateForTrade(rate)">
          <div class="trade-currency-card-heading">
            <img v-if="flagUrl(rate)" class="trade-currency-flag" :src="flagUrl(rate)" :alt="`${rate.currency?.name ?? rate.currency?.code ?? 'Currency'} flag`" loading="lazy" />
            <div v-else class="trade-currency-flag-placeholder" aria-hidden="true">{{ rate.currency?.code?.slice(0, 2) ?? 'FX' }}</div>
            <div class="trade-currency-identity">
              <strong>{{ rate.currency?.code ?? rate.currency?.currency_code ?? rate.currency_code ?? 'FCY' }}</strong>
              <span>{{ rate.currency?.name ?? rate.currency?.currency_name ?? 'Foreign currency' }}</span>
            </div>
            <span class="trade-currency-date">{{ rate.rate_date ?? 'Latest' }}</span>
          </div>
          <div class="trade-currency-prices">
            <div v-if="activeTab === 'BUY'" class="trade-currency-price is-current">
              <span>BUY RATE</span><strong>{{ formatMoney(rate.buy_rate ?? rate.buyRate) }}</strong><small>ETB</small>
            </div>
            <div v-else class="trade-currency-price is-current">
              <span>SELL RATE</span><strong>{{ formatMoney(rate.sell_rate ?? rate.sellRate) }}</strong><small>ETB</small>
            </div>
          </div>
          <span class="trade-rate-select">Select {{ activeTab }} rate <span aria-hidden="true">→</span></span>
        </article>
      </div>
    </section>
    <BaseCard v-else as="form" class="module-panel module-form-panel trading-desk-form" @submit.prevent="submit">
      <div v-if="loading" class="trade-loading">Loading…</div>
      <div v-if="loadError" class="module-form-field" role="status"><p>{{ loadError }}</p><BaseButton type="button" variant="secondary" @click="router.go(0)">Reload</BaseButton></div>
      <section v-if="selectedRate" class="selected-rate-summary" aria-live="polite">
        <img v-if="flagUrl(selectedRate)" class="trade-currency-flag" :src="flagUrl(selectedRate)" :alt="currencyCode() + ' flag'" />
        <div class="selected-rate-currency"><strong>{{ currencyCode() }}</strong><span>{{ selectedCurrency?.name ?? 'Foreign currency' }}</span></div>
        <div class="selected-rate-value"><span>{{ form.transaction_type }} RATE</span><strong>{{ rateValue == null ? '—' : formatMoney(rateValue) }} <small>ETB</small></strong></div>
        <div class="selected-rate-conversion"><span>1 {{ currencyCode() }} = {{ rateValue == null ? '—' : formatMoney(rateValue) }} ETB</span><small v-if="selectedRate.rate_date">{{ selectedRate.rate_date }}</small></div>
        <button type="button" class="selected-rate-change" @click="returnToRateList">Change rate</button>
      </section>
      <div class="trade-workspace">
        <div class="trade-workspace-main">
      <section class="trade-form-section">
        <div class="trade-form-section-heading"><h3>Currency lines</h3><p>Enter an amount for each currency in this transaction.</p></div>
        <div class="trade-currency-lines">
          <div v-for="(line, index) in currencyLines" :key="line.rate_id" class="trade-currency-line">
            <div class="trade-currency-line-heading">
              <strong>{{ rateForLine(line)?.currency?.code ?? rateForLine(line)?.currency?.currency_code ?? rateForLine(line)?.currency_code ?? 'FCY' }}</strong>
              <span>{{ form.transaction_type }} rate: {{ lineRateValue(rateForLine(line)) == null ? '—' : formatMoney(lineRateValue(rateForLine(line))) }} ETB</span>
              <button v-if="index > 0" type="button" class="trade-line-remove" @click="removeCurrencyLine(index)">Remove</button>
            </div>
            <div class="module-form-field">
              <BaseInput v-if="index === 0" v-model="form.fcy_amount" :label="'FCY amount (' + (rateForLine(line)?.currency?.code ?? currencyCode()) + ')'" :id="'fcy-amount-' + index" type="number" min="0.000001" step="any" placeholder="0" required />
              <BaseInput v-else v-model="line.fcy_amount" :label="'FCY amount (' + (rateForLine(line)?.currency?.code ?? 'FCY') + ')'" :id="'fcy-amount-' + index" type="number" min="0.000001" step="any" placeholder="0" required />
            </div>
            <div class="trade-currency-line-total"><span>ETB equivalent</span><strong>{{ formatMoney(currencyLineTotals[index]?.etb) }} ETB</strong></div>
          </div>
          <div class="trade-add-currency">
            <label for="add-currency-rate">Add currency</label>
            <div class="trade-add-currency-controls">
              <select id="add-currency-rate" v-model="addCurrencyRateId" class="ui-input">
                <option value="">Select another exchange rate</option>
                <option v-for="rate in additionalRateOptions" :key="rate.id" :value="String(rate.id)">{{ rate.currency?.code ?? rate.currency?.currency_code ?? rate.currency_code }} — {{ rate.currency?.name ?? rate.currency?.currency_name ?? 'Currency' }}</option>
              </select>
              <BaseButton type="button" variant="secondary" :disabled="!addCurrencyRateId" @click="addCurrencyLine">+ Add currency</BaseButton>
            </div>
            <p v-if="currencyLineError" class="trade-rate-error" role="alert">{{ currencyLineError }}</p>
          </div>
          <div class="trade-currency-grand-total"><span>Total ETB amount</span><strong>{{ formatMoney(totalEtbAmount) }} ETB</strong></div>
        </div>
      </section>
      <section class="trade-form-section">
        <div class="trade-form-section-heading"><h3>Transaction details</h3><p>Confirm how this transaction will be processed.</p></div>
        <div class="module-form-grid">
          <div v-if="form.transaction_type === 'SELL'" class="module-form-field"><label for="trade-sell-purpose">Sell purpose</label><select id="trade-sell-purpose" v-model="sellPurpose" class="ui-input" required><option v-for="purpose in sellPurposeOptions" :key="purpose" :value="purpose">{{ purpose }}</option></select></div>
          <div class="module-form-field"><label for="payment-method">Payment method</label><select id="payment-method" v-model="form.payment_method" class="ui-input" required>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="MOBILE_MONEY">Mobile money</option>
              <option value="CARD">Card</option>
            </select></div>
          <div v-if="form.transaction_type === 'BUY'" class="module-form-field"><BaseInput v-model="form.service_fee" label="Service fee (%)" id="trade-service-fee" type="number" min="0" step="any" required /><p v-if="serviceFeeLoading" class="trade-rate-status">Loading fee…</p><p v-else-if="serviceFeeError" class="trade-rate-error" role="status">{{ serviceFeeError }}</p></div>
        </div>
      </section>
        </div>
        <aside class="trade-workspace-customer" aria-label="Customer information">
      <section class="trade-form-section">
        <div class="trade-form-section-heading"><h3>Customer details</h3><p>Find a customer or enter their details.</p></div>
        <div class="trade-customer-search">
          <label for="trade-customer-search">Find existing customer</label>
          <div class="trade-customer-search-row"><input id="trade-customer-search" v-model="customerSearch" class="ui-input" type="search" placeholder="Search by name or phone…" @input="searchCustomers" /><BaseButton type="button" variant="secondary" @click="useNewCustomer">New customer</BaseButton></div>
          <p v-if="customerSearchLoading" class="trade-rate-status">Searching customers…</p>
          <p v-else-if="customerSearchError" class="trade-rate-error" role="alert">{{ customerSearchError }}</p>
          <div v-else-if="customerMatches.length" class="trade-customer-results"><button v-for="row in customerMatches" :key="customerId(row)" type="button" class="trade-customer-result" @click="selectCustomer(row)"><strong>{{ customerName(row) }}</strong><span>{{ row.phone_number || row.phone || 'No phone' }}</span></button></div>
          <p v-if="selectedCustomerId" class="trade-customer-selected">Existing customer selected</p>
        </div>
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
          <div v-if="form.transaction_type === 'BUY' && !selectedCustomerId" class="module-form-field"><BaseInput v-model="form.id_or_passport_number" label="ID or passport number" id="trade-customer-id" required /></div>
          <template v-if="form.transaction_type === 'BUY' && !selectedCustomerId">
            <div class="module-form-field"><BaseInput v-model="form.city" label="City" id="trade-customer-city" required /></div>
            <div class="module-form-field"><BaseInput v-model="form.sub_city" label="Sub-city" id="trade-customer-sub-city" required /></div>
            <div class="module-form-field"><BaseInput v-model="form.wereda" label="Wereda" id="trade-customer-wereda" required /></div>
          </template>
        </div>
      </section>
        </aside>
      </div>
      <div class="trade-rate-feedback"><p v-if="rateError" class="trade-rate-error" role="alert">{{ rateError }}</p></div>
      <div class="module-form-footer"><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" @click="returnToRateList">← Back to rates</BaseButton></div><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" @click="router.push('/trades')">Cancel</BaseButton><BaseButton type="button" variant="secondary" class="module-secondary-btn" @click="openReceiptPreview">Preview receipt</BaseButton><BaseButton v-if="hasAnyPermission(['forex_transactions.create', 'forex_transactions:create'])" type="submit" class="module-primary-btn" :disabled="saving || loading || !selectedRate || rateValue == null">{{ saving ? 'Submitting…' : (form.transaction_type === 'BUY' ? 'Confirm BUY' : 'Confirm SELL') }}</BaseButton></div></div>
    </BaseCard>
  </section>
</template>
<style scoped>
.nationality-field{position:relative}.nationality-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;cursor:pointer}.nationality-selected{display:flex;align-items:center;gap:10px}.nationality-selected .fi,.nationality-option .fi{width:1.35rem;height:1rem;flex:none;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.08)}.nationality-chevron{color:var(--text-muted,#778196)}.nationality-menu{position:absolute;z-index:30;top:calc(100% + 5px);left:0;right:0;padding:8px;background:var(--surface-color,#fff);border:1px solid var(--border-color,#d9e0ea);border-radius:10px;box-shadow:0 12px 30px rgba(20,30,50,.16)}.nationality-search{width:100%;margin-bottom:7px}.nationality-options{max-height:260px;overflow-y:auto}.nationality-option{display:flex;align-items:center;gap:10px;width:100%;padding:9px 8px;border:0;border-radius:6px;background:transparent;color:var(--text-primary,#263449);text-align:left;cursor:pointer}.nationality-option:hover,.nationality-option.is-selected{background:var(--surface-subtle,#f1f5f9)}.nationality-option small{margin-left:auto;color:var(--text-muted,#778196)}.nationality-empty{padding:10px;color:var(--text-muted,#778196);font-size:.85rem}.trading-desk-heading{align-items:center;margin-bottom:16px}.trading-desk-heading h2{margin:0}.trade-form-subtitle{margin:6px 0 0;color:var(--text-muted,#778196);font-size:.9rem}
.trade-tabs{display:flex;align-items:center;gap:28px;margin:0 0 18px;padding:0 8px;border-bottom:1px solid var(--border-color,#d9e0ea)}.trade-tab{position:relative;min-height:48px;padding:0 12px;border:0;background:transparent;color:var(--text-muted,#778196);font-weight:750;letter-spacing:.04em;cursor:pointer}.trade-tab:hover{color:var(--text-primary,#263449)}.trade-tab.is-active{color:var(--brand-base-color,#16A34A)}.trade-tab.is-active::after{position:absolute;right:0;bottom:-1px;left:0;height:3px;border-radius:3px 3px 0 0;background:var(--brand-base-color,#16A34A);content:''}.trade-report-link{float:right;margin-top:-66px;min-height:48px;padding:0 12px;border:0;background:transparent;color:var(--text-muted,#778196);font-weight:750;letter-spacing:.04em;cursor:pointer}.trade-report-link:hover{color:var(--text-primary,#263449)}.trade-rates-panel{padding:22px 24px;overflow:hidden}.trade-rates-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.trade-rates-heading h3{margin:0;font-size:1.05rem}.trade-rates-heading p{margin:5px 0 0;color:var(--text-muted,#778196);font-size:.85rem}.trade-rates-count{padding:5px 10px;border-radius:20px;background:var(--surface-subtle,#f1f5f9);color:var(--text-muted,#778196);font-size:.78rem;font-weight:700}.trade-rate-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.trade-currency-card{display:flex;flex-direction:column;gap:17px;min-width:0;padding:17px;border:1px solid var(--border-color,#e1e7ef);border-radius:13px;background:var(--surface-color,#fff);box-shadow:0 3px 12px rgba(25,40,65,.045);transition:border-color .15s,box-shadow .15s;cursor:pointer;outline:none}.trade-currency-card:hover,.trade-currency-card:focus-visible{border-color:var(--brand-base-color,var(--brand-base-color,#16A34A));box-shadow:0 7px 20px rgba(25,40,65,.09)}.trade-currency-card-heading{display:flex;align-items:center;gap:11px;min-width:0}.trade-currency-flag,.trade-currency-flag-placeholder{width:43px;height:32px;flex:none;object-fit:cover;border-radius:5px;border:1px solid var(--border-color,#e1e7ef);background:var(--surface-subtle,#f1f5f9)}.trade-currency-flag-placeholder{display:grid;place-items:center;color:var(--text-muted,#778196);font-size:.72rem;font-weight:800}.trade-currency-identity{display:flex;flex-direction:column;gap:3px;min-width:0}.trade-currency-identity strong{font-size:1rem;color:var(--text-primary,#263449)}.trade-currency-identity span{overflow:hidden;color:var(--text-muted,#778196);font-size:.78rem;text-overflow:ellipsis;white-space:nowrap}.trade-currency-date{margin-left:auto;color:var(--text-muted,#778196);font-size:.68rem;white-space:nowrap}.trade-currency-prices{display:grid;grid-template-columns:1fr 1fr;gap:9px}.trade-currency-price{display:flex;flex-direction:column;gap:5px;padding:11px 10px;border:1px solid var(--border-color,#e5e9ef);border-radius:9px;background:var(--surface-subtle,#f8fafc)}.trade-currency-price span{color:var(--text-muted,#778196);font-size:.69rem;font-weight:800;letter-spacing:.06em}.trade-currency-price strong{font-size:1.08rem;font-variant-numeric:tabular-nums;color:var(--text-primary,#263449)}.trade-currency-price small{color:var(--text-muted,#778196);font-size:.68rem}.trade-currency-price.is-current{border-color:var(--brand-base-color,#16A34A);background:color-mix(in srgb,var(--brand-base-color,#16A34A) 7%,var(--surface-color,#fff))}.trade-currency-price.is-current span,.trade-currency-price.is-current strong{color:var(--brand-base-color,#16A34A)}.trade-rate-select{width:100%;margin-top:auto;padding:9px 11px;border:1px solid var(--brand-base-color,#16A34A);border-radius:8px;background:transparent;color:var(--brand-base-color,#16A34A);font-size:.78rem;font-weight:750;cursor:pointer}.trade-rate-select:hover{background:var(--surface-subtle,#f1f5f9)}.trade-rates-empty{padding:28px 12px;text-align:center;color:var(--text-muted,#778196)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.trading-desk-form{padding-top:20px}.trade-loading,.trade-rate-status{color:var(--text-muted,#778196);font-size:.85rem}.trade-form-section{padding:0 24px 22px;margin-bottom:22px;border-bottom:1px solid var(--border-color,#e5e9ef)}.trade-form-section-heading{margin-bottom:15px}.trade-form-section-heading h3{margin:0;font-size:1rem}.trade-form-section-heading p{margin:5px 0 0;color:var(--text-muted,#778196);font-size:.82rem}.trade-rate-badges{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 12px}.trade-rate-badge{display:inline-flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border-color,#dfe5ed);border-radius:8px;background:var(--surface-subtle,#f8fafc);color:var(--text-primary,#263449)}.trade-rate-badge span{font-size:.7rem;font-weight:800;letter-spacing:.04em;color:var(--text-muted,#778196)}.trade-rate-badge strong{font-size:.88rem;font-variant-numeric:tabular-nums}.trade-rate-badge-active{background:color-mix(in srgb,var(--brand-base-color,#16A34A) 9%,var(--surface-color,#fff));border-color:var(--brand-base-color,#16A34A);color:var(--brand-base-color,#16A34A)}.trade-rate-date{font-size:.78rem;color:var(--text-muted,#778196)}.trade-rate-feedback{margin:0 24px 20px}.trade-rate-error{color:#b4232f;margin:0 0 12px}.trade-etb-calculation{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px;border:1px solid var(--border-color,#e3e8f0);border-radius:12px;background:var(--surface-subtle,#f8fafc)}.trade-calculation-line{display:flex;flex-direction:column;gap:6px;min-width:0}.trade-calculation-line span{color:var(--text-muted,#778196);font-size:.78rem}.trade-calculation-line strong{color:var(--text-primary,#263449);font-size:.95rem;overflow-wrap:anywhere}.trade-calculation-line .trade-etb-total{font-size:1.15rem;color:var(--brand-base-color,#16A34A)}
@media(max-width:1100px){.trade-rate-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.trade-rate-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.trade-rate-grid{grid-template-columns:1fr}.trade-rates-panel{padding:18px 15px}.trade-currency-date{font-size:.64rem}}@media(max-width:900px){.trade-workspace{grid-template-columns:minmax(0,1fr) minmax(280px,.9fr);gap:14px;padding:0 16px}}@media(max-width:700px){.trade-workspace{grid-template-columns:1fr;padding:0 12px}.trade-workspace-customer{position:static;order:2}.trade-workspace-main{order:1}.trade-workspace-main .trade-form-section{padding-bottom:18px;margin-bottom:18px}.trade-workspace-customer .module-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.trade-workspace-customer .module-form-grid{grid-template-columns:1fr}.trade-workspace{padding:0 8px}}@media(max-width:640px){.trade-form-section{padding-left:16px;padding-right:16px}.trade-etb-calculation{grid-template-columns:1fr}.trade-rate-badges{align-items:flex-start}}

.trade-currency-lines{display:flex;flex-direction:column;gap:12px}.trade-currency-line{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,260px) auto;align-items:end;gap:14px;padding:14px;border:1px solid var(--border-color,#e1e7ef);border-radius:10px}.trade-currency-line-heading{display:flex;flex-direction:column;gap:4px;min-width:0}.trade-currency-line-heading strong{color:var(--text-primary,#263449)}.trade-currency-line-heading span,.trade-currency-line-total span{font-size:.76rem;color:var(--text-muted,#778196)}.trade-currency-line-total{display:flex;flex-direction:column;gap:5px;white-space:nowrap}.trade-currency-line-total strong,.trade-currency-grand-total strong{color:var(--brand-base-color,#16A34A);font-variant-numeric:tabular-nums}.trade-line-remove{align-self:flex-start;padding:3px 0;border:0;background:transparent;color:#b4232f;font-size:.78rem;cursor:pointer}.trade-add-currency{padding:14px;border:1px dashed var(--border-color,#cbd5e1);border-radius:10px}.trade-add-currency>label{display:block;margin-bottom:8px;font-size:.82rem;font-weight:700}.trade-add-currency-controls{display:flex;gap:10px}.trade-add-currency-controls select{flex:1;min-width:0}.trade-currency-grand-total{display:flex;justify-content:space-between;align-items:center;padding:14px;border-radius:10px;background:var(--surface-subtle,#f8fafc)}.trade-currency-grand-total span{font-weight:700}.trade-currency-grand-total strong{font-size:1.1rem}@media(max-width:680px){.trade-currency-line{grid-template-columns:1fr}.trade-add-currency-controls{flex-direction:column}}
.selected-rate-summary{display:flex;align-items:center;gap:14px;margin:0 24px 16px;padding:10px 14px;border:1px solid var(--brand-base-color,#16A34A);border-left:4px solid var(--brand-base-color,#16A34A);border-radius:9px;background:var(--surface-color,#fff)}
.selected-rate-summary .trade-currency-flag{width:36px;height:26px}
.selected-rate-currency,.selected-rate-value,.selected-rate-conversion{display:flex;flex-direction:column;gap:2px;min-width:0}
.selected-rate-currency strong{font-size:.9rem;color:var(--text-primary,#263449)}.selected-rate-currency span,.selected-rate-value span,.selected-rate-conversion small{font-size:.7rem;color:var(--text-muted,#778196)}
.selected-rate-value{padding-left:14px;border-left:1px solid var(--border-color,#e5e9ef)}.selected-rate-value strong{font-size:1.05rem;color:var(--brand-base-color,#16A34A);font-variant-numeric:tabular-nums;white-space:nowrap}.selected-rate-value small{font-size:.68rem}
.selected-rate-conversion{margin-left:auto;text-align:right}.selected-rate-conversion span{font-size:.78rem;font-weight:650;color:var(--text-primary,#263449);white-space:nowrap}
.selected-rate-change{padding:6px 10px;border:1px solid var(--border-color,#d9e0ea);border-radius:7px;background:transparent;color:var(--text-primary,#263449);font-size:.76rem;font-weight:650;cursor:pointer;white-space:nowrap}
@media(max-width:640px){.selected-rate-summary{gap:9px;margin:0 14px 14px;padding:9px 10px;flex-wrap:wrap}.selected-rate-value{padding-left:9px}.selected-rate-value strong{font-size:.95rem}.selected-rate-conversion{margin-left:0;flex:1 1 100%;padding-top:7px;border-top:1px solid var(--border-color,#e5e9ef);text-align:left}.selected-rate-change{margin-left:auto}}
.trade-workspace{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.85fr);align-items:start;gap:22px;padding:0 24px}.trade-workspace-main,.trade-workspace-customer{min-width:0}.trade-workspace-main .trade-form-section,.trade-workspace-customer .trade-form-section{padding-left:0;padding-right:0}.trade-workspace-main .trade-form-section:last-child,.trade-workspace-customer .trade-form-section:last-child{margin-bottom:0}.trade-workspace-customer{position:sticky;top:16px;padding:18px;border:1px solid var(--border-color,#e1e7ef);border-radius:12px;background:var(--surface-color,#fff)}.trade-workspace-customer .trade-customer-search{margin-left:0;margin-right:0}.trade-workspace-customer .module-form-grid{grid-template-columns:1fr}.trade-workspace-customer .trade-form-section{border-bottom:0;margin-bottom:0;padding-bottom:0}.trade-workspace-customer .trade-form-section-heading{margin-bottom:12px}.trade-customer-search{display:grid;gap:8px;margin:0 24px 20px}.trade-customer-search>label{font-size:.82rem;font-weight:700}.trade-customer-search-row{display:flex;gap:10px}.trade-customer-search-row input{flex:1;min-width:0}.trade-customer-results{display:grid;max-height:220px;overflow:auto;border:1px solid var(--border-color,#d9e0ea);border-radius:9px;background:var(--surface-color,#fff)}.trade-customer-result{display:flex;justify-content:space-between;gap:12px;padding:11px 13px;border:0;border-bottom:1px solid var(--border-color,#edf1f5);background:transparent;text-align:left;cursor:pointer}.trade-customer-result:hover{background:var(--surface-subtle,#f8fafc)}.trade-customer-result span,.trade-customer-selected{color:var(--text-muted,#778196);font-size:.78rem}.trade-customer-selected{margin:0;color:var(--brand-base-color,#16A34A)}@media(max-width:600px){.trade-customer-search{margin-left:16px;margin-right:16px}.trade-customer-search-row{flex-direction:column}}

/* Trading desk visual polish: consistent controls, calmer spacing and clearer hierarchy. */
.trading-desk-form{padding:22px 0 8px}
.trade-workspace{gap:24px;padding:0 26px 8px}
.trade-workspace-main,.trade-workspace-customer{min-width:0}
.trade-workspace-main .trade-form-section{padding:0 0 22px;margin:0 0 22px;border-bottom:1px solid var(--border-color,#e5e9ef)}
.trade-workspace-main .trade-form-section:last-child{margin-bottom:0}
.trade-workspace-customer{padding:22px;background:var(--surface-subtle,#f8fafc);border-color:var(--border-color,#e1e7ef);box-shadow:0 2px 10px rgba(25,40,65,.035)}
.trade-form-section-heading{display:flex;flex-direction:column;gap:5px;margin-bottom:16px}
.trade-form-section-heading h3{font-size:1.02rem;line-height:1.35;font-weight:750;letter-spacing:-.01em;color:var(--text-primary,#263449)}
.trade-form-section-heading p{margin:0;font-size:.8rem;line-height:1.45;color:var(--text-muted,#778196)}
.trade-workspace :deep(.ui-field){display:flex;flex-direction:column;gap:7px;width:100%;min-width:0;margin:0}
.trade-workspace :deep(.ui-field-label),.trade-workspace .trade-customer-search>label,.trade-workspace .trade-add-currency>label,.trade-workspace .module-form-field>label{display:block;min-height:18px;margin:0;font-size:.78rem;line-height:1.25;font-weight:700;letter-spacing:.01em;color:var(--text-primary,#344054)}
.trade-workspace :deep(.ui-input),.trade-workspace .ui-input{box-sizing:border-box;width:100%;height:44px;min-height:44px;padding:0 12px;border:1px solid var(--border-color,#d6dde7);border-radius:8px;background:var(--surface-color,#fff);color:var(--text-primary,#263449);font:inherit;font-size:.88rem;line-height:1.2;box-shadow:none;transition:border-color .15s,box-shadow .15s}
.trade-workspace :deep(.ui-input:focus),.trade-workspace .ui-input:focus{outline:none;border-color:var(--brand-base-color,#16A34A);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand-base-color,#16A34A) 14%,transparent)}
.trade-workspace :deep(.ui-input::placeholder),.trade-workspace .ui-input::placeholder{color:#98a2b3}
.trade-workspace .nationality-trigger{display:flex;align-items:center;justify-content:space-between;text-align:left}
.trade-workspace .module-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:16px}
.trade-workspace-customer .module-form-grid{grid-template-columns:1fr;gap:14px}
.trade-workspace .module-form-field{display:flex;flex-direction:column;justify-content:flex-start;gap:7px;min-width:0;margin:0}
.trade-customer-search{gap:8px;margin:0 0 18px}
.trade-customer-search-row{align-items:stretch;gap:8px}
.trade-customer-search-row .ui-input{flex:1 1 auto;min-width:0}
.trade-customer-search-row :deep(button){flex:0 0 auto;min-height:44px;white-space:nowrap}
.trade-customer-results{margin-top:2px;box-shadow:0 4px 12px rgba(25,40,65,.05)}
.trade-customer-result{align-items:center;min-height:48px;padding:10px 12px}
.trade-customer-result strong{font-size:.84rem;line-height:1.35;color:var(--text-primary,#263449)}
.trade-customer-result span{font-size:.76rem;white-space:nowrap}
.trade-customer-selected{padding:9px 11px;border-radius:7px;background:color-mix(in srgb,var(--brand-base-color,#16A34A) 9%,var(--surface-color,#fff));font-weight:650}
.trade-currency-lines{gap:10px}
.trade-currency-line{grid-template-columns:minmax(0,1fr) minmax(170px,230px) minmax(110px,auto);align-items:center;gap:16px;padding:14px 16px;background:var(--surface-color,#fff)}
.trade-currency-line-heading{gap:5px}
.trade-currency-line-heading strong{font-size:.92rem;font-weight:750}
.trade-currency-line-heading span{font-size:.74rem;line-height:1.35}
.trade-currency-line .module-form-field{margin:0}
.trade-currency-line-total{gap:4px;align-self:center}
.trade-currency-line-total strong{font-size:.9rem}
.trade-add-currency{padding:15px;background:var(--surface-subtle,#fafbfc)}
.trade-add-currency-controls{align-items:center;gap:9px}
.trade-add-currency-controls select{min-width:0}
.trade-currency-grand-total{margin-top:2px;padding:15px 16px;border:1px solid var(--border-color,#e5e9ef);background:var(--surface-subtle,#f5f8fa)}
.trade-currency-grand-total span{font-size:.84rem;color:var(--text-primary,#344054)}
.trade-currency-grand-total strong{font-size:1.12rem}
.trade-workspace-customer .trade-form-section-heading{margin-bottom:15px}
.trade-rate-feedback{margin:16px 26px}
.trading-desk-form .module-form-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 26px 18px;border-top:1px solid var(--border-color,#e5e9ef)}
.selected-rate-summary{margin:0 26px 20px;padding:13px 16px;min-height:68px}
@media(max-width:900px){
 .trade-workspace{gap:16px;padding:0 18px 8px}
 .trade-workspace-customer{padding:17px}
 .trade-currency-line{grid-template-columns:minmax(0,1fr) minmax(150px,210px);gap:12px}
 .trade-currency-line-total{grid-column:2;justify-self:start}
}
@media(max-width:700px){
 .trade-workspace{grid-template-columns:1fr;gap:18px;padding:0 14px 8px}
 .trade-workspace-main{order:1}
 .trade-workspace-customer{order:2;position:static;padding:17px}
 .trade-workspace-customer .module-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .trade-workspace .module-form-grid{gap:13px}
 .trade-currency-line{grid-template-columns:minmax(0,1fr) minmax(140px,1fr)}
 .trade-rate-feedback{margin:14px}
 .trading-desk-form .module-form-footer{padding:14px;flex-wrap:wrap}
 .selected-rate-summary{margin:0 14px 16px}
}
@media(max-width:520px){
 .trade-workspace{padding:0 12px 8px}
 .trade-workspace-customer .module-form-grid,.trade-workspace .module-form-grid{grid-template-columns:1fr}
 .trade-currency-line{grid-template-columns:1fr;align-items:stretch}
 .trade-currency-line-total{grid-column:auto}
 .trade-add-currency-controls{align-items:stretch;flex-direction:column}
 .trade-customer-search-row{flex-direction:column}
 .trade-customer-search-row :deep(button){width:100%}
 .trade-workspace-customer{padding:15px}
 .trade-form-section-heading{margin-bottom:13px}
 .trading-desk-form .module-form-footer>div{display:flex;flex-wrap:wrap;gap:8px}
}

</style>

<script setup>
/**
 * SellTransactionView — Sales of Foreign Cash Notes
 * 4-step wizard:
 *   Step 1 — Personal Information      (purchaser's details)
 *   Step 2 — Travel & Passport Info    (visa, passport, travel date, bank account)
 *   Step 3 — Transaction Details       (currency, amount, purpose, payment method)
 *   Step 4 — Review & Confirm
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../../services/apiClient'
import { rateService } from '../../services/rateService'
import { customerService } from '../../services/customerService'
import { forexTransactionService } from '../../services/forexTransactionService'
import { useToast } from '../../composables/toast'
import BaseButton from '../../components/ui/BaseButton.vue'

const router = useRouter()
const toast  = useToast()
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://10.195.49.18:3001').replace(/\/$/, '')

// ─── wizard state ─────────────────────────────────────────────────────────────
const step  = ref(1)
const STEPS = [
  { n: 1, label: 'Personal Information',       desc: "Enter the purchaser's details" },
  { n: 2, label: 'Travel & Passport Info',     desc: 'Provide travel and passport details' },
  { n: 3, label: 'Transaction Details',        desc: 'Enter currency and amount information' },
  { n: 4, label: 'Review & Confirm',           desc: 'Review and confirm the details' },
]

// ─── remote data ──────────────────────────────────────────────────────────────
const ratesLoading  = ref(false)
const ratesError    = ref('')
const saving        = ref(false)
const exchangeRates = ref([])

// ─── customer search ──────────────────────────────────────────────────────────
const customerSearch        = ref('')
const customerMatches       = ref([])
const customerSearchLoading = ref(false)
const customerSearchError   = ref('')
const selectedCustomerId    = ref('')
let   customerSearchSeq     = 0

// ─── STEP 1 — personal info ───────────────────────────────────────────────────
const personal = reactive({
  fullname:     '',
  email:        '',
  phone_number: '',
  nationality:  'Ethiopian',
  city:         'Addis Ababa',
  sub_city:     '',
  woreda:       '',
})
const step1Errors = reactive({})

function validateStep1() {
  Object.keys(step1Errors).forEach(k => delete step1Errors[k])
  if (!personal.fullname.trim())     step1Errors.fullname     = 'Full name is required.'
  if (!personal.phone_number.trim()) step1Errors.phone_number = 'Phone number is required.'
  if (!personal.city.trim())         step1Errors.city         = 'City is required.'
  return Object.keys(step1Errors).length === 0
}

// ─── STEP 2 — travel & passport ───────────────────────────────────────────────
const travel = reactive({
  id_type:               'PASSPORT',
  id_number:             '',
  id_issue_date:         '',
  id_expiry_date:        '',
  visa_number:           '',
  visa_issue_date:       '',
  visa_expiry_date:      '',
  air_ticket_number:     '',
  air_ticket_issue_date: '',
  air_ticket_expiry:     '',
  travel_date:           '',
  bank_account:          '',
})
const step2Errors = reactive({})

function validateStep2() {
  Object.keys(step2Errors).forEach(k => delete step2Errors[k])
  if (!travel.id_number.trim()) step2Errors.id_number = 'ID / Passport number is required.'
  return Object.keys(step2Errors).length === 0
}

// ─── STEP 3 — transaction details ─────────────────────────────────────────────
const PURPOSES = [
  'Vacation Travel', 'Tourist Travel', 'Visit Travel', 'Training Travel',
  'Business Travel', 'Medical Travel', 'Meeting Travel', 'Holiday Travel',
  'Education Travel', 'Sport Travel', 'Exhibition Travel', 'Haji Travel', 'Other',
]
const tx = reactive({
  rate_id:        '',
  fcy_amount:     '',
  purpose:        'Vacation Travel',
  payment_method: 'CASH',
})
const step3Error = ref('')

function validateStep3() {
  step3Error.value = ''
  if (!tx.rate_id)                                 { step3Error.value = 'Please select a currency.'; return false }
  if (!tx.fcy_amount || Number(tx.fcy_amount) <= 0) { step3Error.value = 'Enter a valid amount.';    return false }
  return true
}

// ─── computed ─────────────────────────────────────────────────────────────────
function records(r) {
  let v = r?.data ?? r
  for (let i = 0; i < 4 && v && !Array.isArray(v) && typeof v === 'object'; i++) {
    const n = v.data ?? v.results ?? v.items ?? v.records ?? v.exchange_rates
    if (n === undefined || n === v) break
    v = n
  }
  return Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : [])
}

const selectedRate = computed(() =>
  exchangeRates.value.find(r => String(r.id) === String(tx.rate_id)) ?? null
)
const sellRate = computed(() => {
  const n = Number(selectedRate.value?.sell_rate ?? selectedRate.value?.sellRate)
  return Number.isFinite(n) && n > 0 ? n : null
})
const etbAmount = computed(() => {
  const a = Number(tx.fcy_amount)
  return sellRate.value && Number.isFinite(a) && a > 0 ? a * sellRate.value : null
})

function fmt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
function flagUrl(rate) {
  const p = rate?.currency?.flag_url
  if (!p) return ''
  return /^https?:\/\//i.test(p) ? p : `${apiBaseUrl}/${String(p).replace(/^\/+/, '')}`
}
function currencyLabel(rate) {
  return rate?.currency?.code ?? rate?.currency_code ?? 'FCY'
}

// ─── customer search ──────────────────────────────────────────────────────────
function cName(row) {
  return row?.fullname ?? [row?.first_name, row?.middle_name, row?.last_name].filter(Boolean).join(' ')
}
function cId(row) { return row?.id ?? row?.customer_id ?? row?.customer_profile_id ?? '' }

async function searchCustomers() {
  const q   = customerSearch.value.trim()
  const seq = ++customerSearchSeq
  selectedCustomerId.value = ''
  if (q.length < 2) { customerMatches.value = []; return }
  customerSearchLoading.value = true
  customerSearchError.value   = ''
  try {
    const res = await customerService.list({ search: q })
    if (seq !== customerSearchSeq) return
    customerMatches.value = records(res).filter(r => cId(r))
  } catch (e) {
    if (seq === customerSearchSeq) customerSearchError.value = e?.message || 'Search failed.'
  } finally {
    if (seq === customerSearchSeq) customerSearchLoading.value = false
  }
}

function selectCustomer(row) {
  selectedCustomerId.value  = String(cId(row))
  customerSearch.value      = cName(row) || row?.phone_number || 'Selected'
  customerMatches.value     = []
  personal.fullname         = cName(row) || ''
  personal.phone_number     = row?.phone_number || row?.phone || ''
  personal.nationality      = row?.nationality || 'Ethiopian'
  personal.email            = row?.email || ''
  personal.city             = row?.city || 'Addis Ababa'
  personal.sub_city         = row?.sub_city || ''
  personal.woreda           = row?.wereda || row?.woreda || ''
}

function clearCustomer() {
  selectedCustomerId.value = ''
  customerSearch.value     = ''
  customerMatches.value    = []
}

// ─── navigation ───────────────────────────────────────────────────────────────
function goNext() {
  if (step.value === 1 && !validateStep1()) return
  if (step.value === 2 && !validateStep2()) return
  if (step.value === 3 && !validateStep3()) return
  step.value++
}
function goBack() { if (step.value > 1) step.value-- }

// ─── submit ───────────────────────────────────────────────────────────────────
async function submit() {
  if (saving.value) return
  saving.value = true
  try {
    const payload = {
      transaction_type: 'SELL',
      payment_method:   tx.payment_method.toUpperCase(),
      sell_purpose:     tx.purpose,
      trades: [{
        currency_id: selectedRate.value?.currency_id ?? selectedRate.value?.currency?.id,
        fcy_amount:  Number(tx.fcy_amount),
      }],
      ...(selectedCustomerId.value
        ? { customer_id: selectedCustomerId.value }
        : {
            customer: {
              fullname:     personal.fullname.trim(),
              phone_number: personal.phone_number.trim(),
              nationality:  personal.nationality.trim(),
              email:        personal.email.trim() || undefined,
              city:         personal.city.trim(),
              sub_city:     personal.sub_city.trim(),
              wereda:       personal.woroda || personal.woreda,
            },
          }
      ),
    }
    const res = await forexTransactionService.create(payload)
    const rec = res?.data?.transaction ?? res?.data?.forex_transaction ?? res?.data ?? res?.transaction ?? res
    const id  = rec?.id ?? rec?.forex_transaction_id ?? rec?.transaction_id
    successRef.value   = rec?.reference ?? rec?.receipt_number ?? rec?.transaction_number ?? rec?.transaction_code ?? (id ? `TXN-${id}` : 'SELL transaction')
    successModal.value = true
  } catch (e) {
    toast.error(e?.message || 'Failed to submit transaction.')
  } finally {
    saving.value = false
  }
}

// ─── success modal ────────────────────────────────────────────────────────────
const successModal = ref(false)
const successRef   = ref('')

// ─── load rates ───────────────────────────────────────────────────────────────
onMounted(async () => {
  ratesLoading.value = true
  try {
    const res = await rateService.latest()
    exchangeRates.value = records(res).filter(r =>
      r?.is_active !== false && (!r?.status || String(r.status).toUpperCase() === 'APPROVED')
    )
    if (!exchangeRates.value.length) ratesError.value = 'No approved exchange rates available.'
  } catch (e) {
    ratesError.value = e?.message || 'Could not load exchange rates.'
  } finally {
    ratesLoading.value = false
  }
})
</script>

<template>
  <section class="module-page wiz-page">

    <!-- page header -->
    <div class="wiz-page-header">
      <div>
        <p class="wiz-brand">Rooha Forex Bureau</p>
        <h2 class="wiz-title">Sales of Foreign Cash Notes</h2>
      </div>
      <BaseButton variant="secondary" size="sm" @click="router.push('/trades')">← Back</BaseButton>
    </div>

    <div class="wiz-layout">

      <!-- ── left: step list ─────────────────────────────────────────────── -->
      <aside class="wiz-steps">
        <div v-for="s in STEPS" :key="s.n" class="wiz-step" :class="{ 'is-done': step > s.n, 'is-active': step === s.n }">
          <div class="wiz-step-indicator">
            <span v-if="step > s.n" class="wiz-step-check">✓</span>
            <span v-else class="wiz-step-num">{{ String(s.n).padStart(2, '0') }}</span>
          </div>
          <div v-if="s.n < STEPS.length" class="wiz-step-line"></div>
          <div class="wiz-step-copy">
            <strong>{{ s.label }}</strong>
            <span>{{ s.desc }}</span>
          </div>
        </div>
      </aside>

      <!-- ── right: step content ─────────────────────────────────────────── -->
      <div class="wiz-body">

        <!-- ── STEP 1: Personal Information ─────────────────────────────── -->
        <div v-if="step === 1" class="wiz-panel">
          <div class="wiz-panel-header">
            <h3>Personal Information</h3>
            <p>Enter the purchaser's personal details.</p>
          </div>

          <!-- customer search -->
          <div class="wiz-field">
            <label>Find existing customer</label>
            <div class="wiz-search-row">
              <input v-model="customerSearch" class="wiz-input" type="search" placeholder="Search by name or phone…" @input="searchCustomers" />
              <BaseButton variant="secondary" size="sm" @click="clearCustomer">New</BaseButton>
            </div>
            <p v-if="customerSearchLoading" class="wiz-hint">Searching…</p>
            <p v-if="customerSearchError" class="wiz-error-inline">{{ customerSearchError }}</p>
            <div v-if="customerMatches.length" class="wiz-dropdown">
              <button v-for="r in customerMatches" :key="cId(r)" type="button" class="wiz-dropdown-item" @click="selectCustomer(r)">
                <strong>{{ cName(r) }}</strong>
                <span>{{ r.phone_number || r.phone || '' }}</span>
              </button>
            </div>
            <p v-if="selectedCustomerId" class="wiz-selected-note">✓ Existing customer selected</p>
          </div>

          <div class="wiz-grid">
            <div class="wiz-field">
              <label>Full name *</label>
              <input v-model="personal.fullname" class="wiz-input" placeholder="e.g. Fuad Kamil Rejo" />
              <p v-if="step1Errors.fullname" class="wiz-error-inline">{{ step1Errors.fullname }}</p>
            </div>
            <div class="wiz-field">
              <label>Phone number *</label>
              <input v-model="personal.phone_number" class="wiz-input" type="tel" placeholder="+251 9XX XXX XXX" />
              <p v-if="step1Errors.phone_number" class="wiz-error-inline">{{ step1Errors.phone_number }}</p>
            </div>
            <div class="wiz-field">
              <label>Email</label>
              <input v-model="personal.email" class="wiz-input" type="email" placeholder="optional" />
            </div>
            <div class="wiz-field">
              <label>Nationality</label>
              <input v-model="personal.nationality" class="wiz-input" placeholder="Ethiopian" />
            </div>
            <div class="wiz-field">
              <label>City *</label>
              <input v-model="personal.city" class="wiz-input" placeholder="Addis Ababa" />
              <p v-if="step1Errors.city" class="wiz-error-inline">{{ step1Errors.city }}</p>
            </div>
            <div class="wiz-field">
              <label>Sub-city</label>
              <input v-model="personal.sub_city" class="wiz-input" placeholder="e.g. Bole" />
            </div>
            <div class="wiz-field">
              <label>Woreda</label>
              <input v-model="personal.woreda" class="wiz-input" placeholder="e.g. 03" />
            </div>
          </div>

          <div class="wiz-footer">
            <span></span>
            <BaseButton @click="goNext">Next →</BaseButton>
          </div>
        </div>

        <!-- ── STEP 2: Travel & Passport Information ─────────────────────── -->
        <div v-if="step === 2" class="wiz-panel">
          <div class="wiz-panel-header">
            <h3>Travel & Passport Information</h3>
            <p>Provide travel and identification document details.</p>
          </div>

          <div class="wiz-section-label">Identification</div>
          <div class="wiz-grid">
            <div class="wiz-field">
              <label>ID type</label>
              <select v-model="travel.id_type" class="wiz-input">
                <option value="PASSPORT">Passport</option>
                <option value="NATIONAL_ID">National ID</option>
                <option value="DRIVING_LICENSE">Driving License</option>
              </select>
            </div>
            <div class="wiz-field">
              <label>ID / Passport number *</label>
              <input v-model="travel.id_number" class="wiz-input" placeholder="e.g. 10445066" />
              <p v-if="step2Errors.id_number" class="wiz-error-inline">{{ step2Errors.id_number }}</p>
            </div>
            <div class="wiz-field">
              <label>Issue date</label>
              <input v-model="travel.id_issue_date" class="wiz-input" type="date" />
            </div>
            <div class="wiz-field">
              <label>Expiry date</label>
              <input v-model="travel.id_expiry_date" class="wiz-input" type="date" />
            </div>
          </div>

          <div class="wiz-section-label">Visa</div>
          <div class="wiz-grid">
            <div class="wiz-field">
              <label>Visa number</label>
              <input v-model="travel.visa_number" class="wiz-input" placeholder="optional" />
            </div>
            <div class="wiz-field">
              <label>Issue date (Visa)</label>
              <input v-model="travel.visa_issue_date" class="wiz-input" type="date" />
            </div>
            <div class="wiz-field">
              <label>Expiry date (Visa)</label>
              <input v-model="travel.visa_expiry_date" class="wiz-input" type="date" />
            </div>
          </div>

          <div class="wiz-section-label">Travel</div>
          <div class="wiz-grid">
            <div class="wiz-field">
              <label>Air ticket number</label>
              <input v-model="travel.air_ticket_number" class="wiz-input" placeholder="optional" />
            </div>
            <div class="wiz-field">
              <label>Issue date (Air ticket)</label>
              <input v-model="travel.air_ticket_issue_date" class="wiz-input" type="date" />
            </div>
            <div class="wiz-field">
              <label>Expiry date (Air ticket)</label>
              <input v-model="travel.air_ticket_expiry" class="wiz-input" type="date" />
            </div>
            <div class="wiz-field">
              <label>Travel date</label>
              <input v-model="travel.travel_date" class="wiz-input" type="date" />
            </div>
            <div class="wiz-field">
              <label>Bank account</label>
              <input v-model="travel.bank_account" class="wiz-input" placeholder="optional" />
            </div>
          </div>

          <div class="wiz-footer">
            <BaseButton variant="secondary" @click="goBack">← Previous</BaseButton>
            <BaseButton @click="goNext">Next →</BaseButton>
          </div>
        </div>

        <!-- ── STEP 3: Transaction Details ───────────────────────────────── -->
        <div v-if="step === 3" class="wiz-panel">
          <div class="wiz-panel-header">
            <h3>Transaction Details</h3>
            <p>Select the currency, enter the amount, and confirm the purpose.</p>
          </div>

          <p v-if="ratesError" class="wiz-error-box">{{ ratesError }}</p>
          <p v-else-if="ratesLoading" class="wiz-hint">Loading exchange rates…</p>

          <!-- currency picker -->
          <div class="wiz-field" v-if="!ratesLoading && !ratesError">
            <label>Select currency *</label>
            <div class="wiz-currency-grid">
              <button
                v-for="rate in exchangeRates" :key="rate.id"
                type="button"
                class="wiz-currency-card"
                :class="{ 'is-selected': String(tx.rate_id) === String(rate.id) }"
                @click="tx.rate_id = String(rate.id)"
              >
                <img v-if="flagUrl(rate)" :src="flagUrl(rate)" class="wiz-flag" :alt="currencyLabel(rate)" />
                <div v-else class="wiz-flag-placeholder">{{ currencyLabel(rate).slice(0, 2) }}</div>
                <strong>{{ currencyLabel(rate) }}</strong>
                <span>SELL {{ fmt(rate.sell_rate ?? rate.sellRate) }}</span>
              </button>
            </div>
          </div>

          <div class="wiz-grid" v-if="tx.rate_id">
            <div class="wiz-field">
              <label>FCY Amount ({{ currencyLabel(selectedRate) }}) *</label>
              <input v-model="tx.fcy_amount" class="wiz-input" type="number" min="0.01" step="any" placeholder="0.00" />
            </div>
            <div class="wiz-field">
              <label>Purpose *</label>
              <select v-model="tx.purpose" class="wiz-input">
                <option v-for="p in PURPOSES" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div class="wiz-field">
              <label>Payment method</label>
              <select v-model="tx.payment_method" class="wiz-input">
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="ACCOUNT">Account</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="CARD">Card</option>
              </select>
            </div>
          </div>

          <!-- live ETB calc -->
          <div v-if="etbAmount" class="wiz-calc-box">
            <div>
              <span>FCY amount</span>
              <strong>{{ fmt(tx.fcy_amount) }} {{ currencyLabel(selectedRate) }}</strong>
            </div>
            <div>
              <span>SELL rate</span>
              <strong>{{ fmt(sellRate) }} ETB</strong>
            </div>
            <div class="wiz-calc-total">
              <span>Total ETB</span>
              <strong>{{ fmt(etbAmount) }} ETB</strong>
            </div>
          </div>

          <p v-if="step3Error" class="wiz-error-box">{{ step3Error }}</p>

          <div class="wiz-footer">
            <BaseButton variant="secondary" @click="goBack">← Previous</BaseButton>
            <BaseButton @click="goNext">Next →</BaseButton>
          </div>
        </div>

        <!-- ── STEP 4: Review & Confirm ───────────────────────────────────── -->
        <div v-if="step === 4" class="wiz-panel">
          <div class="wiz-panel-header">
            <h3>Review & Confirm</h3>
            <p>Review and confirm the details before submitting.</p>
          </div>

          <div class="wiz-confirm-label">Confirmation Summary</div>

          <div class="wiz-review-grid">

            <!-- personal details -->
            <div class="wiz-review-section">
              <div class="wiz-review-section-header">
                <span class="wiz-review-icon">👤</span>
                <strong>Personal Details</strong>
              </div>
              <div class="wiz-review-rows">
                <div class="wiz-review-row"><span>Purchaser Name</span><strong>{{ personal.fullname || '—' }}</strong></div>
                <div class="wiz-review-row"><span>Email</span><strong>{{ personal.email || '—' }}</strong></div>
                <div class="wiz-review-row"><span>Phone Number</span><strong>{{ personal.phone_number || '—' }}</strong></div>
                <div class="wiz-review-row"><span>Nationality</span><strong>{{ personal.nationality || '—' }}</strong></div>
                <div class="wiz-review-row"><span>Address City</span><strong>{{ personal.city || '—' }}</strong></div>
                <div class="wiz-review-row"><span>Sub City</span><strong>{{ personal.sub_city || '—' }}</strong></div>
                <div class="wiz-review-row"><span>Woreda</span><strong>{{ personal.woreda || '—' }}</strong></div>
              </div>
            </div>

            <!-- travel info -->
            <div class="wiz-review-section">
              <div class="wiz-review-section-header">
                <span class="wiz-review-icon">✈️</span>
                <strong>Travel Information</strong>
              </div>
              <div class="wiz-review-rows">
                <div class="wiz-review-row"><span>Visa No</span><strong>{{ travel.visa_number || 'N/A' }}</strong></div>
                <div class="wiz-review-row"><span>Issue Date (Visa)</span><strong>{{ travel.visa_issue_date || 'N/A' }}</strong></div>
                <div class="wiz-review-row"><span>Expiry Date (Visa)</span><strong>{{ travel.visa_expiry_date || 'N/A' }}</strong></div>
                <div class="wiz-review-row"><span>Air Ticket No</span><strong>{{ travel.air_ticket_number || 'N/A' }}</strong></div>
                <div class="wiz-review-row"><span>Issue Date (Air Ticket)</span><strong>{{ travel.air_ticket_issue_date || 'N/A' }}</strong></div>
                <div class="wiz-review-row"><span>Expiry Date (Air Ticket)</span><strong>{{ travel.air_ticket_expiry || 'N/A' }}</strong></div>
                <div class="wiz-review-row"><span>Travel Date</span><strong>{{ travel.travel_date || 'N/A' }}</strong></div>
                <div class="wiz-review-row"><span>Bank Account</span><strong>{{ travel.bank_account || 'N/A' }}</strong></div>
              </div>
            </div>

            <!-- payment info -->
            <div class="wiz-review-section">
              <div class="wiz-review-section-header">
                <span class="wiz-review-icon">💳</span>
                <strong>Payment Information</strong>
              </div>
              <div class="wiz-review-rows">
                <div class="wiz-review-row"><span>Purpose</span><strong>{{ tx.purpose }}</strong></div>
                <div class="wiz-review-row"><span>Payment Method</span><strong>{{ tx.payment_method }}</strong></div>
                <div class="wiz-review-row wiz-review-total"><span>Total Amount</span><strong>{{ fmt(etbAmount) }} ETB</strong></div>
              </div>
            </div>

            <!-- identification -->
            <div class="wiz-review-section">
              <div class="wiz-review-section-header">
                <span class="wiz-review-icon">🪪</span>
                <strong>Identification Types</strong>
              </div>
              <div class="wiz-review-rows">
                <div class="wiz-review-row"><span>ID Type</span><strong>{{ travel.id_type }}</strong></div>
                <div class="wiz-review-row"><span>ID Number</span><strong>{{ travel.id_number || '—' }}</strong></div>
                <div class="wiz-review-row"><span>Issue Date</span><strong>{{ travel.id_issue_date || 'N/A' }}</strong></div>
                <div class="wiz-review-row"><span>Expiry Date</span><strong>{{ travel.id_expiry_date || 'N/A' }}</strong></div>
              </div>
            </div>

          </div>

          <div class="wiz-footer">
            <BaseButton variant="secondary" @click="goBack">← Previous</BaseButton>
            <BaseButton :loading="saving" @click="submit">
              {{ saving ? 'Submitting…' : 'Confirm' }}
            </BaseButton>
          </div>
        </div>

      </div><!-- /wiz-body -->
    </div><!-- /wiz-layout -->

    <!-- ── Success modal ──────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="successModal" class="wiz-modal-backdrop" @click.self="successModal = false">
        <div class="wiz-modal" role="dialog" aria-modal="true" aria-labelledby="sell-success-title">
          <div class="wiz-modal-icon">✓</div>
          <h3 id="sell-success-title">Transaction Recorded</h3>
          <p>SELL transaction <strong>{{ successRef }}</strong> has been successfully submitted.</p>
          <div class="wiz-modal-actions">
            <button class="wiz-modal-btn wiz-modal-btn--secondary" @click="router.push('/transactions/sell'); successModal = false">New SELL</button>
            <button class="wiz-modal-btn wiz-modal-btn--primary" @click="successModal = false; step = 1">Close</button>
          </div>
        </div>
      </div>
    </Teleport>

  </section>
</template>

<style scoped>
/* ── page ────────────────────────────────────────────────────────────────────── */
.wiz-page { max-width: 1100px; }
.wiz-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
.wiz-brand { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted, #718096); margin: 0 0 4px; }
.wiz-title { font-size: 24px; margin: 0; color: var(--ink, #172536); }

/* ── layout ──────────────────────────────────────────────────────────────────── */
.wiz-layout { display: grid; grid-template-columns: 230px 1fr; gap: 32px; align-items: start; }

/* ── step list ───────────────────────────────────────────────────────────────── */
.wiz-steps { display: flex; flex-direction: column; }
.wiz-step { display: grid; grid-template-columns: 36px 1fr; grid-template-rows: auto 1fr; gap: 0 12px; }
.wiz-step-indicator {
  grid-row: 1; grid-column: 1;
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center;
  border: 2px solid var(--border-color, #d9e0ea);
  background: var(--surface-color, #fff);
  font-size: 11px; font-weight: 800; color: var(--muted, #718096);
  z-index: 1;
}
.wiz-step.is-done  .wiz-step-indicator { background: #168a7b; border-color: #168a7b; color: #fff; }
.wiz-step.is-active .wiz-step-indicator { background: #0b1f33; border-color: #0b1f33; color: #fff; }
.wiz-step-check { font-size: 14px; }
.wiz-step-line {
  grid-row: 2; grid-column: 1;
  width: 2px; height: 32px; margin: 2px auto 0;
  background: var(--border-color, #d9e0ea);
}
.wiz-step.is-done .wiz-step-line { background: #168a7b; }
.wiz-step-copy { grid-row: 1; grid-column: 2; padding-bottom: 32px; }
.wiz-step-copy strong { display: block; font-size: 13px; color: var(--ink, #172536); line-height: 1.3; }
.wiz-step-copy span { font-size: 11px; color: var(--muted, #718096); line-height: 1.4; }
.wiz-step.is-active .wiz-step-copy strong { color: #0b1f33; font-weight: 800; }

/* ── panel ───────────────────────────────────────────────────────────────────── */
.wiz-panel {
  background: var(--surface-color, #fff);
  border: 1px solid var(--border-color, #e1e7ef);
  border-radius: 14px; padding: 28px;
  display: flex; flex-direction: column; gap: 20px;
  box-shadow: 0 4px 18px rgba(15,32,50,.06);
}
.wiz-panel-header h3 { font-size: 18px; margin: 0 0 4px; }
.wiz-panel-header p  { margin: 0; font-size: 13px; color: var(--muted, #718096); }

/* ── section labels ──────────────────────────────────────────────────────────── */
.wiz-section-label {
  font-size: 10px; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase; color: var(--muted, #718096);
  padding-bottom: 6px; border-bottom: 1px solid var(--border-color, #e1e7ef);
}
.wiz-confirm-label {
  font-size: 13px; font-weight: 700; color: var(--ink, #172536);
  padding-bottom: 10px; border-bottom: 1px solid var(--border-color, #e1e7ef);
}

/* ── form fields ─────────────────────────────────────────────────────────────── */
.wiz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.wiz-field { display: flex; flex-direction: column; gap: 6px; }
.wiz-field label { font-size: 12px; font-weight: 700; color: var(--ink, #344054); }
.wiz-input {
  padding: 10px 12px; border: 1px solid var(--border-color, #d6dde7);
  border-radius: 8px; font: inherit; font-size: 14px;
  background: var(--surface-color, #fff); color: var(--ink, #263449);
  width: 100%; box-sizing: border-box;
}
.wiz-input:focus { outline: none; border-color: #168a7b; box-shadow: 0 0 0 3px rgba(22,138,123,.12); }
.wiz-error-inline { margin: 0; font-size: 11px; color: #c0392b; }
.wiz-error-box { margin: 0; padding: 10px 14px; background: #fff0ef; color: #a52c28; border-radius: 8px; font-size: 13px; }
.wiz-hint { margin: 0; font-size: 12px; color: var(--muted, #718096); }

/* ── customer search ─────────────────────────────────────────────────────────── */
.wiz-search-row { display: flex; gap: 8px; }
.wiz-search-row input { flex: 1; }
.wiz-dropdown { border: 1px solid var(--border-color, #d9e0ea); border-radius: 9px; overflow: hidden; max-height: 200px; overflow-y: auto; }
.wiz-dropdown-item { display: flex; justify-content: space-between; gap: 12px; width: 100%; padding: 10px 13px; border: 0; border-bottom: 1px solid var(--border-color, #edf1f5); background: transparent; text-align: left; cursor: pointer; font: inherit; }
.wiz-dropdown-item:hover { background: var(--surface-muted, #f8fafc); }
.wiz-dropdown-item strong { font-size: 13px; }
.wiz-dropdown-item span { font-size: 12px; color: var(--muted, #718096); }
.wiz-selected-note { margin: 0; font-size: 12px; color: #168a7b; font-weight: 700; }

/* ── currency grid ───────────────────────────────────────────────────────────── */
.wiz-currency-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
.wiz-currency-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 8px; border: 1px solid var(--border-color, #e1e7ef);
  border-radius: 10px; background: var(--surface-color, #fff);
  cursor: pointer; font: inherit; transition: border-color .15s;
}
.wiz-currency-card:hover { border-color: #168a7b; }
.wiz-currency-card.is-selected { border-color: #168a7b; border-width: 2px; background: #e8f7f0; }
.wiz-currency-card strong { font-size: 13px; color: var(--ink, #172536); }
.wiz-currency-card span { font-size: 10px; color: var(--muted, #718096); text-align: center; }
.wiz-flag { width: 40px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid var(--border-color, #e1e7ef); }
.wiz-flag-placeholder { width: 40px; height: 28px; border-radius: 4px; background: #edf2f7; display: grid; place-items: center; font-size: 10px; font-weight: 800; color: var(--muted, #718096); }

/* ── ETB calc box ────────────────────────────────────────────────────────────── */
.wiz-calc-box {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 1px; background: var(--border-color, #e1e7ef);
  border: 1px solid var(--border-color, #e1e7ef); border-radius: 10px; overflow: hidden;
}
.wiz-calc-box > div { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; background: var(--surface-muted, #f8fafc); }
.wiz-calc-box > div span { font-size: 11px; color: var(--muted, #718096); }
.wiz-calc-box > div strong { font-size: 15px; font-variant-numeric: tabular-nums; color: var(--ink, #172536); }
.wiz-calc-total { background: #e8f7f0 !important; }
.wiz-calc-total strong { color: #168a7b; font-size: 17px; }

/* ── review ──────────────────────────────────────────────────────────────────── */
.wiz-review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.wiz-review-section { border: 1px solid var(--border-color, #e1e7ef); border-radius: 10px; padding: 16px; }
.wiz-review-section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.wiz-review-section-header strong { font-size: 13px; color: var(--ink, #172536); }
.wiz-review-icon { font-size: 18px; }
.wiz-review-rows { display: flex; flex-direction: column; gap: 7px; }
.wiz-review-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12px; }
.wiz-review-row span { color: var(--muted, #718096); flex-shrink: 0; }
.wiz-review-row strong { text-align: right; color: var(--ink, #172536); }
.wiz-review-total { padding-top: 8px; border-top: 1px solid var(--border-color, #e1e7ef); }
.wiz-review-total strong { font-size: 15px; color: #168a7b; }

/* ── footer ──────────────────────────────────────────────────────────────────── */
.wiz-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-color, #e1e7ef); }

/* ── success modal ───────────────────────────────────────────────────────────── */
.wiz-modal-backdrop { position: fixed; inset: 0; background: rgba(7,24,39,.55); display: grid; place-items: center; z-index: 50; padding: 20px; }
.wiz-modal { background: #fff; border-radius: 16px; padding: 36px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,.2); }
.wiz-modal-icon { width: 64px; height: 64px; border-radius: 50%; background: #e8f7f0; color: #168a7b; font-size: 28px; font-weight: 800; display: grid; place-items: center; margin: 0 auto 20px; }
.wiz-modal h3 { font-size: 20px; margin: 0 0 10px; color: #172536; }
.wiz-modal p { font-size: 14px; color: #718096; margin: 0 0 24px; line-height: 1.6; }
.wiz-modal p strong { color: #172536; }
.wiz-modal-actions { display: flex; gap: 10px; justify-content: center; }
.wiz-modal-btn { padding: 10px 22px; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; border: none; }
.wiz-modal-btn--primary   { background: #168a7b; color: #fff; }
.wiz-modal-btn--primary:hover { background: #117467; }
.wiz-modal-btn--secondary { background: #f1f5f9; color: #344054; border: 1px solid #d6dde7; }
.wiz-modal-btn--secondary:hover { background: #e8edf3; }

/* ── responsive ──────────────────────────────────────────────────────────────── */
@media (max-width: 860px) {
  .wiz-layout { grid-template-columns: 1fr; }
  .wiz-steps { flex-direction: row; gap: 0; overflow-x: auto; padding-bottom: 4px; }
  .wiz-step { grid-template-columns: auto; grid-template-rows: auto auto; justify-items: center; min-width: 80px; }
  .wiz-step-line { grid-row: 1; grid-column: 2; width: 100%; height: 2px; margin: 17px 0; }
  .wiz-step-copy { display: none; }
}
@media (max-width: 600px) {
  .wiz-panel { padding: 18px; }
  .wiz-grid { grid-template-columns: 1fr; }
  .wiz-review-grid { grid-template-columns: 1fr; }
  .wiz-calc-box { grid-template-columns: 1fr; }
}
</style>

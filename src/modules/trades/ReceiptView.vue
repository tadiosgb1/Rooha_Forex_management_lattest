<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { forexTransactionService } from '../../services/forexTransactionService'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const transaction = ref(null)
const qrCode = ref('')
const id = computed(() => String(route.params.id || ''))

function unwrap(response) {
  let value = response
  for (let depth = 0; depth < 5; depth += 1) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    const next = value.data ?? value.transaction ?? value.forex_transaction ?? value.record
    if (next === undefined || next === value) return value
    value = next
  }
  return value
}
function first(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') ?? '—'
}
function personName(person) {
  if (!person || typeof person !== 'object') return person
  return first(person.fullname, person.full_name, person.customer_name, person.name, [person.first_name, person.last_name].filter(Boolean).join(' '), person.display_name)
}
function money(value, digits = 2) {
  const number = Number(value)
  return Number.isFinite(number)
    ? number.toLocaleString('en-ET', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—'
}
const details = computed(() => {
  const row = transaction.value || {}
  const currency = row.currency && typeof row.currency === 'object' ? row.currency : row.reference_currency || {}
  const customer = row.customer_profile ?? row.customer ?? {}
  const amount = Number(first(row.fcy_amount, row.foreign_amount, row.amount, row.transaction_amount))
  const rate = Number(first(row.applied_rate, row.exchange_rate, row.rate))
  const etb = Number(first(row.etb_amount, row.local_amount, row.total_etb, Number.isFinite(amount) && Number.isFinite(rate) ? amount * rate : NaN))
  return {
    reference: first(row.reference, row.reference_number, row.transaction_reference, row.transaction_code, row.receipt_number, row.code, row.id),
    customer: first(personName(customer), row.customer_name, row.customer_full_name, row.customer_profile_name),
    direction: first(row.transaction_type, row.direction, row.type).toString().toUpperCase(),
    currency: first(currency.code, currency.currency_code, row.currency_code, row.currency_name, row.currency_id),
    amount: Number.isFinite(amount) ? money(amount) : first(row.fcy_amount, row.amount),
    rate: Number.isFinite(rate) ? money(rate, 4) : first(row.applied_rate, row.exchange_rate, row.rate),
    etb: Number.isFinite(etb) ? money(etb) : '—',
    fee: row.service_fee == null ? '—' : money(row.service_fee),
    payment: first(row.payment_method),
    status: first(row.status, row.transaction_status, 'RECORDED'),
    date: first(row.created_at, row.createdAt, row.transaction_date, row.created_date, row.date),
  }
})
async function makeQr() {
  if (!transaction.value) return
  const payload = JSON.stringify({
    type: 'FX_TRANSACTION_RECEIPT',
    transactionId: id.value,
    reference: details.value.reference,
  })
  try {
    qrCode.value = await QRCode.toDataURL(payload, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
  } catch {
    qrCode.value = ''
  }
}
function printReceipt() { window.print() }
async function load() {
  loading.value = true
  error.value = ''
  transaction.value = null
  qrCode.value = ''
  try {
    const response = await forexTransactionService.get(id.value)
    const record = unwrap(response)
    transaction.value = record && typeof record === 'object' && !Array.isArray(record) ? record : null
    if (!transaction.value) error.value = 'The API did not return this transaction.'
    else await makeQr()
  } catch (err) {
    error.value = err?.message || 'Unable to load this transaction receipt.'
  } finally {
    loading.value = false
  }
}
watch(id, load)
onMounted(load)
</script>

<template>
  <section class="module-page receipt-page">
    <div class="module-page-intro receipt-heading no-print">
      <div><h2>Transaction receipt</h2><p class="receipt-subtitle">Official transaction details and QR reference.</p></div>
      <div class="receipt-actions">
        <BaseButton variant="secondary" @click="router.push('/trades')">← Back to register</BaseButton>
        <BaseButton :disabled="!transaction" @click="printReceipt">Print receipt</BaseButton>
      </div>
    </div>
    <BaseCard class="receipt-card">
      <p v-if="loading" class="receipt-state">Loading receipt…</p>
      <div v-else-if="error" class="receipt-error" role="alert">
        <p>{{ error }}</p>
        <BaseButton variant="secondary" @click="load">Try again</BaseButton>
      </div>
      <article v-else-if="transaction" class="receipt-document">
        <header class="receipt-brand">
          <div><p class="receipt-kicker">FOREIGN EXCHANGE TRANSACTION</p><h1>Transaction Receipt</h1><p class="receipt-thankyou">Thank you. Please keep this receipt for your records.</p></div>
          <div class="receipt-qr" aria-label="Receipt QR code">
            <img v-if="qrCode" :src="qrCode" alt="QR code containing the transaction receipt reference" />
            <span v-else>QR unavailable</span>
            <small>Scan for receipt reference</small>
          </div>
        </header>
        <div class="receipt-reference"><span>Receipt reference</span><strong>{{ details.reference }}</strong></div>
        <div class="receipt-direction" :class="details.direction === 'BUY' ? 'is-buy' : 'is-sell'">{{ details.direction }} TRANSACTION</div>
        <dl class="receipt-grid">
          <div><dt>Customer</dt><dd>{{ details.customer }}</dd></div>
          <div><dt>Transaction date</dt><dd>{{ details.date }}</dd></div>
          <div><dt>Currency</dt><dd>{{ details.currency }}</dd></div>
          <div><dt>Foreign amount</dt><dd>{{ details.amount }} {{ details.currency }}</dd></div>
          <div><dt>Applied exchange rate</dt><dd>{{ details.rate }} ETB</dd></div>
          <div><dt>ETB equivalent</dt><dd>{{ details.etb }} ETB</dd></div>
          <div><dt>Service fee</dt><dd>{{ details.fee }} ETB</dd></div>
          <div><dt>Payment method</dt><dd>{{ details.payment }}</dd></div>
          <div><dt>Transaction status</dt><dd>{{ details.status }}</dd></div>
        </dl>
        <footer class="receipt-footer">
          <strong>Rooha Forex Management</strong>
          <p>This receipt reflects the transaction record returned by the system. Keep it as proof of the recorded transaction.</p>
          <small>QR contains the transaction ID and receipt reference only; no customer identity data.</small>
        </footer>
      </article>
    </BaseCard>
  </section>
</template>

<style scoped>
.receipt-subtitle { margin:6px 0 0;color:var(--text-muted,#778196);font-size:.9rem; }
.receipt-actions { display:flex;gap:10px;flex-wrap:wrap; }
.receipt-card { padding:28px; }
.receipt-document { max-width:850px;margin:0 auto;color:#1e293b; }
.receipt-brand { display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:22px;border-bottom:2px solid #dce3ed; }
.receipt-kicker { margin:0 0 8px;color:#64748b;font-size:.72rem;font-weight:800;letter-spacing:.12em; }
.receipt-brand h1 { margin:0;font-size:1.8rem; }
.receipt-thankyou { color:#64748b;margin:8px 0 0; }
.receipt-qr { display:flex;flex-direction:column;align-items:center;gap:7px;min-width:150px; }
.receipt-qr img { width:136px;height:136px;object-fit:contain; }
.receipt-qr small { color:#64748b;font-size:.72rem; }
.receipt-reference { display:flex;justify-content:space-between;gap:18px;padding:17px 0;border-bottom:1px solid #e2e8f0; }
.receipt-reference span,.receipt-grid dt { color:#64748b;font-size:.8rem; }
.receipt-reference strong { overflow-wrap:anywhere; }
.receipt-direction { display:inline-flex;margin:18px 0;padding:7px 12px;border-radius:7px;font-size:.75rem;font-weight:800;letter-spacing:.06em; }
.receipt-direction.is-buy { background:#e8f7ee;color:#17663f; }
.receipt-direction.is-sell { background:#fff0ef;color:#a52c28; }
.receipt-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px;margin:0; }
.receipt-grid div { padding:14px 0;border-bottom:1px solid #e2e8f0;min-width:0; }
.receipt-grid dt { margin-bottom:6px; }
.receipt-grid dd { margin:0;font-weight:700;overflow-wrap:anywhere; }
.receipt-footer { margin-top:26px;padding-top:18px;border-top:1px solid #dce3ed;text-align:center; }
.receipt-footer p { color:#64748b;font-size:.8rem; }
.receipt-footer small { color:#94a3b8;font-size:.7rem; }
.receipt-state { padding:30px;text-align:center;color:#64748b; }
.receipt-error { display:flex;justify-content:space-between;align-items:center;gap:16px;color:#a52c28; }
@media(max-width:600px) { .receipt-brand { flex-direction:column; } .receipt-grid { grid-template-columns:1fr; } .receipt-reference { flex-direction:column;gap:5px; } }
@media print {
  :global(body) { background:#fff !important; }
  .no-print { display:none !important; }
  .receipt-page { padding:0 !important; }
  .receipt-card { border:0 !important;box-shadow:none !important;padding:0 !important; }
  .receipt-document { max-width:none; }
}
</style>

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
const rows = computed(() => {
  const row = transaction.value || {}
  const source = row.currencies ?? row.currency_lines ?? row.transaction_currencies ?? row.items ?? row.details
  if (Array.isArray(source) && source.length) {
    return source.map((item, index) => {
      const currency = item.currency && typeof item.currency === 'object' ? item.currency : item.reference_currency || {}
      const code = first(currency.code, currency.currency_code, item.currency_code, item.currency_name, item.currency_id)
      const amount = Number(first(item.fcy_amount, item.foreign_amount, item.amount, 0))
      const rate = Number(first(item.applied_rate, item.exchange_rate, item.rate, 0))
      const local = Number(first(item.etb_amount, item.local_amount, item.lc_amount, amount * rate))
      return { number: index + 1, currency: code, type: first(item.transaction_type, row.transaction_type, row.direction, 'BUY'), amount, rate, local }
    })
  }
  const currency = row.currency && typeof row.currency === 'object' ? row.currency : row.reference_currency || {}
  const amount = Number(first(row.fcy_amount, row.foreign_amount, row.amount, row.transaction_amount, 0))
  const rate = Number(first(row.applied_rate, row.exchange_rate, row.rate, 0))
  return [{
    number: 1,
    currency: first(currency.code, currency.currency_code, row.currency_code, row.currency_name, row.currency_id),
    type: first(row.transaction_type, row.direction, row.type, 'BUY'),
    amount,
    rate,
    local: Number(first(row.etb_amount, row.local_amount, row.total_etb, amount * rate)),
  }]
})
const totalEtb = computed(() => {
  const explicit = Number(transaction.value?.total_etb ?? transaction.value?.etb_amount ?? transaction.value?.local_amount)
  return Number.isFinite(explicit) && explicit > 0 ? explicit : rows.value.reduce((sum, item) => sum + (Number.isFinite(item.local) ? item.local : 0), 0)
})
const amountInWords = computed(() => {
  const value = Math.round(totalEtb.value * 100) / 100
  const birr = Math.floor(value)
  const cents = Math.round((value - birr) * 100)
  const ones = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function words(n) {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + words(n % 100) : '')
    for (const [size, label] of [[1000000000,'Billion'],[1000000,'Million'],[1000,'Thousand']]) {
      if (n >= size) return words(Math.floor(n / size)) + ' ' + label + (n % size ? ' ' + words(n % size) : '')
    }
    return ''
  }
  return words(birr) + ' Birr' + (cents ? ' and ' + words(cents) + ' Cents' : ' Only')
})
const details = computed(() => {
  const row = transaction.value || {}
  const customer = row.customer_profile ?? row.customer ?? {}
  const direction = String(first(row.transaction_type, row.direction, row.type, 'BUY')).toUpperCase()
  const payment = String(first(row.payment_method, 'CASH')).toUpperCase()
  return {
    title: direction === 'BUY' ? 'FC PURCHASE VOUCHER' : 'FC SALES VOUCHER',
    reference: first(row.reference, row.reference_number, row.transaction_reference, row.transaction_code, row.receipt_number, row.code, row.id),
    branch: first(row.branch?.name, row.branch_name, row.branch?.branch_name, row.branch),
    customer: first(personName(customer), row.customer_name, row.customer_full_name, row.customer_profile_name),
    phone: first(customer.phone_number, customer.phone, row.customer_phone, row.phone_number),
    teller: first(row.teller?.fullname, row.teller_name, row.created_by?.fullname, row.cashier_name, row.user?.fullname),
    date: first(row.transaction_date, row.created_at, row.createdAt, row.created_date, row.date),
    payment,
    direction,
  }
})
async function makeQr() {
  if (!transaction.value) return
  try {
    qrCode.value = await QRCode.toDataURL(JSON.stringify({
      type: 'FX_TRANSACTION_RECEIPT',
      transactionId: id.value,
      reference: details.value.reference,
    }), { width: 220, margin: 1, errorCorrectionLevel: 'M' })
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
      <div><h2>Transaction receipt</h2><p class="receipt-subtitle">FC purchase / sales voucher — Original and Customer Copy.</p></div>
      <div class="receipt-actions">
        <BaseButton variant="secondary" @click="router.push('/trades')">← Back to register</BaseButton>
        <BaseButton variant="secondary" :disabled="!transaction" @click="printReceipt">Download PDF</BaseButton>
        <BaseButton :disabled="!transaction" @click="printReceipt">Print receipt</BaseButton>
      </div>
    </div>
    <BaseCard class="receipt-card">
      <p v-if="loading" class="receipt-state">Loading receipt…</p>
      <div v-else-if="error" class="receipt-error" role="alert">
        <p>{{ error }}</p><BaseButton variant="secondary" @click="load">Try again</BaseButton>
      </div>
      <div v-else-if="transaction" class="receipt-copies">
        <article v-for="copy in ['Original', 'Customer Copy']" :key="copy" class="voucher-copy">
          <header class="voucher-header">
            <div class="voucher-brand">
              <h1>ROOHA FOREX BUREAU</h1>
              <p>Regulated by National Bank of Ethiopia</p>
              <h2>{{ details.title }} [{{ details.payment }}]</h2>
            </div>
            <strong class="copy-label">{{ copy }}</strong>
          </header>
          <div class="voucher-meta">
            <div><span>Ref No</span><strong>{{ details.reference }}</strong></div>
            <div><span>Branch</span><strong>{{ details.branch }}</strong></div>
            <div><span>Date</span><strong>{{ details.date }}</strong></div>
          </div>
          <table class="voucher-table">
            <thead><tr><th>SL NO</th><th>CURRENCY</th><th>FC TYPE</th><th>FC AMOUNT</th><th>RATE</th><th>LC AMOUNT (ETB)</th></tr></thead>
            <tbody>
              <tr v-for="item in rows" :key="item.number">
                <td>{{ item.number }}</td><td>{{ item.currency }}</td><td>{{ item.type }}</td>
                <td>{{ money(item.amount) }}</td><td>{{ money(item.rate, 4) }}</td><td>{{ money(item.local) }}</td>
              </tr>
            </tbody>
            <tfoot><tr><td colspan="5">Total Amount (ETB)</td><td>{{ money(totalEtb) }}</td></tr></tfoot>
          </table>
          <p class="voucher-words"><strong>Amount in Words:</strong> {{ amountInWords }}</p>
          <div class="voucher-parties">
            <div><span>Teller Name</span><strong>{{ details.teller }}</strong></div>
            <div><span>Customer Name</span><strong>{{ details.customer }}</strong></div>
            <div><span>Customer Contact</span><strong>{{ details.phone }}</strong></div>
          </div>
          <div class="voucher-signatures">
            <div><span>Customer Signature</span><i></i></div>
            <div><span>Cashier Signature & Official Stamp</span><i></i></div>
          </div>
          <div class="voucher-legal">
            <p>This receipt is not valid without cashier signature and official stamp.</p>
            <p>NB: Please check details carefully before signing. I have read and verified the date entered and found it to be correct as per the information I have provided.</p>
            <p>For inquiries or complaints: +251960444333 / +2519115083443</p>
          </div>
          <div class="voucher-bottom">
            <small>ROOHA FOREX BUREAU • {{ details.reference }}</small>
            <div class="voucher-qr"><img v-if="qrCode" :src="qrCode" alt="Transaction verification QR code" /><span v-else>QR unavailable</span><small>Verify transaction</small></div>
          </div>
        </article>
      </div>
    </BaseCard>
  </section>
</template>

<style scoped>
.receipt-subtitle{margin:6px 0 0;color:var(--text-muted,#778196);font-size:.9rem}.receipt-actions{display:flex;gap:10px;flex-wrap:wrap}.receipt-card{padding:24px}.receipt-copies{max-width:1000px;margin:0 auto;color:#17212f}.voucher-copy{position:relative;padding:24px 28px 20px;border:1px solid #aeb8c5;background:#fff;page-break-inside:avoid}.voucher-copy+.voucher-copy{margin-top:22px}.voucher-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:2px solid #243247}.voucher-brand{text-align:center;flex:1}.voucher-brand h1{margin:0;font-size:1.35rem;letter-spacing:.06em}.voucher-brand p{margin:4px 0;font-size:.78rem}.voucher-brand h2{margin:9px 0 0;font-size:1rem}.copy-label{padding:6px 9px;border:1px solid #475569;border-radius:3px;font-size:.78rem}.voucher-meta{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:14px;padding:15px 0}.voucher-meta div,.voucher-parties div{display:flex;flex-direction:column;gap:4px;min-width:0}.voucher-meta span,.voucher-parties span{font-size:.72rem;color:#526174}.voucher-meta strong,.voucher-parties strong{font-size:.82rem;overflow-wrap:anywhere}.voucher-table{width:100%;border-collapse:collapse;font-size:.76rem}.voucher-table th,.voucher-table td{padding:9px 7px;border:1px solid #9aa6b5;text-align:left}.voucher-table th{background:#eef2f6;font-size:.67rem}.voucher-table td:nth-child(1),.voucher-table td:nth-child(4),.voucher-table td:nth-child(5),.voucher-table td:nth-child(6){font-variant-numeric:tabular-nums}.voucher-table tfoot td{font-weight:800;background:#f5f7f9}.voucher-table tfoot td:last-child{text-align:right}.voucher-words{margin:14px 0;padding:10px;border:1px solid #cbd5e1;font-size:.78rem}.voucher-parties{display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;padding:12px 0}.voucher-signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:12px 0}.voucher-signatures div{display:flex;flex-direction:column;gap:25px;font-size:.72rem}.voucher-signatures i{display:block;border-bottom:1px solid #475569}.voucher-legal{padding-top:9px;border-top:1px solid #cbd5e1;font-size:.67rem;line-height:1.45}.voucher-legal p{margin:4px 0}.voucher-bottom{display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px}.voucher-bottom>small{color:#64748b;font-size:.62rem}.voucher-qr{display:flex;flex-direction:column;align-items:center;gap:3px}.voucher-qr img{width:82px;height:82px}.voucher-qr small{font-size:.6rem;color:#526174}.receipt-state{padding:30px;text-align:center;color:#64748b}.receipt-error{display:flex;justify-content:space-between;align-items:center;gap:16px;color:#a52c28}
@media(max-width:650px){.receipt-card{padding:10px}.voucher-copy{padding:14px 10px}.voucher-brand h1{font-size:1rem}.voucher-brand h2{font-size:.8rem}.voucher-meta,.voucher-parties{grid-template-columns:1fr 1fr}.voucher-table{font-size:.62rem}.voucher-table th,.voucher-table td{padding:6px 3px}.voucher-table th{font-size:.56rem}.voucher-signatures{gap:15px}}
@media print{@page{size:A4 portrait;margin:10mm}:global(body){background:#fff!important}.no-print{display:none!important}.receipt-page{padding:0!important}.receipt-card{border:0!important;box-shadow:none!important;padding:0!important}.receipt-copies{max-width:none}.voucher-copy{padding:12mm 10mm 8mm;border:1px solid #333;min-height:132mm;break-inside:avoid}.voucher-copy+.voucher-copy{margin-top:0;break-before:page}.voucher-table th{background:#e9edf2!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>

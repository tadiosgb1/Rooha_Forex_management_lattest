<script setup>
/**
 * TradeDetailView
 * Full detail page for a single trade transaction.
 * GET /trade-transactions/:id
 */
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tradeTransactionService } from '../../services/tradeTransactionService'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseButton from '../../components/ui/BaseButton.vue'

const route  = useRoute()
const router = useRouter()
const id     = computed(() => route.params.id)

const tx      = ref(null)
const loading = ref(false)
const error   = ref('')

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
function fmtDate(v) {
  if (!v) return 'N/A'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}
function fmtDay(v) {
  if (!v) return 'N/A'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString()
}
function statusTone(s) {
  const v = String(s ?? '').toUpperCase()
  if (v === 'APPROVED') return 'success'
  if (v === 'REJECTED') return 'danger'
  if (v === 'REVERSED') return 'warning'
  return 'warning'
}
function val(v, fallback = 'N/A') {
  return (v !== null && v !== undefined && String(v).trim() !== '') ? v : fallback
}

const isBuy = computed(() => String(tx.value?.transaction_type).toUpperCase() === 'BUY')

// ─── load ─────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  error.value   = ''
  tx.value      = null
  try {
    const res  = await tradeTransactionService.get(id.value)
    tx.value   = res?.data ?? res
  } catch (e) {
    error.value = e?.message || 'Could not load transaction.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="module-page td-page">

    <!-- header -->
    <div class="td-header">
      <BaseButton variant="secondary" size="sm" @click="router.back()">← Back</BaseButton>
      <div v-if="tx" class="td-title-row">
        <div>
          <p class="td-eyebrow">Transaction Detail</p>
          <h2 class="td-title" :class="isBuy ? 'td-title--buy' : 'td-title--sell'">
            {{ isBuy ? 'Purchase of Foreign Cash Notes' : 'Sales of Foreign Cash Notes' }}
          </h2>
        </div>
        <BaseBadge :tone="statusTone(tx.status)" class="td-status-badge">
          {{ tx.status }}
        </BaseBadge>
      </div>
    </div>

    <!-- loading / error -->
    <p v-if="loading" class="td-state">Loading transaction…</p>
    <p v-else-if="error" class="td-error">{{ error }}</p>

    <template v-else-if="tx">

      <!-- ── top metadata row ──────────────────────────────────────────────── -->
      <div class="td-meta-bar">
        <div class="td-meta-item"><span>Transaction ID</span><strong>{{ String(tx.id).slice(0,8).toUpperCase() }}…</strong></div>
        <div class="td-meta-item"><span>Type</span><strong :class="isBuy ? 'td-buy' : 'td-sell'">{{ tx.transaction_type }}</strong></div>
        <div class="td-meta-item"><span>Payment</span><strong>{{ tx.payment_method === 'BANK' ? '🏦 Bank' : '💵 Cash' }}</strong></div>
        <div class="td-meta-item"><span>Created</span><strong>{{ fmtDate(tx.created_at) }}</strong></div>
      </div>

      <div class="td-grid">

        <!-- ── Customer ───────────────────────────────────────────────────── -->
        <div class="td-card">
          <div class="td-card-header"><span class="td-icon">👤</span><strong>Customer</strong></div>
          <div class="td-rows">
            <div class="td-row"><span>Full Name</span><strong>{{ val(tx.customer_fullname) }}</strong></div>
            <div class="td-row"><span>Phone</span><strong>{{ val(tx.customer_phone) }}</strong></div>
            <div class="td-row"><span>Nationality</span><strong>{{ val(tx.customer_nationality) }}</strong></div>
            <div class="td-row"><span>City</span><strong>{{ val(tx.customer_city) }}</strong></div>
            <div class="td-row" v-if="tx.customer_sub_city"><span>Sub-city</span><strong>{{ tx.customer_sub_city }}</strong></div>
            <div class="td-row" v-if="tx.customer_woreda"><span>Woreda</span><strong>{{ tx.customer_woreda }}</strong></div>
          </div>
        </div>

        <!-- ── Identification ─────────────────────────────────────────────── -->
        <div class="td-card">
          <div class="td-card-header"><span class="td-icon">🪪</span><strong>Identification</strong></div>
          <div class="td-rows">
            <div class="td-row"><span>ID Number</span><strong>{{ val(tx.customer_id_number) }}</strong></div>
            <div class="td-row"><span>Issue Date</span><strong>{{ fmtDay(tx.customer_id_issue_date) }}</strong></div>
            <div class="td-row"><span>Expiry Date</span><strong>{{ fmtDay(tx.customer_id_expiry_date) }}</strong></div>
          </div>
        </div>

        <!-- ── Payment / Bank ─────────────────────────────────────────────── -->
        <div class="td-card">
          <div class="td-card-header"><span class="td-icon">💳</span><strong>Payment</strong></div>
          <div class="td-rows">
            <div class="td-row"><span>Method</span><strong>{{ tx.payment_method === 'BANK' ? 'Cash at Bank' : 'Cash at Hand' }}</strong></div>
            <template v-if="tx.payment_method === 'BANK'">
              <div class="td-row"><span>Account No.</span><strong>{{ val(tx.bank_account_number) }}</strong></div>
              <div class="td-row"><span>Account Name</span><strong>{{ val(tx.bank_account_name) }}</strong></div>
            </template>
          </div>
        </div>

        <!-- ── SELL Travel Info ───────────────────────────────────────────── -->
        <div v-if="!isBuy" class="td-card">
          <div class="td-card-header"><span class="td-icon">✈️</span><strong>Travel Information</strong></div>
          <div class="td-rows">
            <div class="td-row"><span>Purpose</span><strong>{{ val(tx.sell_purpose) }}</strong></div>
            <div class="td-row"><span>Visa No.</span><strong>{{ val(tx.visa_number) }}</strong></div>
            <div class="td-row"><span>Visa Issue</span><strong>{{ fmtDay(tx.visa_issue_date) }}</strong></div>
            <div class="td-row"><span>Visa Expiry</span><strong>{{ fmtDay(tx.visa_expiry_date) }}</strong></div>
            <div class="td-row"><span>Air Ticket No.</span><strong>{{ val(tx.air_ticket_number) }}</strong></div>
            <div class="td-row"><span>Ticket Issue</span><strong>{{ fmtDay(tx.air_ticket_issue_date) }}</strong></div>
            <div class="td-row"><span>Ticket Expiry</span><strong>{{ fmtDay(tx.air_ticket_expiry_date) }}</strong></div>
            <div class="td-row"><span>Travel Date</span><strong>{{ fmtDay(tx.travel_date) }}</strong></div>
          </div>
        </div>

        <!-- ── Currency Items ─────────────────────────────────────────────── -->
        <div class="td-card td-card--full">
          <div class="td-card-header"><span class="td-icon">💱</span><strong>Currency Lines</strong></div>
          <table class="td-items-table">
            <thead>
              <tr>
                <th>Currency</th>
                <th>FCY Amount</th>
                <th>Rate (ETB)</th>
                <th>Total ETB</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in (tx.items ?? [])" :key="item.id">
                <td>
                  <span class="td-currency-chip" :class="isBuy ? 'buy' : 'sell'">
                    {{ item.currency_code ?? '—' }}
                  </span>
                  <small style="color:#718096;margin-left:6px">{{ item.currency_name ?? '' }}</small>
                </td>
                <td><strong>{{ fmt(item.fcy_amount) }}</strong></td>
                <td>{{ fmt(item.rate) }}</td>
                <td><strong>{{ fmt(item.total_amount_etb) }} ETB</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ── Totals ─────────────────────────────────────────────────────── -->
        <div class="td-card td-card--totals">
          <div class="td-card-header"><span class="td-icon">🧾</span><strong>Totals</strong></div>
          <div class="td-rows">
            <div class="td-row"><span>FCY → ETB</span><strong>{{ fmt(tx.total_fcy_etb) }} ETB</strong></div>
            <div class="td-row"><span>Service fee</span><strong>{{ fmt(tx.service_fee_etb) }} ETB</strong></div>
            <div class="td-row td-row--total"><span>Total Amount</span><strong>{{ fmt(tx.total_amount_etb) }} ETB</strong></div>
          </div>
        </div>

        <!-- ── Approval ───────────────────────────────────────────────────── -->
        <div class="td-card">
          <div class="td-card-header"><span class="td-icon">✅</span><strong>Approval Workflow</strong></div>
          <div class="td-rows">
            <div class="td-row"><span>Status</span>
              <BaseBadge :tone="statusTone(tx.status)">{{ tx.status }}</BaseBadge>
            </div>
            <div class="td-row" v-if="tx.approved_at"><span>Approved at</span><strong>{{ fmtDate(tx.approved_at) }}</strong></div>
            <div class="td-row" v-if="tx.rejected_at"><span>Rejected at</span><strong>{{ fmtDate(tx.rejected_at) }}</strong></div>
            <div class="td-row" v-if="tx.rejection_reason"><span>Reason</span><strong>{{ tx.rejection_reason }}</strong></div>
            <div class="td-row" v-if="tx.reversed_at"><span>Reversed at</span><strong>{{ fmtDate(tx.reversed_at) }}</strong></div>
            <div class="td-row" v-if="tx.reversal_reason"><span>Reversal reason</span><strong>{{ tx.reversal_reason }}</strong></div>
          </div>
        </div>

      </div>
    </template>

  </section>
</template>

<style scoped>
.td-page { max-width: 1100px; }

/* header */
.td-header { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
.td-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.td-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted, #718096); margin: 0 0 4px; }
.td-title { font-size: 22px; margin: 0; }
.td-title--buy  { color: #145c3c; }
.td-title--sell { color: #9a4a00; }
.td-status-badge { font-size: 13px; padding: 6px 14px; }

/* meta bar */
.td-meta-bar { display: flex; gap: 0; margin-bottom: 20px; border: 1px solid var(--border-color, #e1e7ef); border-radius: 10px; overflow: hidden; }
.td-meta-item { flex: 1; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; background: var(--surface-muted, #f8fafc); border-right: 1px solid var(--border-color, #e1e7ef); }
.td-meta-item:last-child { border-right: none; }
.td-meta-item span { font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--muted, #718096); }
.td-meta-item strong { font-size: 14px; color: var(--ink, #172536); }
.td-buy  { color: #145c3c !important; }
.td-sell { color: #9a4a00 !important; }

/* grid */
.td-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* cards */
.td-card { background: var(--surface-color, #fff); border: 1px solid var(--border-color, #e1e7ef); border-radius: 12px; padding: 18px; }
.td-card--full   { grid-column: 1 / -1; }
.td-card--totals { border-top: 3px solid #1769d2; }
.td-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color, #e1e7ef); }
.td-card-header strong { font-size: 13px; color: var(--ink, #172536); }
.td-icon { font-size: 18px; }

/* rows */
.td-rows { display: flex; flex-direction: column; gap: 8px; }
.td-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; }
.td-row span { color: var(--muted, #718096); flex-shrink: 0; }
.td-row strong { text-align: right; color: var(--ink, #172536); }
.td-row--total { padding-top: 8px; border-top: 1px solid var(--border-color, #e1e7ef); }
.td-row--total strong { font-size: 16px; color: #1769d2; }

/* items table */
.td-items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.td-items-table th { background: #f0f4f8; color: #3a5068; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; padding: 10px 12px; text-align: left; }
.td-items-table td { padding: 11px 12px; border-top: 1px solid var(--border-color, #e1e7ef); }
.td-currency-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.td-currency-chip.buy  { background: #e8f7f0; color: #145c3c; }
.td-currency-chip.sell { background: #fff5df; color: #9a4a00; }

/* state */
.td-state { padding: 32px; text-align: center; color: var(--muted, #718096); }
.td-error { padding: 12px 16px; background: #fff0ef; color: #a52c28; border-radius: 8px; font-size: 13px; }

@media (max-width: 720px) {
  .td-grid { grid-template-columns: 1fr; }
  .td-card--full { grid-column: auto; }
  .td-meta-bar { flex-direction: column; }
  .td-meta-item { border-right: none; border-bottom: 1px solid var(--border-color, #e1e7ef); }
  .td-meta-item:last-child { border-bottom: none; }
}
</style>

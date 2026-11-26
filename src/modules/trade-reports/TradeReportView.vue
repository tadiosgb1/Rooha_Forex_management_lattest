<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { tradeTransactionService } from '../../services/tradeTransactionService'
import { hasAnyPermission } from '../../utils/permissions'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseCard from '../../components/ui/BaseCard.vue'

const props  = defineProps({ transactionType: { type: String, required: true } })
const router = useRouter()

const PERIODS  = [
  { value: 'today', label: 'Today'     },
  { value: '7d',    label: 'Last 7 days'  },
  { value: '14d',   label: 'Last 14 days' },
  { value: '30d',   label: 'Last 30 days' },
  { value: '90d',   label: 'Last 90 days' },
  { value: 'year',  label: 'Last 365 days'},
]
const STATUSES = ['all', 'PENDING', 'APPROVED', 'REJECTED', 'REVERSED']

const rows    = ref([])
const loading = ref(false)
const error   = ref('')
const total   = ref(0)
const page    = ref(1)
const limit   = ref(20)
const search  = ref('')
const period  = ref('30d')
const status  = ref('all')

const canView   = computed(() => hasAnyPermission(['forex_transactions:view', 'forex_transactions:read']))
const isBuy     = computed(() => props.transactionType === 'BUY')
const pageTitle = computed(() => isBuy.value ? 'Buy Transaction Report' : 'Sell Transaction Report')
const totalPages= computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

// ─── helpers ──────────────────────────────────────────────────────────────────
function normalizeList(r) {
  if (Array.isArray(r))              return r
  if (Array.isArray(r?.data))        return r.data
  if (Array.isArray(r?.data?.items)) return r.data.items
  return []
}
function normalizeTotal(r) {
  return r?.count ?? r?.total ?? normalizeList(r).length
}
function fmt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}
function statusTone(s) {
  const v = String(s ?? '').toUpperCase()
  if (v === 'APPROVED') return 'success'
  if (v === 'REJECTED') return 'danger'
  return 'warning'
}
function currencyList(row) {
  const items = row?.items ?? []
  if (!items.length) return '—'
  const codes = [...new Set(items.map(i => i.currency_code).filter(Boolean))]
  return codes.length ? codes.join(', ') : items.map(i => `${fmt(i.fcy_amount)} @ ${fmt(i.rate)}`).join(' | ')
}
function totalEtb(row) {
  return fmt(row?.total_amount_etb ?? row?.total_amount)
}
function customerName(row) {
  return row?.customer_fullname
    ?? (row?.customer_id ? `${String(row.customer_id).slice(0,8)}…` : '—')
}
function customerPhone(row) {
  return row?.customer_phone ?? '—'
}
function customerIdentifier(row) {
  return [row?.customer_nationality, row?.customer_city].filter(Boolean).join(', ') || '—'
}

// ─── stats ────────────────────────────────────────────────────────────────────
const stats = computed(() => ({
  total:    rows.value.length,
  approved: rows.value.filter(r => String(r.status).toUpperCase() === 'APPROVED').length,
  pending:  rows.value.filter(r => String(r.status).toUpperCase() === 'PENDING').length,
  rejected: rows.value.filter(r => String(r.status).toUpperCase() === 'REJECTED').length,
}))
const totalEtbSum = computed(() => {
  const sum = rows.value
    .filter(r => String(r.status).toUpperCase() === 'APPROVED')
    .reduce((acc, r) => acc + (Number(r.total_amount_etb ?? 0) || 0), 0)
  return fmt(sum)
})

// ─── filtered ─────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(r =>
    [customerName(r), customerPhone(r), currencyList(r), r.status, r.payment_method]
      .some(v => String(v ?? '').toLowerCase().includes(q))
  )
})

// ─── load ─────────────────────────────────────────────────────────────────────
async function load() {
  if (!canView.value) { error.value = 'You do not have permission to view this report.'; return }
  loading.value = true
  error.value   = ''
  try {
    const params = { transaction_type: props.transactionType, period: period.value, page: page.value, limit: limit.value }
    if (status.value !== 'all') params.status = status.value
    const res   = await tradeTransactionService.list(params)
    rows.value  = normalizeList(res)
    total.value = normalizeTotal(res)
  } catch (e) {
    rows.value  = []
    error.value = e?.message || 'Could not load transactions.'
  } finally {
    loading.value = false
  }
}

watch([period, status], () => { page.value = 1; load() })
watch(page, load)
onMounted(load)
</script>

<template>
  <section class="module-page">

    <!-- ── page intro ────────────────────────────────────────────────────────── -->
    <div class="module-page-intro">
      <div>
        <h2>{{ pageTitle }}</h2>
        <p class="tr-subtitle">
          {{ isBuy ? 'Foreign currency purchase' : 'Foreign currency sale' }}
          transactions filtered by period and status.
        </p>
      </div>
      <BaseButton
        class="module-primary-btn"
        @click="router.push(isBuy ? '/transactions/buy' : '/transactions/sell')"
      >
        ＋ New {{ isBuy ? 'BUY' : 'SELL' }}
      </BaseButton>
    </div>

    <!-- ── stat cards ────────────────────────────────────────────────────────── -->
    <div class="module-stat-row">
      <BaseCard class="module-stat-card" :class="isBuy ? 'tr-card--buy' : 'tr-card--sell'">
        <span>Total {{ isBuy ? 'BUY' : 'SELL' }}</span>
        <strong>{{ stats.total }}</strong>
        <small>in period</small>
      </BaseCard>
      <BaseCard class="module-stat-card">
        <span>Approved</span>
        <strong class="tr-approved">{{ stats.approved }}</strong>
        <small>transactions</small>
      </BaseCard>
      <BaseCard class="module-stat-card">
        <span>Pending</span>
        <strong class="tr-pending">{{ stats.pending }}</strong>
        <small>awaiting approval</small>
      </BaseCard>
      <BaseCard class="module-stat-card">
        <span>Rejected</span>
        <strong class="tr-rejected">{{ stats.rejected }}</strong>
        <small>transactions</small>
      </BaseCard>
      <BaseCard class="module-stat-card tr-card--total">
        <span>Approved ETB total</span>
        <strong>{{ totalEtbSum }}</strong>
        <small>ETB</small>
      </BaseCard>
    </div>

    <!-- ── table panel ────────────────────────────────────────────────────────── -->
    <BaseCard as="section" class="module-panel">
      <div class="module-panel-header">
        <h3>{{ pageTitle }}</h3>
        <div class="tr-toolbar">
          <label class="tr-toolbar-item">
            <span>Period</span>
            <select v-model="period" class="tr-select" @change="page = 1; load()">
              <option v-for="p in PERIODS" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </label>
          <label class="tr-toolbar-item">
            <span>Status</span>
            <select v-model="status" class="tr-select" @change="page = 1; load()">
              <option value="all">All statuses</option>
              <option v-for="s in STATUSES.filter(s => s !== 'all')" :key="s" :value="s">
                {{ s.charAt(0) + s.slice(1).toLowerCase() }}
              </option>
            </select>
          </label>
          <label class="module-search">
            <input v-model="search" placeholder="Search transactions…" />
          </label>
          <BaseButton variant="secondary" size="sm" :disabled="loading" @click="load">
            {{ loading ? 'Loading…' : 'Refresh' }}
          </BaseButton>
        </div>
      </div>

      <p v-if="error" class="tr-error">{{ error }}</p>
      <p v-else-if="loading" class="module-empty-state">Loading {{ transactionType }} transactions…</p>
      <p v-else-if="!filtered.length" class="module-empty-state">
        No {{ transactionType }} transactions found for this period and status.
      </p>

      <div v-else class="module-table-wrap">
        <table class="module-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Nationality / City</th>
              <th>Currency</th>
              <th>FCY Amount</th>
              <th>Total ETB</th>
              <th>Payment</th>
              <th v-if="!isBuy">Purpose</th>
              <th>Status</th>
              <th>Date</th>
              <th data-no-sort>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in filtered" :key="r.id">
              <td>{{ (page - 1) * limit + i + 1 }}</td>
              <td>
                <strong>{{ customerName(r) }}</strong>
                <small v-if="customerPhone(r) !== '—'">{{ customerPhone(r) }}</small>
              </td>
              <td>{{ customerIdentifier(r) }}</td>
              <td>
                <span class="tr-currency-chip" :class="isBuy ? 'buy' : 'sell'">
                  {{ currencyList(r) }}
                </span>
              </td>
              <td>
                <span v-for="item in (r.items ?? [])" :key="item.id" style="display:block">
                  {{ fmt(item.fcy_amount) }} {{ item.currency_code ?? '' }}
                </span>
              </td>
              <td><strong>{{ totalEtb(r) }}</strong></td>
              <td>
                {{ r.payment_method === 'BANK' ? '🏦 Bank' : '💵 Cash' }}
                <small v-if="r.payment_method === 'BANK' && r.bank_account_number">{{ r.bank_account_number }}</small>
              </td>
              <td v-if="!isBuy">{{ r.sell_purpose ?? '—' }}</td>
              <td>
                <BaseBadge :tone="statusTone(r.status)" class="module-status-chip">
                  {{ r.status ?? '—' }}
                </BaseBadge>
              </td>
              <td style="white-space:nowrap">{{ fmtDate(r.created_at) }}</td>
              <td>
                <button
                  class="tr-view-btn"
                  @click="router.push(`/trade-reports/detail/${encodeURIComponent(r.id)}`)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="module-table-footer">
        <span>Showing {{ filtered.length }} of {{ total }} transactions</span>
        <div class="tr-pagination">
          <select v-model="limit" class="tr-select tr-select--sm" @change="page = 1; load()">
            <option :value="10">10 / page</option>
            <option :value="20">20 / page</option>
            <option :value="50">50 / page</option>
          </select>
          <BaseButton variant="secondary" size="sm" :disabled="page <= 1 || loading" @click="page--">← Prev</BaseButton>
          <span>{{ page }} / {{ totalPages }}</span>
          <BaseButton variant="secondary" size="sm" :disabled="page >= totalPages || loading" @click="page++">Next →</BaseButton>
        </div>
      </div>
    </BaseCard>

  </section>
</template>

<style scoped>
.tr-subtitle { margin: 6px 0 0; color: #77879b; font-size: 12px; }

/* stat cards — compact */
.tr-card--buy  { border-top: 3px solid #168a7b; }
.tr-card--sell { border-top: 3px solid #b26b00; }
.tr-card--total{ border-top: 3px solid #1769d2; }
.tr-approved   { color: #16855b !important; }
.tr-pending    { color: #b26b00 !important; }
.tr-rejected   { color: #c0392b !important; }

/* make all stat cards smaller in this view */
:deep(.module-stat-row)  { gap: 8px; margin-bottom: 12px; grid-template-columns: repeat(5, 1fr) !important; }
:deep(.module-stat-card) { padding: 9px 12px !important; min-height: 0 !important; height: auto !important; }
:deep(.module-stat-card > span)   { font-size: 11px !important; margin-bottom: 1px; display: block; }
:deep(.module-stat-card > strong) { font-size: 18px !important; display: block; line-height: 1.1; }
:deep(.module-stat-card > small)  { font-size: 10px !important; }

/* panel toolbar */
.tr-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tr-toolbar-item { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: #4b5f76; white-space: nowrap; }
.tr-toolbar-item span { font-size: 11px; }
.tr-select {
  padding: 6px 10px; border: 1px solid #dce5ee; border-radius: 7px;
  font: inherit; font-size: 13px; background: #fff; color: #203750;
  cursor: pointer;
}
.tr-select--sm { min-width: 90px; }
.tr-select:focus { outline: none; border-color: #168a7b; }

/* table */
.tr-currency-chip { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.tr-currency-chip.buy  { background: #e8f7f0; color: #145c3c; }
.tr-currency-chip.sell { background: #fff5df; color: #9a4a00; }

.tr-view-btn {
  border: 0; background: transparent;
  color: #167d72; font-size: 11px; font-weight: 700; padding: 5px 7px; cursor: pointer;
}
.tr-view-btn:hover { color: #0f5a52; }

/* footer pagination */
.tr-pagination { display: flex; align-items: center; gap: 8px; }

/* error */
.tr-error { padding: 10px 16px; background: #fff0ef; color: #a52c28; border-radius: 8px; margin: 12px 16px; font-size: 13px; }
</style>

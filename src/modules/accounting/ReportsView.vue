<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import TradeReportView from '../trade-reports/TradeReportView.vue'
import { accountingService } from '../../services/accountingService'

// ── top tabs ──────────────────────────────────────────────────────────────────
const TOP_TABS = [
  { key: 'financial',    label: 'Financial Statements', icon: '📊' },
  { key: 'ledgers',      label: 'Ledgers',              icon: '📒' },
  { key: 'other',        label: 'Other Reports',        icon: '📄' },
  { key: 'transactions', label: 'Transaction Reports',  icon: '⇄'  },
]

const SUB_MENUS = {
  financial:    [
    { key: 'balance',   label: 'Balance Sheet',  icon: '▤' },
    { key: 'trial',     label: 'Trial Balance',  icon: '▤' },
    { key: 'cashflow',  label: 'Cash Flow',      icon: '⊙' },
  ],
  ledgers:      [
    { key: 'general',   label: 'General Ledger', icon: '▤' },
    { key: 'daily',     label: 'Daily Ledger',   icon: '▤' },
  ],
  other:        [
    { key: 'summary',   label: 'Summary Report', icon: '▤' },
  ],
  transactions: [
    { key: 'buy',       label: 'Buy Report',     icon: '↙' },
    { key: 'sell',      label: 'Sell Report',    icon: '↗' },
  ],
}

const activeTop = ref('financial')
const activeSub = ref('balance')

function switchTop(key) {
  activeTop.value = key
  activeSub.value = SUB_MENUS[key][0].key
}
const currentSubs = computed(() => SUB_MENUS[activeTop.value] ?? [])

// ── shared date helpers ───────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function firstOfYear() { return `${new Date().getFullYear()}-01-01` }

function fmt(v) {
  const n = Number(v ?? 0)
  return Number.isFinite(n)
    ? n.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}
function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-ET')
}
function fmtDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-ET')
}

function normalizeList(r) {
  if (Array.isArray(r))             return r
  if (Array.isArray(r?.data))       return r.data
  if (Array.isArray(r?.data?.items)) return r.data.items
  return []
}

// ══════════════════════════════════════════════════════════════════════════════
//  BALANCE SHEET
// ══════════════════════════════════════════════════════════════════════════════
const bsLoading  = ref(false)
const bsError    = ref('')
const bsVaults   = ref([])   // cash-management/vaults  → per-currency cash balances
const bsBanks    = ref([])   // bank-accounts           → ETB balances

async function loadBalanceSheet() {
  bsLoading.value = true
  bsError.value   = ''
  try {
    const [vaultsRes, banksRes] = await Promise.all([
      accountingService.getVaults(),
      accountingService.getBankAccounts({ is_active: true }),
    ])
    bsVaults.value = normalizeList(vaultsRes)
    bsBanks.value  = normalizeList(banksRes)
  } catch (e) {
    bsError.value = e?.message || 'Could not load balance sheet data.'
  } finally {
    bsLoading.value = false
  }
}

// flatten vault → currency entries for the balance sheet
const bsCashRows = computed(() => {
  const rows = []
  for (const v of bsVaults.value) {
    for (const b of (v.balances ?? [])) {
      rows.push({
        label:    `${v.vault_name} (${b.code})`,
        type:     'Cash',
        amount:   Number(b.current_balance ?? 0),
        currency: b.code,
      })
    }
  }
  return rows
})

const bsBankRows = computed(() =>
  bsBanks.value.map(b => ({
    label:    `${b.bank_name ?? b.bank?.name ?? 'Bank'} – ${b.account_number}`,
    type:     'Bank',
    amount:   Number(b.current_balance ?? b.balance ?? 0),
    currency: b.currency_code ?? 'ETB',
  }))
)

const totalAssets      = computed(() =>
  [...bsCashRows.value, ...bsBankRows.value].reduce((s, r) => s + r.amount, 0)
)
const totalLiabilities = computed(() => 0)
const totalEquity      = computed(() => totalAssets.value - totalLiabilities.value)

// ══════════════════════════════════════════════════════════════════════════════
//  TRIAL BALANCE  (derived from ledger entries)
// ══════════════════════════════════════════════════════════════════════════════
const tbLoading = ref(false)
const tbError   = ref('')
const tbLedger  = ref([])
const tbFrom    = ref(firstOfYear())
const tbTo      = ref(today())

async function loadTrialBalance() {
  tbLoading.value = true
  tbError.value   = ''
  try {
    const res = await accountingService.getLedger({ fromDate: tbFrom.value, toDate: tbTo.value })
    tbLedger.value = normalizeList(res)
  } catch (e) {
    tbError.value = e?.message || 'Could not load ledger data for trial balance.'
  } finally {
    tbLoading.value = false
  }
}

// group ledger by vault+currency → debit / credit totals
const tbRows = computed(() => {
  const map = {}
  for (const e of tbLedger.value) {
    const key = `${e.vault_id}__${e.currency_id}`
    if (!map[key]) {
      map[key] = {
        account:  `${e.vault_name ?? e.vault_code ?? e.vault_id} (${e.currency_code ?? e.currency_id})`,
        debit:    0,
        credit:   0,
        currency: e.currency_code ?? '',
      }
    }
    if (e.entry_type === 'DEBIT')  map[key].debit  += Number(e.amount ?? 0)
    else                           map[key].credit += Number(e.amount ?? 0)
  }
  return Object.values(map).map(r => ({ ...r, net: r.debit - r.credit }))
})

const tbTotalDebit  = computed(() => tbRows.value.reduce((s, r) => s + r.debit,  0))
const tbTotalCredit = computed(() => tbRows.value.reduce((s, r) => s + r.credit, 0))
const tbBalanced    = computed(() => Math.abs(tbTotalDebit.value - tbTotalCredit.value) < 0.01)

// ══════════════════════════════════════════════════════════════════════════════
//  CASH FLOW
// ══════════════════════════════════════════════════════════════════════════════
const cfLoading   = ref(false)
const cfError     = ref('')
const cfTransfers = ref([])
const cfFrom      = ref(firstOfYear())
const cfTo        = ref(today())

async function loadCashFlow() {
  cfLoading.value = true
  cfError.value   = ''
  try {
    const res = await accountingService.getTransfers({ fromDate: cfFrom.value, toDate: cfTo.value })
    cfTransfers.value = normalizeList(res)
  } catch (e) {
    cfError.value = e?.message || 'Could not load transfer data.'
  } finally {
    cfLoading.value = false
  }
}

const cfInflows  = computed(() =>
  cfTransfers.value.filter(t => t.status === 'COMPLETED' || t.received_amount != null)
)
const cfOutflows = computed(() =>
  cfTransfers.value.filter(t => t.status === 'IN_TRANSIT' || t.initiated_amount != null)
)
const cfTotalIn  = computed(() =>
  cfInflows.value.reduce((s, t) => s + Number(t.received_amount ?? t.initiated_amount ?? 0), 0)
)
const cfTotalOut = computed(() =>
  cfOutflows.value.reduce((s, t) => s + Number(t.initiated_amount ?? 0), 0)
)
const cfNet = computed(() => cfTotalIn.value - cfTotalOut.value)

// ══════════════════════════════════════════════════════════════════════════════
//  GENERAL LEDGER
// ══════════════════════════════════════════════════════════════════════════════
const glLoading = ref(false)
const glError   = ref('')
const glRows    = ref([])
const glFrom    = ref(firstOfYear())
const glTo      = ref(today())
const glPage    = ref(1)
const glPageSize = 50   // ledger returns max 500; we paginate client-side

async function loadGeneralLedger() {
  glLoading.value = true
  glError.value   = ''
  try {
    const res  = await accountingService.getLedger({ fromDate: glFrom.value, toDate: glTo.value })
    glRows.value = normalizeList(res)
    glPage.value = 1
  } catch (e) {
    glError.value = e?.message || 'Could not load general ledger.'
  } finally {
    glLoading.value = false
  }
}

const glTotalPages = computed(() => Math.max(1, Math.ceil(glRows.value.length / glPageSize)))
const glPageRows   = computed(() => {
  const start = (glPage.value - 1) * glPageSize
  return glRows.value.slice(start, start + glPageSize)
})
const glTotalDebit  = computed(() =>
  glRows.value.filter(r => r.entry_type === 'DEBIT').reduce((s, r) => s + Number(r.amount ?? 0), 0)
)
const glTotalCredit = computed(() =>
  glRows.value.filter(r => r.entry_type === 'CREDIT').reduce((s, r) => s + Number(r.amount ?? 0), 0)
)

// ══════════════════════════════════════════════════════════════════════════════
//  DAILY LEDGER
// ══════════════════════════════════════════════════════════════════════════════
const dlLoading  = ref(false)
const dlError    = ref('')
const dlRows     = ref([])
const dlDate     = ref(today())

async function loadDailyLedger() {
  dlLoading.value = true
  dlError.value   = ''
  try {
    const res = await accountingService.getLedger({ fromDate: dlDate.value, toDate: dlDate.value })
    dlRows.value = normalizeList(res)
  } catch (e) {
    dlError.value = e?.message || 'Could not load daily ledger.'
  } finally {
    dlLoading.value = false
  }
}

const dlTotalDebit  = computed(() =>
  dlRows.value.filter(r => r.entry_type === 'DEBIT').reduce((s, r) => s + Number(r.amount ?? 0), 0)
)
const dlTotalCredit = computed(() =>
  dlRows.value.filter(r => r.entry_type === 'CREDIT').reduce((s, r) => s + Number(r.amount ?? 0), 0)
)

// ══════════════════════════════════════════════════════════════════════════════
//  SUMMARY REPORT
// ══════════════════════════════════════════════════════════════════════════════
const smLoading       = ref(false)
const smError         = ref('')
const smTrades        = ref([])
const smReconcile     = ref([])
const smFrom          = ref(firstOfYear())
const smTo            = ref(today())

async function loadSummary() {
  smLoading.value = true
  smError.value   = ''
  try {
    const [tradesRes, reconcileRes] = await Promise.all([
      accountingService.getTradeTransactions({ start_date: smFrom.value, end_date: smTo.value, limit: 500 }),
      accountingService.getReconciliations(),
    ])
    smTrades.value    = normalizeList(tradesRes)
    smReconcile.value = normalizeList(reconcileRes)
  } catch (e) {
    smError.value = e?.message || 'Could not load summary data.'
  } finally {
    smLoading.value = false
  }
}

const smApproved = computed(() => smTrades.value.filter(t => t.status === 'APPROVED'))
const smBuys     = computed(() => smApproved.value.filter(t => t.transaction_type === 'BUY'))
const smSells    = computed(() => smApproved.value.filter(t => t.transaction_type === 'SELL'))
const smTotalBuy = computed(() =>
  smBuys.value.reduce((s, t) => s + Number(t.total_amount_etb ?? t.total_amount ?? 0), 0)
)
const smTotalSell = computed(() =>
  smSells.value.reduce((s, t) => s + Number(t.total_amount_etb ?? t.total_amount ?? 0), 0)
)
const smVariance = computed(() =>
  smReconcile.value.filter(r => r.status === 'VARIANCE_FLAGGED').length
)

// ── auto-load when switching to a section ─────────────────────────────────────
watch(
  [activeTop, activeSub],
  ([top, sub]) => {
    if (top === 'financial'  && sub === 'balance')  loadBalanceSheet()
    if (top === 'financial'  && sub === 'trial')    loadTrialBalance()
    if (top === 'financial'  && sub === 'cashflow') loadCashFlow()
    if (top === 'ledgers'    && sub === 'general')  loadGeneralLedger()
    if (top === 'ledgers'    && sub === 'daily')    loadDailyLedger()
    if (top === 'other'      && sub === 'summary')  loadSummary()
  },
  { immediate: true }
)
</script>

<template>
  <div class="ar-page">

    <div class="module-page-intro">
      <div>
        <h2>Accounting Reports</h2>
        <p class="ar-subtitle">Financial statements, ledgers, and transaction reports.</p>
      </div>
    </div>

    <!-- ── top tab bar ───────────────────────────────────────────────────────── -->
    <nav class="ar-top-tabs">
      <button
        v-for="tab in TOP_TABS" :key="tab.key"
        type="button"
        class="ar-top-tab"
        :class="{ active: activeTop === tab.key }"
        @click="switchTop(tab.key)"
      >
        <span>{{ tab.icon }}</span> {{ tab.label }}
      </button>
    </nav>

    <!-- ── body: left sub-menu + right content ───────────────────────────────── -->
    <div class="ar-body">

      <!-- left sub-menu -->
      <aside class="ar-subnav">
        <button
          v-for="sub in currentSubs" :key="sub.key"
          type="button"
          class="ar-subnav-item"
          :class="{ active: activeSub === sub.key }"
          @click="activeSub = sub.key"
        >
          <span>{{ sub.icon }}</span> {{ sub.label }}
        </button>
      </aside>

      <!-- right content -->
      <div class="ar-content">

        <!-- ════════════════════════════════════════════════════════════════════
             BALANCE SHEET
        ════════════════════════════════════════════════════════════════════ -->
        <div v-if="activeTop === 'financial' && activeSub === 'balance'">
          <div class="ar-report-header">
            <div>
              <h3>Balance Sheet Statement</h3>
              <p class="ar-report-meta">As of {{ today() }} | Fiscal Year: {{ new Date().getFullYear() }}</p>
            </div>
            <button class="ar-refresh-btn" @click="loadBalanceSheet" :disabled="bsLoading">
              {{ bsLoading ? '…' : '↻ Refresh' }}
            </button>
          </div>

          <div v-if="bsError" class="ar-error">{{ bsError }}</div>

          <div v-if="bsLoading" class="ar-loading">Loading balance sheet…</div>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Total Assets</span>
                <strong>ETB {{ fmt(totalAssets) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Total Liabilities</span>
                <strong>ETB {{ fmt(totalLiabilities) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--blue">
                <span>Total Equity</span>
                <strong>ETB {{ fmt(totalEquity) }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead>
                  <tr>
                    <th>Account / Vault</th>
                    <th>Type</th>
                    <th style="text-align:right">Currency</th>
                    <th style="text-align:right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Cash / Vault assets -->
                  <tr v-if="bsCashRows.length">
                    <td colspan="4" class="ar-group-row">CASH IN VAULTS</td>
                  </tr>
                  <tr v-for="(r, i) in bsCashRows" :key="'cash-'+i">
                    <td>{{ r.label }}</td>
                    <td><span class="ar-badge ar-badge--blue">{{ r.type }}</span></td>
                    <td style="text-align:right">{{ r.currency }}</td>
                    <td style="text-align:right;color:#168a7b;font-weight:700">{{ fmt(r.amount) }}</td>
                  </tr>
                  <tr v-if="!bsCashRows.length">
                    <td colspan="4" style="text-align:center;color:#718096;font-size:12px;padding:12px">No vault balances found.</td>
                  </tr>

                  <!-- Bank assets -->
                  <tr v-if="bsBankRows.length">
                    <td colspan="4" class="ar-group-row">CASH AT BANK</td>
                  </tr>
                  <tr v-for="(r, i) in bsBankRows" :key="'bank-'+i">
                    <td>{{ r.label }}</td>
                    <td><span class="ar-badge ar-badge--teal">{{ r.type }}</span></td>
                    <td style="text-align:right">{{ r.currency }}</td>
                    <td style="text-align:right;color:#168a7b;font-weight:700">{{ fmt(r.amount) }}</td>
                  </tr>
                  <tr v-if="!bsBankRows.length">
                    <td colspan="4" style="text-align:center;color:#718096;font-size:12px;padding:12px">No bank accounts found.</td>
                  </tr>

                  <!-- Liabilities -->
                  <tr><td colspan="4" class="ar-group-row">LIABILITIES</td></tr>
                  <tr>
                    <td colspan="4" style="text-align:center;color:#718096;font-size:12px;padding:12px">No liabilities recorded.</td>
                  </tr>

                  <!-- Equity -->
                  <tr><td colspan="4" class="ar-group-row">EQUITY</td></tr>
                  <tr>
                    <td colspan="3">Retained Earnings / Net Position</td>
                    <td style="text-align:right;color:#1769d2;font-weight:700">{{ fmt(totalEquity) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="font-weight:800;background:#f8fafc">
                    <td colspan="3">Total Assets</td>
                    <td style="text-align:right;color:#168a7b">{{ fmt(totalAssets) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════
             TRIAL BALANCE
        ════════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'financial' && activeSub === 'trial'">
          <div class="ar-report-header">
            <div>
              <h3>Trial Balance</h3>
              <p class="ar-report-meta">From {{ tbFrom }} to {{ tbTo }}</p>
            </div>
            <div class="ar-filter-row">
              <input type="date" class="ar-date-input" v-model="tbFrom" @change="loadTrialBalance" />
              <span class="ar-filter-sep">→</span>
              <input type="date" class="ar-date-input" v-model="tbTo" @change="loadTrialBalance" />
              <button class="ar-refresh-btn" @click="loadTrialBalance" :disabled="tbLoading">
                {{ tbLoading ? '…' : '↻' }}
              </button>
            </div>
          </div>

          <div v-if="tbError" class="ar-error">{{ tbError }}</div>
          <div v-if="tbLoading" class="ar-loading">Loading trial balance…</div>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Total Debits</span>
                <strong>ETB {{ fmt(tbTotalDebit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Total Credits</span>
                <strong>ETB {{ fmt(tbTotalCredit) }}</strong>
              </div>
              <div class="ar-summary-card" :class="tbBalanced ? 'ar-summary-card--green' : 'ar-summary-card--red'">
                <span>Balance</span>
                <strong>{{ tbBalanced ? '✓ Balanced' : 'ETB ' + fmt(Math.abs(tbTotalDebit - tbTotalCredit)) }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead>
                  <tr>
                    <th>Account (Vault / Currency)</th>
                    <th style="text-align:right">Debit (ETB)</th>
                    <th style="text-align:right">Credit (ETB)</th>
                    <th style="text-align:right">Net Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!tbRows.length">
                    <td colspan="4" class="ar-empty-row">No ledger entries found for the selected period.</td>
                  </tr>
                  <tr v-for="(r, i) in tbRows" :key="i">
                    <td>{{ r.account }}</td>
                    <td style="text-align:right">{{ fmt(r.debit) }}</td>
                    <td style="text-align:right">{{ fmt(r.credit) }}</td>
                    <td style="text-align:right;font-weight:700"
                        :style="{ color: r.net >= 0 ? '#168a7b' : '#c0392b' }">
                      {{ fmt(r.net) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot v-if="tbRows.length">
                  <tr style="font-weight:800;background:#f8fafc">
                    <td>Totals</td>
                    <td style="text-align:right;color:#168a7b">{{ fmt(tbTotalDebit) }}</td>
                    <td style="text-align:right;color:#c0392b">{{ fmt(tbTotalCredit) }}</td>
                    <td style="text-align:right"
                        :style="{ color: tbBalanced ? '#168a7b' : '#c0392b' }">
                      {{ tbBalanced ? '✓' : fmt(tbTotalDebit - tbTotalCredit) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════
             CASH FLOW
        ════════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'financial' && activeSub === 'cashflow'">
          <div class="ar-report-header">
            <div>
              <h3>Cash Flow Statement</h3>
              <p class="ar-report-meta">From {{ cfFrom }} to {{ cfTo }}</p>
            </div>
            <div class="ar-filter-row">
              <input type="date" class="ar-date-input" v-model="cfFrom" @change="loadCashFlow" />
              <span class="ar-filter-sep">→</span>
              <input type="date" class="ar-date-input" v-model="cfTo" @change="loadCashFlow" />
              <button class="ar-refresh-btn" @click="loadCashFlow" :disabled="cfLoading">
                {{ cfLoading ? '…' : '↻' }}
              </button>
            </div>
          </div>

          <div v-if="cfError" class="ar-error">{{ cfError }}</div>
          <div v-if="cfLoading" class="ar-loading">Loading cash flow data…</div>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Total Inflows</span>
                <strong>{{ fmt(cfTotalIn) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Total Outflows</span>
                <strong>{{ fmt(cfTotalOut) }}</strong>
              </div>
              <div class="ar-summary-card" :class="cfNet >= 0 ? 'ar-summary-card--green' : 'ar-summary-card--red'">
                <span>Net Cash Flow</span>
                <strong>{{ fmt(cfNet) }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Currency</th>
                    <th style="text-align:right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!cfTransfers.length">
                    <td colspan="8" class="ar-empty-row">No cash transfers found for the selected period.</td>
                  </tr>
                  <tr v-for="t in cfTransfers" :key="t.id">
                    <td><strong>{{ t.transfer_ref ?? t.id?.slice(0,8) }}</strong></td>
                    <td>{{ fmtDate(t.initiated_at) }}</td>
                    <td>
                      <span class="ar-badge ar-badge--grey">
                        {{ (t.transfer_type ?? '').replace(/_/g, ' ') }}
                      </span>
                    </td>
                    <td>{{ t.source_vault_name ?? t.source_vault_code ?? '—' }}</td>
                    <td>{{ t.dest_vault_name   ?? t.dest_vault_code   ?? '—' }}</td>
                    <td>{{ t.currency_code ?? '—' }}</td>
                    <td style="text-align:right;font-weight:700">
                      {{ fmt(t.received_amount ?? t.initiated_amount) }}
                    </td>
                    <td>
                      <span class="ar-badge"
                        :class="{
                          'ar-badge--green':  t.status === 'COMPLETED',
                          'ar-badge--yellow': t.status === 'IN_TRANSIT',
                          'ar-badge--red':    t.status === 'REJECTED',
                        }">
                        {{ t.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════
             GENERAL LEDGER
        ════════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'ledgers' && activeSub === 'general'">
          <div class="ar-report-header">
            <div>
              <h3>General Ledger</h3>
              <p class="ar-report-meta">From {{ glFrom }} to {{ glTo }} · {{ glRows.length }} entries</p>
            </div>
            <div class="ar-filter-row">
              <input type="date" class="ar-date-input" v-model="glFrom" @change="loadGeneralLedger" />
              <span class="ar-filter-sep">→</span>
              <input type="date" class="ar-date-input" v-model="glTo" @change="loadGeneralLedger" />
              <button class="ar-refresh-btn" @click="loadGeneralLedger" :disabled="glLoading">
                {{ glLoading ? '…' : '↻' }}
              </button>
            </div>
          </div>

          <div v-if="glError" class="ar-error">{{ glError }}</div>
          <div v-if="glLoading" class="ar-loading">Loading general ledger…</div>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Total Debits</span>
                <strong>{{ fmt(glTotalDebit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Total Credits</span>
                <strong>{{ fmt(glTotalCredit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--blue">
                <span>Entries</span>
                <strong>{{ glRows.length }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vault</th>
                    <th>Currency</th>
                    <th>Reference</th>
                    <th>Notes</th>
                    <th style="text-align:right">Debit</th>
                    <th style="text-align:right">Credit</th>
                    <th style="text-align:right">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!glPageRows.length">
                    <td colspan="8" class="ar-empty-row">No ledger entries found for the selected period.</td>
                  </tr>
                  <tr v-for="e in glPageRows" :key="e.id">
                    <td>{{ fmtDateTime(e.created_at) }}</td>
                    <td>{{ e.vault_name ?? e.vault_code ?? e.vault_id?.slice(0,8) }}</td>
                    <td>{{ e.currency_code ?? '—' }}</td>
                    <td>
                      <span v-if="e.reference_type" class="ar-badge ar-badge--grey">
                        {{ e.reference_type.replace(/_/g, ' ') }}
                      </span>
                      <span v-else>—</span>
                    </td>
                    <td class="ar-notes-cell">{{ e.notes ?? '—' }}</td>
                    <td style="text-align:right;color:#168a7b;font-weight:600">
                      {{ e.entry_type === 'DEBIT'  ? fmt(e.amount) : '' }}
                    </td>
                    <td style="text-align:right;color:#c0392b;font-weight:600">
                      {{ e.entry_type === 'CREDIT' ? fmt(e.amount) : '' }}
                    </td>
                    <td style="text-align:right;font-weight:700">{{ fmt(e.balance_after) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- pagination -->
            <div v-if="glTotalPages > 1" class="ar-pagination">
              <button class="ar-page-btn" :disabled="glPage <= 1" @click="glPage--">‹ Prev</button>
              <span class="ar-page-info">Page {{ glPage }} / {{ glTotalPages }}</span>
              <button class="ar-page-btn" :disabled="glPage >= glTotalPages" @click="glPage++">Next ›</button>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════
             DAILY LEDGER
        ════════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'ledgers' && activeSub === 'daily'">
          <div class="ar-report-header">
            <div>
              <h3>Daily Ledger</h3>
              <p class="ar-report-meta">{{ dlDate }} · {{ dlRows.length }} entries</p>
            </div>
            <div class="ar-filter-row">
              <input type="date" class="ar-date-input" v-model="dlDate" @change="loadDailyLedger" />
              <button class="ar-refresh-btn" @click="loadDailyLedger" :disabled="dlLoading">
                {{ dlLoading ? '…' : '↻' }}
              </button>
            </div>
          </div>

          <div v-if="dlError" class="ar-error">{{ dlError }}</div>
          <div v-if="dlLoading" class="ar-loading">Loading daily ledger…</div>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Day Debits</span>
                <strong>{{ fmt(dlTotalDebit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Day Credits</span>
                <strong>{{ fmt(dlTotalCredit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--blue">
                <span>Entries</span>
                <strong>{{ dlRows.length }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Vault</th>
                    <th>Currency</th>
                    <th>Reference</th>
                    <th>Notes</th>
                    <th style="text-align:right">Debit</th>
                    <th style="text-align:right">Credit</th>
                    <th style="text-align:right">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!dlRows.length">
                    <td colspan="8" class="ar-empty-row">No ledger entries for {{ dlDate }}.</td>
                  </tr>
                  <tr v-for="e in dlRows" :key="e.id">
                    <td>{{ fmtDateTime(e.created_at) }}</td>
                    <td>{{ e.vault_name ?? e.vault_code ?? e.vault_id?.slice(0,8) }}</td>
                    <td>{{ e.currency_code ?? '—' }}</td>
                    <td>
                      <span v-if="e.reference_type" class="ar-badge ar-badge--grey">
                        {{ e.reference_type.replace(/_/g, ' ') }}
                      </span>
                      <span v-else>—</span>
                    </td>
                    <td class="ar-notes-cell">{{ e.notes ?? '—' }}</td>
                    <td style="text-align:right;color:#168a7b;font-weight:600">
                      {{ e.entry_type === 'DEBIT'  ? fmt(e.amount) : '' }}
                    </td>
                    <td style="text-align:right;color:#c0392b;font-weight:600">
                      {{ e.entry_type === 'CREDIT' ? fmt(e.amount) : '' }}
                    </td>
                    <td style="text-align:right;font-weight:700">{{ fmt(e.balance_after) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════
             SUMMARY REPORT
        ════════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'other' && activeSub === 'summary'">
          <div class="ar-report-header">
            <div>
              <h3>Summary Report</h3>
              <p class="ar-report-meta">From {{ smFrom }} to {{ smTo }}</p>
            </div>
            <div class="ar-filter-row">
              <input type="date" class="ar-date-input" v-model="smFrom" @change="loadSummary" />
              <span class="ar-filter-sep">→</span>
              <input type="date" class="ar-date-input" v-model="smTo" @change="loadSummary" />
              <button class="ar-refresh-btn" @click="loadSummary" :disabled="smLoading">
                {{ smLoading ? '…' : '↻' }}
              </button>
            </div>
          </div>

          <div v-if="smError" class="ar-error">{{ smError }}</div>
          <div v-if="smLoading" class="ar-loading">Loading summary…</div>

          <template v-else>
            <!-- KPI row -->
            <div class="ar-summary-cards ar-summary-cards--4">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Approved Buy Volume</span>
                <strong>ETB {{ fmt(smTotalBuy) }}</strong>
                <small>{{ smBuys.length }} transactions</small>
              </div>
              <div class="ar-summary-card ar-summary-card--blue">
                <span>Approved Sell Volume</span>
                <strong>ETB {{ fmt(smTotalSell) }}</strong>
                <small>{{ smSells.length }} transactions</small>
              </div>
              <div class="ar-summary-card"
                   :class="smVariance > 0 ? 'ar-summary-card--red' : 'ar-summary-card--green'">
                <span>Variance Flags</span>
                <strong>{{ smVariance }}</strong>
                <small>reconciliation issues</small>
              </div>
              <div class="ar-summary-card ar-summary-card--blue">
                <span>Total Transactions</span>
                <strong>{{ smTrades.length }}</strong>
                <small>all statuses</small>
              </div>
            </div>

            <!-- trades breakdown by status -->
            <h4 class="ar-section-title">Transactions by Status</h4>
            <div class="module-table-wrap">
              <table class="module-table">
                <thead>
                  <tr><th>Status</th><th style="text-align:right">Count</th><th style="text-align:right">ETB Volume</th></tr>
                </thead>
                <tbody>
                  <tr v-for="st in ['APPROVED','PENDING','REJECTED','REVERSED']" :key="st">
                    <td>
                      <span class="ar-badge"
                        :class="{
                          'ar-badge--green':  st === 'APPROVED',
                          'ar-badge--yellow': st === 'PENDING',
                          'ar-badge--red':    st === 'REJECTED' || st === 'REVERSED',
                        }">{{ st }}</span>
                    </td>
                    <td style="text-align:right">
                      {{ smTrades.filter(t => t.status === st).length }}
                    </td>
                    <td style="text-align:right;font-weight:700">
                      ETB {{ fmt(smTrades.filter(t => t.status === st).reduce((s,t) => s + Number(t.total_amount_etb ?? t.total_amount ?? 0), 0)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- reconciliation summary -->
            <h4 class="ar-section-title" style="margin-top:24px">Reconciliation Summary</h4>
            <div class="module-table-wrap">
              <table class="module-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Vault</th><th>Currency</th>
                    <th style="text-align:right">Expected</th>
                    <th style="text-align:right">Physical Count</th>
                    <th style="text-align:right">Variance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!smReconcile.length">
                    <td colspan="7" class="ar-empty-row">No reconciliation records found.</td>
                  </tr>
                  <tr v-for="r in smReconcile" :key="r.id">
                    <td>{{ fmtDate(r.business_date) }}</td>
                    <td>{{ r.vault_name ?? r.vault_code ?? '—' }}</td>
                    <td>{{ r.currency_code ?? '—' }}</td>
                    <td style="text-align:right">{{ fmt(r.expected_system_balance) }}</td>
                    <td style="text-align:right">{{ fmt(r.counted_physical_amount) }}</td>
                    <td style="text-align:right;font-weight:700"
                        :style="{ color: Number(r.variance_amount) === 0 ? '#168a7b' : '#c0392b' }">
                      {{ fmt(r.variance_amount) }}
                    </td>
                    <td>
                      <span class="ar-badge"
                        :class="r.status === 'MATCHED' ? 'ar-badge--green' : 'ar-badge--red'">
                        {{ r.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════
             TRANSACTION REPORTS — delegated to TradeReportView
        ════════════════════════════════════════════════════════════════════ -->
        <TradeReportView
          v-else-if="activeTop === 'transactions' && activeSub === 'buy'"
          transaction-type="BUY"
        />
        <TradeReportView
          v-else-if="activeTop === 'transactions' && activeSub === 'sell'"
          transaction-type="SELL"
        />

      </div><!-- /ar-content -->
    </div><!-- /ar-body -->
  </div>
</template>

<style scoped>
.ar-page { max-width: 1400px; }
.ar-subtitle { margin: 6px 0 0; color: #77879b; font-size: 12px; }

/* ── top tabs ─────────────────────────────────────────────────────────────── */
.ar-top-tabs {
  display: flex;
  border-bottom: 2px solid var(--border-color, #e1e7ef);
  margin-bottom: 20px;
}
.ar-top-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 11px 20px;
  border: 0; background: transparent;
  font: inherit; font-size: 14px; font-weight: 600;
  color: var(--muted, #718096);
  cursor: pointer; position: relative;
  white-space: nowrap; transition: color .15s;
}
.ar-top-tab:hover { color: var(--ink, #172536); }
.ar-top-tab.active { color: #168a7b; font-weight: 750; }
.ar-top-tab.active::after {
  content: ''; position: absolute;
  bottom: -2px; left: 0; right: 0;
  height: 2px; background: #168a7b;
  border-radius: 2px 2px 0 0;
}

/* ── layout ───────────────────────────────────────────────────────────────── */
.ar-body { display: grid; grid-template-columns: 190px 1fr; gap: 24px; align-items: start; }

/* ── left sub-nav ─────────────────────────────────────────────────────────── */
.ar-subnav { display: flex; flex-direction: column; gap: 2px; }
.ar-subnav-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 9px 12px;
  border: 0; background: transparent; border-radius: 8px;
  font: inherit; font-size: 13px; font-weight: 600;
  color: var(--muted, #718096);
  text-align: left; cursor: pointer; transition: all .15s;
}
.ar-subnav-item:hover { background: var(--surface-muted, #f5f7fa); color: var(--ink, #172536); }
.ar-subnav-item.active { background: #e8f7f0; color: #145c3c; font-weight: 700; }

/* ── report header ────────────────────────────────────────────────────────── */
.ar-report-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 10px;
  margin-bottom: 16px;
}
.ar-report-header h3 { font-size: 22px; margin: 0 0 4px; color: var(--ink, #172536); }
.ar-report-meta { font-size: 12px; color: var(--muted, #718096); margin: 0; }

/* ── filter row ───────────────────────────────────────────────────────────── */
.ar-filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ar-date-input {
  padding: 6px 10px; border: 1px solid var(--border-color, #d8e0eb);
  border-radius: 7px; font: inherit; font-size: 13px;
  background: var(--surface, #fff); color: var(--ink, #172536);
}
.ar-filter-sep { color: var(--muted, #718096); font-size: 12px; }

/* ── refresh button ───────────────────────────────────────────────────────── */
.ar-refresh-btn {
  padding: 6px 14px; border-radius: 7px;
  border: 1px solid var(--border-color, #d8e0eb);
  background: var(--surface, #fff); color: var(--ink, #172536);
  font: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background .15s;
}
.ar-refresh-btn:hover:not(:disabled) { background: #e8f7f0; color: #145c3c; }
.ar-refresh-btn:disabled { opacity: .5; cursor: default; }

/* ── summary cards ────────────────────────────────────────────────────────── */
.ar-summary-cards {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 8px;
}
.ar-summary-cards--4 { grid-template-columns: repeat(4, 1fr); }
.ar-summary-card {
  padding: 16px 18px; border-radius: 10px;
  border: 1px solid var(--border-color, #e1e7ef);
}
.ar-summary-card span  { display: block; font-size: 12px; color: var(--muted, #718096); margin-bottom: 6px; }
.ar-summary-card strong { display: block; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.ar-summary-card small { display: block; font-size: 11px; color: var(--muted, #718096); margin-top: 4px; }
.ar-summary-card--green  { background: #f0faf5; border-color: #b7e4cd; }
.ar-summary-card--green strong { color: #168a7b; }
.ar-summary-card--red    { background: #fff5f5; border-color: #f5c6c6; }
.ar-summary-card--red   strong { color: #c0392b; }
.ar-summary-card--blue   { background: #eaf2ff; border-color: #bcd5f8; }
.ar-summary-card--blue  strong { color: #1769d2; }

/* ── table helpers ────────────────────────────────────────────────────────── */
.ar-group-row {
  background: #f0f4f8; font-size: 11px; font-weight: 800;
  letter-spacing: .07em; text-transform: uppercase;
  color: #3a5068; padding: 8px 16px;
}
.ar-empty-row { text-align: center; color: var(--muted, #718096); font-size: 12px; padding: 20px; }
.ar-notes-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── badges ───────────────────────────────────────────────────────────────── */
.ar-badge {
  display: inline-block; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 700; white-space: nowrap;
  background: #edf2f7; color: #4a5568;
}
.ar-badge--green  { background: #e6f9f1; color: #1a7a56; }
.ar-badge--yellow { background: #fff8e1; color: #b26b00; }
.ar-badge--red    { background: #fff0f0; color: #c0392b; }
.ar-badge--blue   { background: #eaf2ff; color: #1769d2; }
.ar-badge--teal   { background: #e0f7fa; color: #006064; }
.ar-badge--grey   { background: #f0f4f8; color: #4a5568; }

/* ── section title ────────────────────────────────────────────────────────── */
.ar-section-title {
  font-size: 14px; font-weight: 700; color: var(--ink, #172536);
  margin: 20px 0 10px; border-left: 3px solid #168a7b; padding-left: 10px;
}

/* ── pagination ───────────────────────────────────────────────────────────── */
.ar-pagination {
  display: flex; align-items: center; gap: 12px;
  justify-content: center; margin-top: 16px;
}
.ar-page-btn {
  padding: 6px 16px; border-radius: 7px;
  border: 1px solid var(--border-color, #d8e0eb);
  background: var(--surface, #fff); font: inherit; font-size: 13px;
  cursor: pointer; transition: background .15s;
}
.ar-page-btn:hover:not(:disabled) { background: #e8f7f0; }
.ar-page-btn:disabled { opacity: .4; cursor: default; }
.ar-page-info { font-size: 13px; color: var(--muted, #718096); }

/* ── loading / error ──────────────────────────────────────────────────────── */
.ar-loading {
  padding: 40px; text-align: center; color: var(--muted, #718096);
  font-size: 13px; background: var(--surface-muted, #f8fafc);
  border-radius: 10px; border: 1px dashed var(--border-color, #dbe2ea);
}
.ar-error {
  margin-bottom: 12px; padding: 12px 16px; border-radius: 8px;
  background: #fff0f0; border: 1px solid #f5c6c6;
  color: #c0392b; font-size: 13px;
}

/* ── responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .ar-summary-cards--4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 860px) {
  .ar-body { grid-template-columns: 1fr; }
  .ar-subnav { flex-direction: row; flex-wrap: wrap; }
  .ar-summary-cards { grid-template-columns: 1fr; }
  .ar-summary-cards--4 { grid-template-columns: repeat(2, 1fr); }
  .ar-top-tabs { overflow-x: auto; }
}
</style>

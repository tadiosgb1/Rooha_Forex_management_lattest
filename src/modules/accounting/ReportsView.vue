<script setup>
import { computed, ref } from 'vue'
import TradeReportView from '../trade-reports/TradeReportView.vue'

// ─── top tabs ─────────────────────────────────────────────────────────────────
const TOP_TABS = [
  { key: 'financial',    label: 'Financial Statements', icon: '📊' },
  { key: 'ledgers',      label: 'Ledgers',              icon: '📒' },
  { key: 'other',        label: 'Other Reports',        icon: '📄' },
  { key: 'transactions', label: 'Transaction Reports',  icon: '⇄'  },
]

// ─── sub-menus per top tab ────────────────────────────────────────────────────
const SUB_MENUS = {
  financial: [
    { key: 'balance',  label: 'Balance statement', icon: '▤' },
    { key: 'trial',    label: 'Trial Balance',      icon: '▤' },
    { key: 'cashflow', label: 'Cash Flow',           icon: '⊙' },
  ],
  ledgers: [
    { key: 'general',   label: 'General Ledger',    icon: '▤' },
    { key: 'daily',     label: 'Daily Ledger',      icon: '▤' },
  ],
  other: [
    { key: 'summary',   label: 'Summary Report',   icon: '▤' },
  ],
  transactions: [
    { key: 'buy',  label: 'Buy Report',  icon: '↙' },
    { key: 'sell', label: 'Sell Report', icon: '↗' },
  ],
}

const activeTop = ref('financial')
const activeSub = ref('balance')

// When switching top tab, reset sub to first item
function switchTop(key) {
  activeTop.value = key
  activeSub.value = SUB_MENUS[key][0].key
}

const currentSubs = computed(() => SUB_MENUS[activeTop.value] ?? [])

// ─── sample accounting data (same as AccountingView) ─────────────────────────
const accountSeed = [
  { id: 1, accountCode: '1000-04', accountName: 'Bunna Bank',   accountNumber: '202960100264',  type: 'Asset', subtype: 'Cash', currency: 'ETB' },
  { id: 2, accountCode: '1000-05', accountName: 'Dashen Bank',  accountNumber: '0155821504011', type: 'Asset', subtype: 'Cash', currency: 'ETB' },
  { id: 3, accountCode: '1000-07', accountName: 'Awash Bank',   accountNumber: '013041539986600', type: 'Asset', subtype: 'Cash', currency: 'ETB' },
  { id: 4, accountCode: '2000-01', accountName: 'Accounts Payable', accountNumber: '',          type: 'Liability', subtype: 'Current', currency: 'ETB' },
  { id: 5, accountCode: '3000-01', accountName: 'Owner Equity',    accountNumber: '',           type: 'Equity',    subtype: 'Capital', currency: 'ETB' },
]
const journalSeed = [
  { id: 1, reference: 'JV-2026-001', date: '2026-11-01', description: 'Opening bank balances', accountCode: '1000-04', accountName: 'Bunna Bank',  debit: 250000, credit: 0,      status: 'POSTED' },
  { id: 2, reference: 'JV-2026-001', date: '2026-11-01', description: 'Opening bank balances', accountCode: '1000-05', accountName: 'Dashen Bank', debit: 0,      credit: 250000, status: 'POSTED' },
  { id: 3, reference: 'JV-2026-002', date: '2026-11-04', description: 'Cash transfer',         accountCode: '1000-05', accountName: 'Dashen Bank', debit: 75000,  credit: 0,      status: 'DRAFT'  },
  { id: 4, reference: 'JV-2026-002', date: '2026-11-04', description: 'Cash transfer',         accountCode: '1000-04', accountName: 'Bunna Bank',  debit: 0,      credit: 75000,  status: 'DRAFT'  },
]

function fmt(v) {
  return Number(v || 0).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const totalAssets      = computed(() => accountSeed.filter(a => a.type === 'Asset').reduce((s, a) => {
  const d = journalSeed.filter(j => j.accountCode === a.accountCode && j.status === 'POSTED').reduce((x, j) => x + j.debit - j.credit, 0)
  return s + d
}, 0))
const totalLiabilities = computed(() => 0)
const totalEquity      = computed(() => totalAssets.value - totalLiabilities.value)

const trialRows = computed(() => accountSeed.map(a => {
  const debit  = journalSeed.filter(j => j.accountCode === a.accountCode).reduce((s, j) => s + Number(j.debit  || 0), 0)
  const credit = journalSeed.filter(j => j.accountCode === a.accountCode).reduce((s, j) => s + Number(j.credit || 0), 0)
  return { ...a, debit, credit, net: debit - credit }
}))
const totalDebit  = computed(() => trialRows.value.reduce((s, r) => s + r.debit,  0))
const totalCredit = computed(() => trialRows.value.reduce((s, r) => s + r.credit, 0))
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

        <!-- ── Transaction Reports: Buy ──────────────────────────────────────── -->
        <TradeReportView
          v-if="activeTop === 'transactions' && activeSub === 'buy'"
          transaction-type="BUY"
        />

        <!-- ── Transaction Reports: Sell ─────────────────────────────────────── -->
        <TradeReportView
          v-else-if="activeTop === 'transactions' && activeSub === 'sell'"
          transaction-type="SELL"
        />

        <!-- ── Balance Statement ──────────────────────────────────────────────── -->
        <div v-else-if="activeTop === 'financial' && activeSub === 'balance'">
          <div class="ar-report-header">
            <div>
              <h3>Balance Sheet Statement</h3>
              <p class="ar-report-meta">As of {{ new Date().toISOString().slice(0,10) }} | Fiscal Year: 2026</p>
            </div>
          </div>
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
              <thead><tr><th>Account</th><th style="text-align:right">Amount (ETB)</th></tr></thead>
              <tbody>
                <tr><td colspan="2" class="ar-group-row">ASSET</td></tr>
                <tr v-for="a in accountSeed.filter(a => a.type === 'Asset')" :key="a.id">
                  <td>{{ a.accountName }} {{ a.accountNumber }}</td>
                  <td style="text-align:right;color:#168a7b">
                    {{ fmt(journalSeed.filter(j => j.accountCode === a.accountCode && j.status === 'POSTED').reduce((s,j) => s + j.debit - j.credit, 0)) }}
                  </td>
                </tr>
                <tr><td colspan="2" class="ar-group-row">LIABILITY</td></tr>
                <tr><td colspan="2" style="text-align:center;color:#718096;font-size:12px;padding:12px">No liabilities recorded.</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Trial Balance ──────────────────────────────────────────────────── -->
        <div v-else-if="activeTop === 'financial' && activeSub === 'trial'">
          <div class="ar-report-header">
            <h3>Trial Balance</h3>
            <p class="ar-report-meta">As of {{ new Date().toISOString().slice(0,10) }}</p>
          </div>
          <div class="ar-summary-cards">
            <div class="ar-summary-card ar-summary-card--green">
              <span>Total Debits</span><strong>ETB {{ fmt(totalDebit) }}</strong>
            </div>
            <div class="ar-summary-card ar-summary-card--red">
              <span>Total Credits</span><strong>ETB {{ fmt(totalCredit) }}</strong>
            </div>
            <div class="ar-summary-card" :class="Math.abs(totalDebit - totalCredit) < 0.01 ? 'ar-summary-card--green' : 'ar-summary-card--red'">
              <span>Balance</span>
              <strong>{{ Math.abs(totalDebit - totalCredit) < 0.01 ? '✓ Balanced' : 'ETB ' + fmt(Math.abs(totalDebit - totalCredit)) }}</strong>
            </div>
          </div>
          <div class="module-table-wrap" style="margin-top:16px">
            <table class="module-table">
              <thead><tr><th>Account code</th><th>Account name</th><th style="text-align:right">Debit (ETB)</th><th style="text-align:right">Credit (ETB)</th><th style="text-align:right">Net balance</th></tr></thead>
              <tbody>
                <tr v-for="r in trialRows" :key="r.id">
                  <td><strong>{{ r.accountCode }}</strong></td>
                  <td>{{ r.accountName }}</td>
                  <td style="text-align:right">{{ fmt(r.debit) }}</td>
                  <td style="text-align:right">{{ fmt(r.credit) }}</td>
                  <td style="text-align:right" :style="{ color: r.net >= 0 ? '#168a7b' : '#c0392b' }"><strong>{{ fmt(r.net) }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Cash Flow ──────────────────────────────────────────────────────── -->
        <div v-else-if="activeTop === 'financial' && activeSub === 'cashflow'">
          <div class="ar-report-header">
            <h3>Cash Flow Statement</h3>
            <p class="ar-report-meta">Period: 2026</p>
          </div>
          <div class="ar-empty">Cash flow data will appear here once linked to operational transactions.</div>
        </div>

        <!-- ── General Ledger ─────────────────────────────────────────────────── -->
        <div v-else-if="activeTop === 'ledgers' && activeSub === 'general'">
          <div class="ar-report-header"><h3>General Ledger</h3></div>
          <div class="module-table-wrap">
            <table class="module-table">
              <thead><tr><th>Reference</th><th>Date</th><th>Description</th><th>Account</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="j in journalSeed" :key="j.id">
                  <td><strong>{{ j.reference }}</strong></td>
                  <td>{{ j.date }}</td>
                  <td>{{ j.description }}</td>
                  <td>{{ j.accountName }}</td>
                  <td style="text-align:right">{{ fmt(j.debit) }}</td>
                  <td style="text-align:right">{{ fmt(j.credit) }}</td>
                  <td><span :style="{ color: j.status === 'POSTED' ? '#168a7b' : '#b26b00', fontWeight: 700, fontSize: '12px' }">{{ j.status }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Daily Ledger ───────────────────────────────────────────────────── -->
        <div v-else-if="activeTop === 'ledgers' && activeSub === 'daily'">
          <div class="ar-report-header"><h3>Daily Ledger</h3></div>
          <div class="ar-empty">Daily ledger will be populated from operational transactions.</div>
        </div>

        <!-- ── Other Reports ──────────────────────────────────────────────────── -->
        <div v-else>
          <div class="ar-report-header"><h3>Summary Report</h3></div>
          <div class="ar-empty">Select a report from the left menu.</div>
        </div>

      </div><!-- /ar-content -->
    </div><!-- /ar-body -->
  </div>
</template>

<style scoped>
.ar-page { max-width: 1400px; }
.ar-subtitle { margin: 6px 0 0; color: #77879b; font-size: 12px; }

/* top tabs */
.ar-top-tabs {
  display: flex; gap: 0;
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

/* body layout */
.ar-body { display: grid; grid-template-columns: 190px 1fr; gap: 24px; align-items: start; }

/* left sub-nav */
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

/* report header */
.ar-report-header { margin-bottom: 16px; }
.ar-report-header h3 { font-size: 22px; margin: 0 0 4px; color: var(--ink, #172536); }
.ar-report-meta { font-size: 12px; color: var(--muted, #718096); margin: 0; }

/* summary cards */
.ar-summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 8px; }
.ar-summary-card { padding: 16px 18px; border-radius: 10px; border: 1px solid var(--border-color, #e1e7ef); }
.ar-summary-card span { display: block; font-size: 12px; color: var(--muted, #718096); margin-bottom: 6px; }
.ar-summary-card strong { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.ar-summary-card--green { background: #f0faf5; border-color: #b7e4cd; }
.ar-summary-card--green strong { color: #168a7b; }
.ar-summary-card--red   { background: #fff5f5; border-color: #f5c6c6; }
.ar-summary-card--red   strong { color: #c0392b; }
.ar-summary-card--blue  { background: #eaf2ff; border-color: #bcd5f8; }
.ar-summary-card--blue  strong { color: #1769d2; }

/* group row */
.ar-group-row { background: #f0f4f8; font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: #3a5068; padding: 8px 16px; }

/* empty state */
.ar-empty { padding: 40px; text-align: center; color: var(--muted, #718096); font-size: 13px; background: var(--surface-muted, #f8fafc); border-radius: 10px; border: 1px dashed var(--border-color, #dbe2ea); }

@media (max-width: 860px) {
  .ar-body { grid-template-columns: 1fr; }
  .ar-subnav { flex-direction: row; flex-wrap: wrap; }
  .ar-summary-cards { grid-template-columns: 1fr; }
  .ar-top-tabs { overflow-x: auto; }
}
</style>

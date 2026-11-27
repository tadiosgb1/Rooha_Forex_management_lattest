<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import TradeReportView from '../trade-reports/TradeReportView.vue'
import { accountingService } from '../../services/accountingService'
import { apiRequest } from '../../services/apiClient'
import { useToast } from '../../composables/toast'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseModal  from '../../components/ui/BaseModal.vue'

const toast = useToast()

// ── top tabs ──────────────────────────────────────────────────────────────────
const TOP_TABS = [
  { key: 'financial',    label: 'Financial Statements', icon: '📊' },
  { key: 'ledgers',      label: 'Ledgers',              icon: '📒' },
  { key: 'other',        label: 'Other Reports',        icon: '📄' },
  { key: 'transactions', label: 'Transaction Reports',  icon: '⇄'  },
]
const SUB_MENUS = {
  financial:    [
    { key: 'balance',  label: 'Balance Sheet', icon: '▤' },
    { key: 'trial',    label: 'Trial Balance',  icon: '▤' },
    { key: 'cashflow', label: 'Cash Flow',      icon: '⊙' },
  ],
  ledgers:      [
    { key: 'general', label: 'General Ledger', icon: '▤' },
    { key: 'daily',   label: 'Daily Ledger',   icon: '▤' },
  ],
  other:        [{ key: 'summary',  label: 'Summary Report',  icon: '▤' }],
  transactions: [
    { key: 'buy',  label: 'Buy Report',  icon: '↙' },
    { key: 'sell', label: 'Sell Report', icon: '↗' },
  ],
}

const activeTop = ref('financial')
const activeSub = ref('balance')

function switchTop(key) {
  activeTop.value = key
  activeSub.value = SUB_MENUS[key][0].key
}
const currentSubs = computed(() => SUB_MENUS[activeTop.value] ?? [])

// ── utilities ─────────────────────────────────────────────────────────────────
function today()       { return new Date().toISOString().slice(0, 10) }
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
  if (Array.isArray(r))              return r
  if (Array.isArray(r?.data))        return r.data
  if (Array.isArray(r?.data?.items)) return r.data.items
  if (Array.isArray(r?.items))       return r.items
  return []
}

// ── shared reference data (vaults, currencies, banks) ────────────────────────
const refVaults     = ref([])
const refCurrencies = ref([])
const refBanks      = ref([])

async function loadRefData() {
  const [vr, cr, br] = await Promise.allSettled([
    apiRequest('cash-management/vaults'),
    apiRequest('reference-currencies'),
    apiRequest('banks'),
  ])
  if (vr.status === 'fulfilled') refVaults.value     = normalizeList(vr.value)
  if (cr.status === 'fulfilled') refCurrencies.value = normalizeList(cr.value).filter(c => c.is_active !== false)
  if (br.status === 'fulfilled') refBanks.value      = normalizeList(br.value)
}

onMounted(loadRefData)

// ══════════════════════════════════════════════════════════════════════════════
//  BALANCE SHEET
// ══════════════════════════════════════════════════════════════════════════════
const bsLoading = ref(false)
const bsError   = ref('')
const bsVaults  = ref([])
const bsBanks   = ref([])

async function loadBalanceSheet() {
  bsLoading.value = true; bsError.value = ''
  try {
    const [vr, br] = await Promise.all([
      accountingService.getVaults(),
      accountingService.getBankAccounts({ is_active: true }),
    ])
    bsVaults.value = normalizeList(vr)
    bsBanks.value  = normalizeList(br)
  } catch (e) { bsError.value = e?.message || 'Could not load balance sheet.' }
  finally { bsLoading.value = false }
}

const bsCashRows = computed(() => {
  const rows = []
  for (const v of bsVaults.value)
    for (const b of (v.balances ?? []))
      rows.push({ label: `${v.vault_name} (${b.code})`, type: 'Cash', amount: Number(b.current_balance ?? 0), currency: b.code })
  return rows
})
const bsBankRows = computed(() =>
  bsBanks.value.map(b => ({
    label:    `${b.bank_name ?? b.bank?.bank_name ?? 'Bank'} – ${b.account_number}`,
    type:     'Bank',
    amount:   Number(b.current_balance ?? b.balance ?? 0),
    currency: b.currency_code ?? 'ETB',
    id:       b.id,
  }))
)
const totalAssets      = computed(() => [...bsCashRows.value, ...bsBankRows.value].reduce((s, r) => s + r.amount, 0))
const totalLiabilities = computed(() => 0)
const totalEquity      = computed(() => totalAssets.value - totalLiabilities.value)

// — Create Bank Account modal ─────────────────────────────────────────────────
const baBankModalOpen = ref(false)
const baBankSaving    = ref(false)
const baBankForm      = reactive({ bank_id: '', currency_id: '', account_number: '', account_name: '', notes: '' })

async function saveBankAccount() {
  if (!baBankForm.bank_id || !baBankForm.account_number.trim() || !baBankForm.account_name.trim()) {
    toast.error('Bank, account number and account name are required.'); return
  }
  baBankSaving.value = true
  try {
    await apiRequest('bank-accounts', {
      method: 'POST',
      body: { bank_id: baBankForm.bank_id, account_number: baBankForm.account_number.trim(), account_name: baBankForm.account_name.trim(), currency_id: baBankForm.currency_id || undefined, notes: baBankForm.notes.trim() || undefined },
    })
    toast.success('Bank account created.')
    baBankModalOpen.value = false
    Object.assign(baBankForm, { bank_id: '', currency_id: '', account_number: '', account_name: '', notes: '' })
    await loadBalanceSheet()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { baBankSaving.value = false }
}

// — Deposit / Withdrawal modal ─────────────────────────────────────────────────
const txModalOpen   = ref(false)
const txModalType   = ref('deposit')   // 'deposit' | 'withdrawal'
const txTargetId    = ref('')
const txTargetLabel = ref('')
const txSaving      = ref(false)
const txForm        = reactive({ amount: '', description: '' })

function openTxModal(type, account) {
  txModalType.value   = type
  txTargetId.value    = account.id
  txTargetLabel.value = account.label
  Object.assign(txForm, { amount: '', description: '' })
  txModalOpen.value   = true
}
async function saveTx() {
  if (!txForm.amount || Number(txForm.amount) <= 0) { toast.error('Amount must be positive.'); return }
  txSaving.value = true
  try {
    const path = `bank-accounts/${encodeURIComponent(txTargetId.value)}/${txModalType.value === 'deposit' ? 'deposits' : 'withdrawals'}`
    await apiRequest(path, { method: 'POST', body: { amount: Number(txForm.amount), description: txForm.description.trim() || undefined } })
    toast.success(`${txModalType.value === 'deposit' ? 'Deposit' : 'Withdrawal'} recorded.`)
    txModalOpen.value = false
    await loadBalanceSheet()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { txSaving.value = false }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TRIAL BALANCE
// ══════════════════════════════════════════════════════════════════════════════
const tbLoading = ref(false)
const tbError   = ref('')
const tbLedger  = ref([])
const tbFrom    = ref(firstOfYear())
const tbTo      = ref(today())

async function loadTrialBalance() {
  tbLoading.value = true; tbError.value = ''
  try { tbLedger.value = normalizeList(await accountingService.getLedger({ fromDate: tbFrom.value, toDate: tbTo.value })) }
  catch (e) { tbError.value = e?.message || 'Could not load ledger.' }
  finally { tbLoading.value = false }
}

const tbRows = computed(() => {
  const map = {}
  for (const e of tbLedger.value) {
    const key = `${e.vault_id}__${e.currency_id}`
    if (!map[key]) map[key] = { account: `${e.vault_name ?? e.vault_code ?? e.vault_id} (${e.currency_code ?? ''})`, debit: 0, credit: 0 }
    if (e.entry_type === 'DEBIT') map[key].debit  += Number(e.amount ?? 0)
    else                          map[key].credit += Number(e.amount ?? 0)
  }
  return Object.values(map).map(r => ({ ...r, net: r.debit - r.credit }))
})
const tbTotalDebit  = computed(() => tbRows.value.reduce((s, r) => s + r.debit,  0))
const tbTotalCredit = computed(() => tbRows.value.reduce((s, r) => s + r.credit, 0))
const tbBalanced    = computed(() => Math.abs(tbTotalDebit.value - tbTotalCredit.value) < 0.01)

// — Create Opening Balance modal ───────────────────────────────────────────────
const obModalOpen = ref(false)
const obSaving    = ref(false)
const obForm      = reactive({ vault_id: '', currency_id: '', opening_balance: '', notes: '' })

async function saveOpeningBalance() {
  if (!obForm.vault_id || !obForm.currency_id || !obForm.opening_balance) {
    toast.error('Vault, currency and opening balance are required.'); return
  }
  obSaving.value = true
  try {
    await apiRequest(`cash-management/vaults/${encodeURIComponent(obForm.vault_id)}/opening-balances`, {
      method: 'POST',
      body: { currency_id: obForm.currency_id, opening_balance: Number(obForm.opening_balance), notes: obForm.notes.trim() || undefined },
    })
    toast.success('Opening balance created.')
    obModalOpen.value = false
    Object.assign(obForm, { vault_id: '', currency_id: '', opening_balance: '', notes: '' })
    await loadTrialBalance()
    await loadBalanceSheet()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { obSaving.value = false }
}

// ══════════════════════════════════════════════════════════════════════════════
//  CASH FLOW
// ══════════════════════════════════════════════════════════════════════════════
const cfLoading   = ref(false)
const cfError     = ref('')
const cfTransfers = ref([])
const cfFrom      = ref(firstOfYear())
const cfTo        = ref(today())

async function loadCashFlow() {
  cfLoading.value = true; cfError.value = ''
  try { cfTransfers.value = normalizeList(await accountingService.getTransfers({ fromDate: cfFrom.value, toDate: cfTo.value })) }
  catch (e) { cfError.value = e?.message || 'Could not load transfers.' }
  finally { cfLoading.value = false }
}

const cfTotalIn  = computed(() => cfTransfers.value.reduce((s, t) => s + Number(t.received_amount ?? t.initiated_amount ?? 0), 0))
const cfTotalOut = computed(() => cfTransfers.value.filter(t => t.status === 'IN_TRANSIT').reduce((s, t) => s + Number(t.initiated_amount ?? 0), 0))
const cfNet      = computed(() => cfTotalIn.value - cfTotalOut.value)

// — Initiate Transfer modal ────────────────────────────────────────────────────
const cfModalOpen = ref(false)
const cfSaving    = ref(false)
const cfForm      = reactive({ source_vault_id: '', dest_vault_id: '', currency_id: '', transfer_type: 'VAULT_TO_TELLER', initiated_amount: '', tolerance_amount: '', remarks: '' })

const TRANSFER_TYPES = ['VAULT_TO_TELLER', 'TELLER_TO_VAULT', 'TELLER_TO_TELLER', 'BRANCH_TO_BRANCH']

async function saveTransfer() {
  if (!cfForm.source_vault_id || !cfForm.dest_vault_id || !cfForm.currency_id || !cfForm.initiated_amount) {
    toast.error('Source vault, destination vault, currency and amount are required.'); return
  }
  cfSaving.value = true
  try {
    await apiRequest('cash-management/transfers', {
      method: 'POST',
      body: {
        source_vault_id:  cfForm.source_vault_id,
        dest_vault_id:    cfForm.dest_vault_id,
        currency_id:      cfForm.currency_id,
        transfer_type:    cfForm.transfer_type,
        initiated_amount: Number(cfForm.initiated_amount),
        ...(cfForm.tolerance_amount ? { tolerance_amount: Number(cfForm.tolerance_amount) } : {}),
        ...(cfForm.remarks.trim()   ? { remarks: cfForm.remarks.trim() }                   : {}),
      },
    })
    toast.success('Transfer initiated.')
    cfModalOpen.value = false
    Object.assign(cfForm, { source_vault_id: '', dest_vault_id: '', currency_id: '', transfer_type: 'VAULT_TO_TELLER', initiated_amount: '', tolerance_amount: '', remarks: '' })
    await loadCashFlow()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { cfSaving.value = false }
}

// — Receive Transfer modal ─────────────────────────────────────────────────────
const rcvModalOpen   = ref(false)
const rcvSaving      = ref(false)
const rcvTarget      = ref(null)
const rcvForm        = reactive({ received_amount: '', receipt_notes: 'Cash counted and matched with transfer slip' })

function openReceiveModal(t) {
  rcvTarget.value = t
  Object.assign(rcvForm, { received_amount: t.initiated_amount ?? '', receipt_notes: 'Cash counted and matched with transfer slip' })
  rcvModalOpen.value = true
}
async function saveReceive() {
  if (!rcvForm.received_amount || Number(rcvForm.received_amount) < 0) { toast.error('Received amount is required.'); return }
  rcvSaving.value = true
  try {
    await apiRequest(`cash-management/transfers/${encodeURIComponent(rcvTarget.value.id)}/receive`, {
      method: 'POST',
      body: { received_amount: Number(rcvForm.received_amount), receipt_notes: rcvForm.receipt_notes.trim() || undefined },
    })
    toast.success('Transfer received.')
    rcvModalOpen.value = false
    await loadCashFlow()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { rcvSaving.value = false }
}

// — Reject Transfer modal ──────────────────────────────────────────────────────
const rjTxModalOpen   = ref(false)
const rjTxSaving      = ref(false)
const rjTxTarget      = ref(null)
const rjTxReason      = ref('')

function openRejectTxModal(t) { rjTxTarget.value = t; rjTxReason.value = ''; rjTxModalOpen.value = true }
async function saveRejectTx() {
  if (!rjTxReason.value.trim()) { toast.error('Reason is required.'); return }
  rjTxSaving.value = true
  try {
    await apiRequest(`cash-management/transfers/${encodeURIComponent(rjTxTarget.value.id)}/reject`, {
      method: 'POST', body: { reason: rjTxReason.value.trim() },
    })
    toast.success('Transfer rejected.')
    rjTxModalOpen.value = false
    await loadCashFlow()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { rjTxSaving.value = false }
}

// ══════════════════════════════════════════════════════════════════════════════
//  GENERAL LEDGER
// ══════════════════════════════════════════════════════════════════════════════
const glLoading  = ref(false)
const glError    = ref('')
const glRows     = ref([])
const glFrom     = ref(firstOfYear())
const glTo       = ref(today())
const glPage     = ref(1)
const GL_PAGE_SZ = 50

async function loadGeneralLedger() {
  glLoading.value = true; glError.value = ''
  try { glRows.value = normalizeList(await accountingService.getLedger({ fromDate: glFrom.value, toDate: glTo.value })); glPage.value = 1 }
  catch (e) { glError.value = e?.message || 'Could not load general ledger.' }
  finally { glLoading.value = false }
}

const glTotalPages  = computed(() => Math.max(1, Math.ceil(glRows.value.length / GL_PAGE_SZ)))
const glPageRows    = computed(() => glRows.value.slice((glPage.value - 1) * GL_PAGE_SZ, glPage.value * GL_PAGE_SZ))
const glTotalDebit  = computed(() => glRows.value.filter(r => r.entry_type === 'DEBIT' ).reduce((s, r) => s + Number(r.amount ?? 0), 0))
const glTotalCredit = computed(() => glRows.value.filter(r => r.entry_type === 'CREDIT').reduce((s, r) => s + Number(r.amount ?? 0), 0))

// — Create Opening Balance (also from General Ledger) uses the same obModalOpen / obForm

// ══════════════════════════════════════════════════════════════════════════════
//  DAILY LEDGER
// ══════════════════════════════════════════════════════════════════════════════
const dlLoading  = ref(false)
const dlError    = ref('')
const dlRows     = ref([])
const dlDate     = ref(today())

async function loadDailyLedger() {
  dlLoading.value = true; dlError.value = ''
  try { dlRows.value = normalizeList(await accountingService.getLedger({ fromDate: dlDate.value, toDate: dlDate.value })) }
  catch (e) { dlError.value = e?.message || 'Could not load daily ledger.' }
  finally { dlLoading.value = false }
}

const dlTotalDebit  = computed(() => dlRows.value.filter(r => r.entry_type === 'DEBIT' ).reduce((s, r) => s + Number(r.amount ?? 0), 0))
const dlTotalCredit = computed(() => dlRows.value.filter(r => r.entry_type === 'CREDIT').reduce((s, r) => s + Number(r.amount ?? 0), 0))

// — Create Daily Reconciliation modal ─────────────────────────────────────────
const rcModalOpen = ref(false)
const rcSaving    = ref(false)
const rcForm      = reactive({ vault_id: '', currency_id: '', business_date: today(), counted_physical_amount: '', notes: '' })

async function saveReconciliation() {
  if (!rcForm.vault_id || !rcForm.currency_id || !rcForm.business_date || !rcForm.counted_physical_amount) {
    toast.error('Vault, currency, date and counted amount are required.'); return
  }
  rcSaving.value = true
  try {
    await apiRequest('cash-management/reconciliations', {
      method: 'POST',
      body: { vault_id: rcForm.vault_id, currency_id: rcForm.currency_id, business_date: rcForm.business_date, counted_physical_amount: Number(rcForm.counted_physical_amount), notes: rcForm.notes.trim() || undefined },
    })
    toast.success('Reconciliation submitted.')
    rcModalOpen.value = false
    Object.assign(rcForm, { vault_id: '', currency_id: '', business_date: today(), counted_physical_amount: '', notes: '' })
    await loadDailyLedger()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { rcSaving.value = false }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUMMARY REPORT
// ══════════════════════════════════════════════════════════════════════════════
const smLoading   = ref(false)
const smError     = ref('')
const smTrades    = ref([])
const smReconcile = ref([])
const smFrom      = ref(firstOfYear())
const smTo        = ref(today())

async function loadSummary() {
  smLoading.value = true; smError.value = ''
  try {
    const [tr, rr] = await Promise.all([
      accountingService.getTradeTransactions({ start_date: smFrom.value, end_date: smTo.value, limit: 500 }),
      accountingService.getReconciliations(),
    ])
    smTrades.value    = normalizeList(tr)
    smReconcile.value = normalizeList(rr)
  } catch (e) { smError.value = e?.message || 'Could not load summary.' }
  finally { smLoading.value = false }
}

const smApproved  = computed(() => smTrades.value.filter(t => t.status === 'APPROVED'))
const smBuys      = computed(() => smApproved.value.filter(t => t.transaction_type === 'BUY'))
const smSells     = computed(() => smApproved.value.filter(t => t.transaction_type === 'SELL'))
const smTotalBuy  = computed(() => smBuys.value.reduce( (s, t) => s + Number(t.total_amount_etb ?? t.total_amount ?? 0), 0))
const smTotalSell = computed(() => smSells.value.reduce((s, t) => s + Number(t.total_amount_etb ?? t.total_amount ?? 0), 0))
const smVariance  = computed(() => smReconcile.value.filter(r => r.status === 'VARIANCE_FLAGGED').length)

// — Accept / Reject opening balance modals (also needed in summary) ───────────
const acModalOpen   = ref(false)
const acSaving      = ref(false)
const acTarget      = ref(null)
const acCountedAmt  = ref('')

function openAcceptModal(item) { acTarget.value = item; acCountedAmt.value = item.opening_balance ?? ''; acModalOpen.value = true }
async function saveAccept() {
  if (!acCountedAmt.value) { toast.error('Counted amount is required.'); return }
  acSaving.value = true
  try {
    await apiRequest(`cash-management/opening-balances/${encodeURIComponent(acTarget.value.id)}/accept`, {
      method: 'POST', body: { counted_amount: Number(acCountedAmt.value) },
    })
    toast.success('Opening balance accepted.')
    acModalOpen.value = false
    await loadSummary()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { acSaving.value = false }
}

const rjObModalOpen = ref(false)
const rjObSaving    = ref(false)
const rjObTarget    = ref(null)
const rjObReason    = ref('')

function openRejectObModal(item) { rjObTarget.value = item; rjObReason.value = ''; rjObModalOpen.value = true }
async function saveRejectOb() {
  if (!rjObReason.value.trim()) { toast.error('Reason is required.'); return }
  rjObSaving.value = true
  try {
    await apiRequest(`cash-management/opening-balances/${encodeURIComponent(rjObTarget.value.id)}/reject`, {
      method: 'POST', body: { reason: rjObReason.value.trim() },
    })
    toast.success('Opening balance rejected.')
    rjObModalOpen.value = false
    await loadSummary()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { rjObSaving.value = false }
}

// ── auto-load on tab switch ───────────────────────────────────────────────────
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

    <!-- top tab bar -->
    <nav class="ar-top-tabs">
      <button
        v-for="tab in TOP_TABS" :key="tab.key"
        type="button" class="ar-top-tab"
        :class="{ active: activeTop === tab.key }"
        @click="switchTop(tab.key)"
      >
        <span>{{ tab.icon }}</span> {{ tab.label }}
      </button>
    </nav>

    <!-- body: left sub-menu + right content -->
    <div class="ar-body">

      <aside class="ar-subnav">
        <button
          v-for="sub in currentSubs" :key="sub.key"
          type="button" class="ar-subnav-item"
          :class="{ active: activeSub === sub.key }"
          @click="activeSub = sub.key"
        >
          <span>{{ sub.icon }}</span> {{ sub.label }}
        </button>
      </aside>

      <div class="ar-content">

        <!-- ══════════════════════════════════════════════════════════════════
             BALANCE SHEET
        ══════════════════════════════════════════════════════════════════ -->
        <div v-if="activeTop === 'financial' && activeSub === 'balance'">
          <div class="ar-report-header">
            <div>
              <h3>Balance Sheet Statement</h3>
              <p class="ar-report-meta">As of {{ today() }} | Fiscal Year: {{ new Date().getFullYear() }}</p>
            </div>
            <div class="ar-header-actions">
              <BaseButton variant="secondary" size="sm" @click="baBankModalOpen = true">＋ Add Bank Account</BaseButton>
              <BaseButton variant="secondary" size="sm" @click="loadBalanceSheet" :disabled="bsLoading">↻ Refresh</BaseButton>
            </div>
          </div>

          <p v-if="bsError" class="ar-error">{{ bsError }}</p>
          <p v-if="bsLoading" class="ar-loading">Loading balance sheet…</p>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Total Assets</span><strong>ETB {{ fmt(totalAssets) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Total Liabilities</span><strong>ETB {{ fmt(totalLiabilities) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--blue">
                <span>Total Equity</span><strong>ETB {{ fmt(totalEquity) }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead><tr><th>Account / Vault</th><th>Type</th><th style="text-align:right">Currency</th><th style="text-align:right">Amount</th><th>Actions</th></tr></thead>
                <tbody>
                  <tr><td colspan="5" class="ar-group-row">CASH IN VAULTS</td></tr>
                  <tr v-if="!bsCashRows.length"><td colspan="5" class="ar-empty-row">No vault balances found.</td></tr>
                  <tr v-for="(r,i) in bsCashRows" :key="'c'+i">
                    <td>{{ r.label }}</td>
                    <td><span class="ar-badge ar-badge--blue">{{ r.type }}</span></td>
                    <td style="text-align:right">{{ r.currency }}</td>
                    <td style="text-align:right;color:#168a7b;font-weight:700">{{ fmt(r.amount) }}</td>
                    <td>—</td>
                  </tr>

                  <tr><td colspan="5" class="ar-group-row">CASH AT BANK</td></tr>
                  <tr v-if="!bsBankRows.length"><td colspan="5" class="ar-empty-row">No bank accounts found.</td></tr>
                  <tr v-for="(r,i) in bsBankRows" :key="'b'+i">
                    <td>{{ r.label }}</td>
                    <td><span class="ar-badge ar-badge--teal">{{ r.type }}</span></td>
                    <td style="text-align:right">{{ r.currency }}</td>
                    <td style="text-align:right;color:#168a7b;font-weight:700">{{ fmt(r.amount) }}</td>
                    <td>
                      <div class="ar-actions">
                        <BaseButton variant="secondary" size="sm" @click="openTxModal('deposit', r)">＋ Deposit</BaseButton>
                        <BaseButton variant="secondary" size="sm" @click="openTxModal('withdrawal', r)">— Withdraw</BaseButton>
                      </div>
                    </td>
                  </tr>

                  <tr><td colspan="5" class="ar-group-row">LIABILITIES</td></tr>
                  <tr><td colspan="5" class="ar-empty-row">No liabilities recorded.</td></tr>

                  <tr><td colspan="5" class="ar-group-row">EQUITY</td></tr>
                  <tr>
                    <td colspan="4">Retained Earnings / Net Position</td>
                    <td></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="font-weight:800;background:#f8fafc">
                    <td colspan="3">Total Assets</td>
                    <td style="text-align:right;color:#168a7b">{{ fmt(totalAssets) }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </template>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             TRIAL BALANCE
        ══════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'financial' && activeSub === 'trial'">
          <div class="ar-report-header">
            <div>
              <h3>Trial Balance</h3>
              <p class="ar-report-meta">From {{ tbFrom }} to {{ tbTo }}</p>
            </div>
            <div class="ar-header-actions">
              <BaseButton variant="secondary" size="sm" @click="obModalOpen = true">＋ Opening Balance</BaseButton>
              <input type="date" class="ar-date-input" v-model="tbFrom" @change="loadTrialBalance" />
              <span class="ar-filter-sep">→</span>
              <input type="date" class="ar-date-input" v-model="tbTo"   @change="loadTrialBalance" />
              <BaseButton variant="secondary" size="sm" @click="loadTrialBalance" :disabled="tbLoading">↻</BaseButton>
            </div>
          </div>

          <p v-if="tbError" class="ar-error">{{ tbError }}</p>
          <p v-if="tbLoading" class="ar-loading">Loading trial balance…</p>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Total Debits</span><strong>ETB {{ fmt(tbTotalDebit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Total Credits</span><strong>ETB {{ fmt(tbTotalCredit) }}</strong>
              </div>
              <div class="ar-summary-card" :class="tbBalanced ? 'ar-summary-card--green' : 'ar-summary-card--red'">
                <span>Balance</span>
                <strong>{{ tbBalanced ? '✓ Balanced' : 'ETB ' + fmt(Math.abs(tbTotalDebit - tbTotalCredit)) }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead><tr><th>Account (Vault / Currency)</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Net Balance</th></tr></thead>
                <tbody>
                  <tr v-if="!tbRows.length"><td colspan="4" class="ar-empty-row">No ledger entries for the selected period.</td></tr>
                  <tr v-for="(r,i) in tbRows" :key="i">
                    <td>{{ r.account }}</td>
                    <td style="text-align:right">{{ fmt(r.debit) }}</td>
                    <td style="text-align:right">{{ fmt(r.credit) }}</td>
                    <td style="text-align:right;font-weight:700" :style="{ color: r.net >= 0 ? '#168a7b' : '#c0392b' }">{{ fmt(r.net) }}</td>
                  </tr>
                </tbody>
                <tfoot v-if="tbRows.length">
                  <tr style="font-weight:800;background:#f8fafc">
                    <td>Totals</td>
                    <td style="text-align:right;color:#168a7b">{{ fmt(tbTotalDebit) }}</td>
                    <td style="text-align:right;color:#c0392b">{{ fmt(tbTotalCredit) }}</td>
                    <td style="text-align:right" :style="{ color: tbBalanced ? '#168a7b' : '#c0392b' }">{{ tbBalanced ? '✓' : fmt(tbTotalDebit - tbTotalCredit) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </template>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             CASH FLOW
        ══════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'financial' && activeSub === 'cashflow'">
          <div class="ar-report-header">
            <div>
              <h3>Cash Flow Statement</h3>
              <p class="ar-report-meta">From {{ cfFrom }} to {{ cfTo }}</p>
            </div>
            <div class="ar-header-actions">
              <BaseButton variant="secondary" size="sm" @click="cfModalOpen = true">＋ Initiate Transfer</BaseButton>
              <input type="date" class="ar-date-input" v-model="cfFrom" @change="loadCashFlow" />
              <span class="ar-filter-sep">→</span>
              <input type="date" class="ar-date-input" v-model="cfTo"   @change="loadCashFlow" />
              <BaseButton variant="secondary" size="sm" @click="loadCashFlow" :disabled="cfLoading">↻</BaseButton>
            </div>
          </div>

          <p v-if="cfError" class="ar-error">{{ cfError }}</p>
          <p v-if="cfLoading" class="ar-loading">Loading cash flow data…</p>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Total Inflows</span><strong>{{ fmt(cfTotalIn) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>In Transit</span><strong>{{ fmt(cfTotalOut) }}</strong>
              </div>
              <div class="ar-summary-card" :class="cfNet >= 0 ? 'ar-summary-card--green' : 'ar-summary-card--red'">
                <span>Net Cash Flow</span><strong>{{ fmt(cfNet) }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead>
                  <tr><th>Reference</th><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Currency</th><th style="text-align:right">Amount</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  <tr v-if="!cfTransfers.length"><td colspan="9" class="ar-empty-row">No transfers found for the selected period.</td></tr>
                  <tr v-for="t in cfTransfers" :key="t.id">
                    <td><strong>{{ t.transfer_ref ?? t.id?.slice(0,8) }}</strong></td>
                    <td>{{ fmtDate(t.initiated_at) }}</td>
                    <td><span class="ar-badge ar-badge--grey">{{ (t.transfer_type ?? '').replace(/_/g, ' ') }}</span></td>
                    <td>{{ t.source_vault_name ?? t.source_vault_code ?? '—' }}</td>
                    <td>{{ t.dest_vault_name   ?? t.dest_vault_code   ?? '—' }}</td>
                    <td>{{ t.currency_code ?? '—' }}</td>
                    <td style="text-align:right;font-weight:700">{{ fmt(t.received_amount ?? t.initiated_amount) }}</td>
                    <td>
                      <span class="ar-badge"
                        :class="{ 'ar-badge--green': t.status === 'COMPLETED', 'ar-badge--yellow': t.status === 'IN_TRANSIT', 'ar-badge--red': t.status === 'REJECTED' }">
                        {{ t.status }}
                      </span>
                    </td>
                    <td>
                      <div class="ar-actions" v-if="t.status === 'IN_TRANSIT'">
                        <BaseButton variant="secondary" size="sm" @click="openReceiveModal(t)">Receive</BaseButton>
                        <BaseButton variant="danger"    size="sm" @click="openRejectTxModal(t)">Reject</BaseButton>
                      </div>
                      <span v-else class="ar-muted-sm">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             GENERAL LEDGER
        ══════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'ledgers' && activeSub === 'general'">
          <div class="ar-report-header">
            <div>
              <h3>General Ledger</h3>
              <p class="ar-report-meta">{{ glFrom }} → {{ glTo }} · {{ glRows.length }} entries</p>
            </div>
            <div class="ar-header-actions">
              <BaseButton variant="secondary" size="sm" @click="obModalOpen = true">＋ Opening Balance</BaseButton>
              <input type="date" class="ar-date-input" v-model="glFrom" @change="loadGeneralLedger" />
              <span class="ar-filter-sep">→</span>
              <input type="date" class="ar-date-input" v-model="glTo"   @change="loadGeneralLedger" />
              <BaseButton variant="secondary" size="sm" @click="loadGeneralLedger" :disabled="glLoading">↻</BaseButton>
            </div>
          </div>

          <p v-if="glError" class="ar-error">{{ glError }}</p>
          <p v-if="glLoading" class="ar-loading">Loading general ledger…</p>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Total Debits</span><strong>{{ fmt(glTotalDebit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Total Credits</span><strong>{{ fmt(glTotalCredit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--blue">
                <span>Entries</span><strong>{{ glRows.length }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead>
                  <tr><th>Date / Time</th><th>Vault</th><th>Currency</th><th>Reference</th><th>Notes</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance After</th></tr>
                </thead>
                <tbody>
                  <tr v-if="!glPageRows.length"><td colspan="8" class="ar-empty-row">No ledger entries for the selected period.</td></tr>
                  <tr v-for="e in glPageRows" :key="e.id">
                    <td>{{ fmtDateTime(e.created_at) }}</td>
                    <td>{{ e.vault_name ?? e.vault_code ?? e.vault_id?.slice(0,8) }}</td>
                    <td>{{ e.currency_code ?? '—' }}</td>
                    <td><span v-if="e.reference_type" class="ar-badge ar-badge--grey">{{ e.reference_type.replace(/_/g, ' ') }}</span><span v-else>—</span></td>
                    <td class="ar-notes-cell">{{ e.notes ?? '—' }}</td>
                    <td style="text-align:right;color:#168a7b;font-weight:600">{{ e.entry_type === 'DEBIT'  ? fmt(e.amount) : '' }}</td>
                    <td style="text-align:right;color:#c0392b;font-weight:600">{{ e.entry_type === 'CREDIT' ? fmt(e.amount) : '' }}</td>
                    <td style="text-align:right;font-weight:700">{{ fmt(e.balance_after) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="glTotalPages > 1" class="ar-pagination">
              <button class="ar-page-btn" :disabled="glPage <= 1" @click="glPage--">‹ Prev</button>
              <span class="ar-page-info">Page {{ glPage }} / {{ glTotalPages }}</span>
              <button class="ar-page-btn" :disabled="glPage >= glTotalPages" @click="glPage++">Next ›</button>
            </div>
          </template>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             DAILY LEDGER
        ══════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'ledgers' && activeSub === 'daily'">
          <div class="ar-report-header">
            <div>
              <h3>Daily Ledger</h3>
              <p class="ar-report-meta">{{ dlDate }} · {{ dlRows.length }} entries</p>
            </div>
            <div class="ar-header-actions">
              <BaseButton variant="secondary" size="sm" @click="rcModalOpen = true">＋ Record Reconciliation</BaseButton>
              <input type="date" class="ar-date-input" v-model="dlDate" @change="loadDailyLedger" />
              <BaseButton variant="secondary" size="sm" @click="loadDailyLedger" :disabled="dlLoading">↻</BaseButton>
            </div>
          </div>

          <p v-if="dlError" class="ar-error">{{ dlError }}</p>
          <p v-if="dlLoading" class="ar-loading">Loading daily ledger…</p>

          <template v-else>
            <div class="ar-summary-cards">
              <div class="ar-summary-card ar-summary-card--green">
                <span>Day Debits</span><strong>{{ fmt(dlTotalDebit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--red">
                <span>Day Credits</span><strong>{{ fmt(dlTotalCredit) }}</strong>
              </div>
              <div class="ar-summary-card ar-summary-card--blue">
                <span>Entries</span><strong>{{ dlRows.length }}</strong>
              </div>
            </div>

            <div class="module-table-wrap" style="margin-top:16px">
              <table class="module-table">
                <thead><tr><th>Time</th><th>Vault</th><th>Currency</th><th>Reference</th><th>Notes</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance After</th></tr></thead>
                <tbody>
                  <tr v-if="!dlRows.length"><td colspan="8" class="ar-empty-row">No ledger entries for {{ dlDate }}.</td></tr>
                  <tr v-for="e in dlRows" :key="e.id">
                    <td>{{ fmtDateTime(e.created_at) }}</td>
                    <td>{{ e.vault_name ?? e.vault_code ?? e.vault_id?.slice(0,8) }}</td>
                    <td>{{ e.currency_code ?? '—' }}</td>
                    <td><span v-if="e.reference_type" class="ar-badge ar-badge--grey">{{ e.reference_type.replace(/_/g, ' ') }}</span><span v-else>—</span></td>
                    <td class="ar-notes-cell">{{ e.notes ?? '—' }}</td>
                    <td style="text-align:right;color:#168a7b;font-weight:600">{{ e.entry_type === 'DEBIT'  ? fmt(e.amount) : '' }}</td>
                    <td style="text-align:right;color:#c0392b;font-weight:600">{{ e.entry_type === 'CREDIT' ? fmt(e.amount) : '' }}</td>
                    <td style="text-align:right;font-weight:700">{{ fmt(e.balance_after) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             SUMMARY REPORT
        ══════════════════════════════════════════════════════════════════ -->
        <div v-else-if="activeTop === 'other' && activeSub === 'summary'">
          <div class="ar-report-header">
            <div>
              <h3>Summary Report</h3>
              <p class="ar-report-meta">From {{ smFrom }} to {{ smTo }}</p>
            </div>
            <div class="ar-header-actions">
              <BaseButton variant="secondary" size="sm" @click="rcModalOpen = true">＋ Reconciliation</BaseButton>
              <input type="date" class="ar-date-input" v-model="smFrom" @change="loadSummary" />
              <span class="ar-filter-sep">→</span>
              <input type="date" class="ar-date-input" v-model="smTo"   @change="loadSummary" />
              <BaseButton variant="secondary" size="sm" @click="loadSummary" :disabled="smLoading">↻</BaseButton>
            </div>
          </div>

          <p v-if="smError" class="ar-error">{{ smError }}</p>
          <p v-if="smLoading" class="ar-loading">Loading summary…</p>

          <template v-else>
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
              <div class="ar-summary-card" :class="smVariance > 0 ? 'ar-summary-card--red' : 'ar-summary-card--green'">
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

            <h4 class="ar-section-title">Transactions by Status</h4>
            <div class="module-table-wrap">
              <table class="module-table">
                <thead><tr><th>Status</th><th style="text-align:right">Count</th><th style="text-align:right">ETB Volume</th></tr></thead>
                <tbody>
                  <tr v-for="st in ['APPROVED','PENDING','REJECTED','REVERSED']" :key="st">
                    <td><span class="ar-badge" :class="{ 'ar-badge--green': st==='APPROVED', 'ar-badge--yellow': st==='PENDING', 'ar-badge--red': st==='REJECTED'||st==='REVERSED' }">{{ st }}</span></td>
                    <td style="text-align:right">{{ smTrades.filter(t => t.status === st).length }}</td>
                    <td style="text-align:right;font-weight:700">ETB {{ fmt(smTrades.filter(t => t.status === st).reduce((s,t) => s + Number(t.total_amount_etb ?? t.total_amount ?? 0), 0)) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 class="ar-section-title" style="margin-top:24px">Reconciliation Records</h4>
            <div class="module-table-wrap">
              <table class="module-table">
                <thead><tr><th>Date</th><th>Vault</th><th>Currency</th><th style="text-align:right">Expected</th><th style="text-align:right">Physical Count</th><th style="text-align:right">Variance</th><th>Status</th></tr></thead>
                <tbody>
                  <tr v-if="!smReconcile.length"><td colspan="7" class="ar-empty-row">No reconciliation records found.</td></tr>
                  <tr v-for="r in smReconcile" :key="r.id">
                    <td>{{ fmtDate(r.business_date) }}</td>
                    <td>{{ r.vault_name ?? r.vault_code ?? '—' }}</td>
                    <td>{{ r.currency_code ?? '—' }}</td>
                    <td style="text-align:right">{{ fmt(r.expected_system_balance) }}</td>
                    <td style="text-align:right">{{ fmt(r.counted_physical_amount) }}</td>
                    <td style="text-align:right;font-weight:700" :style="{ color: Number(r.variance_amount) === 0 ? '#168a7b' : '#c0392b' }">{{ fmt(r.variance_amount) }}</td>
                    <td><span class="ar-badge" :class="r.status === 'MATCHED' ? 'ar-badge--green' : 'ar-badge--red'">{{ r.status }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             TRANSACTION REPORTS
        ══════════════════════════════════════════════════════════════════ -->
        <TradeReportView v-else-if="activeTop === 'transactions' && activeSub === 'buy'"  transaction-type="BUY" />
        <TradeReportView v-else-if="activeTop === 'transactions' && activeSub === 'sell'" transaction-type="SELL" />

      </div>
    </div><!-- /ar-body -->

    <!-- ════════════════════════════════════════════════════════════════════════
         MODALS
    ════════════════════════════════════════════════════════════════════════ -->

    <!-- Create Bank Account -->
    <BaseModal v-model="baBankModalOpen" title="Add Bank Account" size="md">
      <form class="ar-form" @submit.prevent="saveBankAccount">
        <div class="ar-field ar-field--full">
          <label>Bank <span class="ar-req">*</span></label>
          <select v-model="baBankForm.bank_id" required>
            <option value="">Select bank…</option>
            <option v-for="b in refBanks" :key="b.id" :value="b.id">{{ b.bank_name ?? b.name }}</option>
          </select>
        </div>
        <div class="ar-field">
          <label>Account Number <span class="ar-req">*</span></label>
          <input v-model="baBankForm.account_number" placeholder="e.g. 1000347815" required />
        </div>
        <div class="ar-field">
          <label>Account Name <span class="ar-req">*</span></label>
          <input v-model="baBankForm.account_name" placeholder="e.g. FOREX Bureau – Head Office" required />
        </div>
        <div class="ar-field">
          <label>Currency</label>
          <select v-model="baBankForm.currency_id">
            <option value="">ETB (default)</option>
            <option v-for="c in refCurrencies" :key="c.id" :value="c.id">{{ c.code }} – {{ c.name }}</option>
          </select>
        </div>
        <div class="ar-field ar-field--full">
          <label>Notes</label>
          <textarea v-model="baBankForm.notes" rows="2" placeholder="Optional notes…" />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="baBankModalOpen = false">Cancel</BaseButton>
          <BaseButton type="submit" :disabled="baBankSaving">{{ baBankSaving ? 'Saving…' : 'Create Account' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Deposit / Withdrawal -->
    <BaseModal v-model="txModalOpen" :title="txModalType === 'deposit' ? 'Record Deposit' : 'Record Withdrawal'" size="sm">
      <form class="ar-form" @submit.prevent="saveTx">
        <div class="ar-field ar-field--full">
          <label>Account</label>
          <input :value="txTargetLabel" disabled />
        </div>
        <div class="ar-field ar-field--full">
          <label>Amount <span class="ar-req">*</span></label>
          <input v-model="txForm.amount" type="number" min="0.0001" step="any" placeholder="e.g. 5000" required />
        </div>
        <div class="ar-field ar-field--full">
          <label>Description</label>
          <textarea v-model="txForm.description" rows="2" placeholder="Optional description…" />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="txModalOpen = false">Cancel</BaseButton>
          <BaseButton type="submit" :disabled="txSaving">{{ txSaving ? 'Saving…' : txModalType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Create Opening Balance -->
    <BaseModal v-model="obModalOpen" title="Create Opening Balance" size="md">
      <form class="ar-form" @submit.prevent="saveOpeningBalance">
        <div class="ar-field">
          <label>Vault <span class="ar-req">*</span></label>
          <select v-model="obForm.vault_id" required>
            <option value="">Select vault…</option>
            <option v-for="v in refVaults" :key="v.id" :value="v.id">{{ v.vault_name }} ({{ v.vault_code }})</option>
          </select>
        </div>
        <div class="ar-field">
          <label>Currency <span class="ar-req">*</span></label>
          <select v-model="obForm.currency_id" required>
            <option value="">Select currency…</option>
            <option v-for="c in refCurrencies" :key="c.id" :value="c.id">{{ c.code }} – {{ c.name }}</option>
          </select>
        </div>
        <div class="ar-field ar-field--full">
          <label>Opening Balance <span class="ar-req">*</span></label>
          <input v-model="obForm.opening_balance" type="number" min="0.0001" step="any" placeholder="e.g. 25000" required />
        </div>
        <div class="ar-field ar-field--full">
          <label>Notes</label>
          <textarea v-model="obForm.notes" rows="2" placeholder="e.g. Initial teller cash handover" />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="obModalOpen = false">Cancel</BaseButton>
          <BaseButton type="submit" :disabled="obSaving">{{ obSaving ? 'Saving…' : 'Create Opening Balance' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Initiate Cash Transfer -->
    <BaseModal v-model="cfModalOpen" title="Initiate Cash Transfer" size="lg">
      <form class="ar-form" @submit.prevent="saveTransfer">
        <div class="ar-field">
          <label>Source Vault <span class="ar-req">*</span></label>
          <select v-model="cfForm.source_vault_id" required>
            <option value="">Select source vault…</option>
            <option v-for="v in refVaults" :key="v.id" :value="v.id">{{ v.vault_name }} ({{ v.vault_code }})</option>
          </select>
        </div>
        <div class="ar-field">
          <label>Destination Vault <span class="ar-req">*</span></label>
          <select v-model="cfForm.dest_vault_id" required>
            <option value="">Select destination vault…</option>
            <option v-for="v in refVaults" :key="v.id" :value="v.id">{{ v.vault_name }} ({{ v.vault_code }})</option>
          </select>
        </div>
        <div class="ar-field">
          <label>Currency <span class="ar-req">*</span></label>
          <select v-model="cfForm.currency_id" required>
            <option value="">Select currency…</option>
            <option v-for="c in refCurrencies" :key="c.id" :value="c.id">{{ c.code }} – {{ c.name }}</option>
          </select>
        </div>
        <div class="ar-field">
          <label>Transfer Type <span class="ar-req">*</span></label>
          <select v-model="cfForm.transfer_type" required>
            <option v-for="t in TRANSFER_TYPES" :key="t" :value="t">{{ t.replace(/_/g, ' ') }}</option>
          </select>
        </div>
        <div class="ar-field">
          <label>Amount <span class="ar-req">*</span></label>
          <input v-model="cfForm.initiated_amount" type="number" min="0.0001" step="any" placeholder="e.g. 10000" required />
        </div>
        <div class="ar-field">
          <label>Tolerance</label>
          <input v-model="cfForm.tolerance_amount" type="number" min="0" step="any" placeholder="e.g. 10 (optional)" />
        </div>
        <div class="ar-field ar-field--full">
          <label>Remarks</label>
          <textarea v-model="cfForm.remarks" rows="2" placeholder="Optional remarks…" />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="cfModalOpen = false">Cancel</BaseButton>
          <BaseButton type="submit" :disabled="cfSaving">{{ cfSaving ? 'Saving…' : 'Initiate Transfer' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Receive Transfer -->
    <BaseModal v-model="rcvModalOpen" title="Receive Transfer" size="sm">
      <form class="ar-form" @submit.prevent="saveReceive">
        <div class="ar-field ar-field--full" v-if="rcvTarget">
          <label>Transfer</label>
          <input :value="`${rcvTarget.transfer_ref ?? rcvTarget.id?.slice(0,8)} — ${rcvTarget.currency_code} ${fmt(rcvTarget.initiated_amount)}`" disabled />
        </div>
        <div class="ar-field ar-field--full">
          <label>Received Amount <span class="ar-req">*</span></label>
          <input v-model="rcvForm.received_amount" type="number" min="0" step="any" required />
        </div>
        <div class="ar-field ar-field--full">
          <label>Receipt Notes</label>
          <textarea v-model="rcvForm.receipt_notes" rows="2" />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="rcvModalOpen = false">Cancel</BaseButton>
          <BaseButton type="submit" :disabled="rcvSaving">{{ rcvSaving ? 'Saving…' : 'Confirm Receive' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Reject Transfer -->
    <BaseModal v-model="rjTxModalOpen" title="Reject Transfer" size="sm">
      <form class="ar-form" @submit.prevent="saveRejectTx">
        <div class="ar-field ar-field--full">
          <label>Reason <span class="ar-req">*</span></label>
          <textarea v-model="rjTxReason" rows="4" placeholder="Provide a clear reason for rejecting this transfer…" required />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="rjTxModalOpen = false">Cancel</BaseButton>
          <BaseButton variant="danger" type="submit" :disabled="rjTxSaving">{{ rjTxSaving ? 'Saving…' : 'Confirm Reject' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Create Daily Reconciliation -->
    <BaseModal v-model="rcModalOpen" title="Record Daily Reconciliation" size="md">
      <form class="ar-form" @submit.prevent="saveReconciliation">
        <div class="ar-field">
          <label>Vault <span class="ar-req">*</span></label>
          <select v-model="rcForm.vault_id" required>
            <option value="">Select vault…</option>
            <option v-for="v in refVaults" :key="v.id" :value="v.id">{{ v.vault_name }} ({{ v.vault_code }})</option>
          </select>
        </div>
        <div class="ar-field">
          <label>Currency <span class="ar-req">*</span></label>
          <select v-model="rcForm.currency_id" required>
            <option value="">Select currency…</option>
            <option v-for="c in refCurrencies" :key="c.id" :value="c.id">{{ c.code }} – {{ c.name }}</option>
          </select>
        </div>
        <div class="ar-field">
          <label>Business Date <span class="ar-req">*</span></label>
          <input v-model="rcForm.business_date" type="date" required />
        </div>
        <div class="ar-field">
          <label>Counted Physical Amount <span class="ar-req">*</span></label>
          <input v-model="rcForm.counted_physical_amount" type="number" min="0" step="any" placeholder="e.g. 22450" required />
        </div>
        <div class="ar-field ar-field--full">
          <label>Notes</label>
          <textarea v-model="rcForm.notes" rows="2" placeholder="e.g. End-of-day teller cash count" />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="rcModalOpen = false">Cancel</BaseButton>
          <BaseButton type="submit" :disabled="rcSaving">{{ rcSaving ? 'Saving…' : 'Submit Reconciliation' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Accept Opening Balance -->
    <BaseModal v-model="acModalOpen" title="Accept Opening Balance" size="sm">
      <form class="ar-form" @submit.prevent="saveAccept">
        <div class="ar-field ar-field--full">
          <label>Counted Amount <span class="ar-req">*</span></label>
          <input v-model="acCountedAmt" type="number" min="0.0001" step="any" required />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="acModalOpen = false">Cancel</BaseButton>
          <BaseButton type="submit" :disabled="acSaving">{{ acSaving ? 'Saving…' : 'Confirm Accept' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Reject Opening Balance -->
    <BaseModal v-model="rjObModalOpen" title="Reject Opening Balance" size="sm">
      <form class="ar-form" @submit.prevent="saveRejectOb">
        <div class="ar-field ar-field--full">
          <label>Reason <span class="ar-req">*</span></label>
          <textarea v-model="rjObReason" rows="4" placeholder="Provide a clear reason…" required />
        </div>
        <div class="ar-form-footer">
          <BaseButton variant="secondary" type="button" @click="rjObModalOpen = false">Cancel</BaseButton>
          <BaseButton variant="danger" type="submit" :disabled="rjObSaving">{{ rjObSaving ? 'Saving…' : 'Confirm Reject' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

  </div>
</template>

<style scoped>
.ar-page { max-width: 1400px; }
.ar-subtitle { margin: 6px 0 0; color: #77879b; font-size: 12px; }

/* top tabs */
.ar-top-tabs {
  display: flex;
  border-bottom: 2px solid var(--border-color, #e1e7ef);
  margin-bottom: 20px;
}
.ar-top-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 11px 20px; border: 0; background: transparent;
  font: inherit; font-size: 14px; font-weight: 600;
  color: var(--muted, #718096);
  cursor: pointer; position: relative; white-space: nowrap; transition: color .15s;
}
.ar-top-tab:hover { color: var(--ink, #172536); }
.ar-top-tab.active { color: #168a7b; font-weight: 750; }
.ar-top-tab.active::after {
  content: ''; position: absolute; bottom: -2px; left: 0; right: 0;
  height: 2px; background: #168a7b; border-radius: 2px 2px 0 0;
}

/* layout */
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
.ar-report-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 10px; margin-bottom: 16px;
}
.ar-report-header h3 { font-size: 22px; margin: 0 0 4px; color: var(--ink, #172536); }
.ar-report-meta { font-size: 12px; color: var(--muted, #718096); margin: 0; }
.ar-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* filter row */
.ar-date-input {
  padding: 6px 10px; border: 1px solid var(--border-color, #d8e0eb);
  border-radius: 7px; font: inherit; font-size: 13px;
  background: var(--surface, #fff); color: var(--ink, #172536);
}
.ar-filter-sep { color: var(--muted, #718096); font-size: 12px; }

/* summary cards */
.ar-summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 8px; }
.ar-summary-cards--4 { grid-template-columns: repeat(4, 1fr); }
.ar-summary-card { padding: 16px 18px; border-radius: 10px; border: 1px solid var(--border-color, #e1e7ef); }
.ar-summary-card span   { display: block; font-size: 12px; color: var(--muted, #718096); margin-bottom: 6px; }
.ar-summary-card strong { display: block; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.ar-summary-card small  { display: block; font-size: 11px; color: var(--muted, #718096); margin-top: 4px; }
.ar-summary-card--green  { background: #f0faf5; border-color: #b7e4cd; }
.ar-summary-card--green strong { color: #168a7b; }
.ar-summary-card--red    { background: #fff5f5; border-color: #f5c6c6; }
.ar-summary-card--red   strong { color: #c0392b; }
.ar-summary-card--blue   { background: #eaf2ff; border-color: #bcd5f8; }
.ar-summary-card--blue  strong { color: #1769d2; }

/* table helpers */
.ar-group-row { background: #f0f4f8; font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: #3a5068; padding: 8px 16px; }
.ar-empty-row { text-align: center; color: var(--muted, #718096); font-size: 12px; padding: 20px; }
.ar-notes-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ar-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.ar-muted-sm { font-size: 12px; color: var(--muted, #718096); }

/* badges */
.ar-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; background: #edf2f7; color: #4a5568; }
.ar-badge--green  { background: #e6f9f1; color: #1a7a56; }
.ar-badge--yellow { background: #fff8e1; color: #b26b00; }
.ar-badge--red    { background: #fff0f0; color: #c0392b; }
.ar-badge--blue   { background: #eaf2ff; color: #1769d2; }
.ar-badge--teal   { background: #e0f7fa; color: #006064; }
.ar-badge--grey   { background: #f0f4f8; color: #4a5568; }

/* section title */
.ar-section-title { font-size: 14px; font-weight: 700; color: var(--ink, #172536); margin: 20px 0 10px; border-left: 3px solid #168a7b; padding-left: 10px; }

/* pagination */
.ar-pagination { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 16px; }
.ar-page-btn { padding: 6px 16px; border-radius: 7px; border: 1px solid var(--border-color, #d8e0eb); background: var(--surface, #fff); font: inherit; font-size: 13px; cursor: pointer; transition: background .15s; }
.ar-page-btn:hover:not(:disabled) { background: #e8f7f0; }
.ar-page-btn:disabled { opacity: .4; cursor: default; }
.ar-page-info { font-size: 13px; color: var(--muted, #718096); }

/* loading / error */
.ar-loading { padding: 40px; text-align: center; color: var(--muted, #718096); font-size: 13px; background: var(--surface-muted, #f8fafc); border-radius: 10px; border: 1px dashed var(--border-color, #dbe2ea); }
.ar-error { margin-bottom: 12px; padding: 12px 16px; border-radius: 8px; background: #fff0f0; border: 1px solid #f5c6c6; color: #c0392b; font-size: 13px; }

/* ── modal forms ──────────────────────────────────────────────────────────── */
.ar-form {
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.ar-field {
  display: flex; flex-direction: column; gap: 6px;
}
.ar-field--full { grid-column: 1 / -1; }
.ar-field label { font-size: 13px; font-weight: 600; color: var(--ink, #172536); }
.ar-field input,
.ar-field select,
.ar-field textarea {
  padding: 9px 11px;
  border: 1px solid var(--border-color, #dce5ee);
  border-radius: 8px;
  background: var(--surface, #fff);
  font: inherit; font-size: 13px;
  box-sizing: border-box; width: 100%;
  color: var(--ink, #172536);
  transition: border-color .15s;
}
.ar-field input:focus,
.ar-field select:focus,
.ar-field textarea:focus { outline: none; border-color: #168a7b; }
.ar-field input:disabled,
.ar-field select:disabled { background: #f5f7fa; color: #718096; cursor: default; }
.ar-field textarea { resize: vertical; min-height: 68px; }
.ar-req { color: #c0392b; }
.ar-form-footer {
  grid-column: 1 / -1;
  display: flex; justify-content: flex-end; gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--border-color, #e8edf3);
  margin-top: 4px;
}

/* responsive */
@media (max-width: 1024px) { .ar-summary-cards--4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 860px) {
  .ar-body { grid-template-columns: 1fr; }
  .ar-subnav { flex-direction: row; flex-wrap: wrap; }
  .ar-summary-cards, .ar-summary-cards--4 { grid-template-columns: 1fr; }
  .ar-top-tabs { overflow-x: auto; }
  .ar-form { grid-template-columns: 1fr; }
}
</style>

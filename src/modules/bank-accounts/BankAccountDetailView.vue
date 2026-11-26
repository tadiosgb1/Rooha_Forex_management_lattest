<script setup>
/**
 * BankAccountDetailView
 * Account details + ledger + deposit + withdrawal
 * GET  /bank-accounts/:id
 * GET  /bank-accounts/:id/transactions
 * POST /bank-accounts/:id/deposits
 * POST /bank-accounts/:id/withdrawals
 * POST /bank-accounts/transactions/:txId/approve
 * POST /bank-accounts/transactions/:txId/reject
 */
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bankAccountService } from '../../services/bankAccountService'
import { useToast } from '../../composables/toast'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'

const route  = useRoute()
const router = useRouter()
const toast  = useToast()
const id     = computed(() => route.params.id)

const account     = ref(null)
const ledger      = ref([])
const ledgerTotal = ref(0)
const ledgerPage  = ref(1)
const ledgerLimit = ref(20)
const loading     = ref(false)
const ledgerLoading = ref(false)
const error       = ref('')

// modals
const depositModal   = ref(false)
const withdrawModal  = ref(false)
const rejectModal    = ref(false)
const saving         = ref(false)
const depositAmount  = ref('')
const depositDesc    = ref('')
const withdrawAmount = ref('')
const withdrawDesc   = ref('')
const rejectTxId     = ref('')
const rejectReason   = ref('')

function normalizeList(r) {
  if (Array.isArray(r))             return r
  if (Array.isArray(r?.data))       return r.data
  if (Array.isArray(r?.data?.items))return r.data.items
  return []
}
function normalizeTotal(r) { return r?.total ?? r?.count ?? normalizeList(r).length }

function fmt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}
function typeTone(t) {
  return String(t).toUpperCase() === 'CREDIT' ? 'success' : 'warning'
}
function statusTone(s) {
  const v = String(s ?? '').toUpperCase()
  if (v === 'APPROVED') return 'success'
  if (v === 'REJECTED') return 'danger'
  return 'warning'
}
const totalPages = computed(() => Math.max(1, Math.ceil(ledgerTotal.value / ledgerLimit.value)))

async function loadAccount() {
  loading.value = true; error.value = ''
  try { account.value = (await bankAccountService.get(id.value))?.data ?? await bankAccountService.get(id.value) }
  catch (e) { error.value = e?.message || 'Could not load account.' }
  finally { loading.value = false }
}

async function loadLedger() {
  ledgerLoading.value = true
  try {
    const res = await bankAccountService.transactions(id.value, { page: ledgerPage.value, limit: ledgerLimit.value })
    ledger.value = normalizeList(res)
    ledgerTotal.value = normalizeTotal(res)
  } catch (e) { ledger.value = [] }
  finally { ledgerLoading.value = false }
}

async function submitDeposit() {
  if (!depositAmount.value || Number(depositAmount.value) <= 0) return
  saving.value = true
  try {
    await bankAccountService.deposit(id.value, { amount: Number(depositAmount.value), description: depositDesc.value.trim() || undefined })
    toast.success('Deposit submitted successfully.')
    depositModal.value = false; depositAmount.value = ''; depositDesc.value = ''
    await Promise.all([loadAccount(), loadLedger()])
  } catch (e) { toast.error(e?.message || 'Deposit failed.') }
  finally { saving.value = false }
}

async function submitWithdraw() {
  if (!withdrawAmount.value || Number(withdrawAmount.value) <= 0) return
  saving.value = true
  try {
    await bankAccountService.withdraw(id.value, { amount: Number(withdrawAmount.value), description: withdrawDesc.value.trim() || undefined })
    toast.success('Withdrawal submitted successfully.')
    withdrawModal.value = false; withdrawAmount.value = ''; withdrawDesc.value = ''
    await Promise.all([loadAccount(), loadLedger()])
  } catch (e) { toast.error(e?.message || 'Withdrawal failed.') }
  finally { saving.value = false }
}

async function approveEntry(txId) {
  saving.value = true
  try {
    await bankAccountService.approveTransaction(txId)
    toast.success('Entry approved.')
    await Promise.all([loadAccount(), loadLedger()])
  } catch (e) { toast.error(e?.message || 'Approve failed.') }
  finally { saving.value = false }
}

function openReject(txId) { rejectTxId.value = txId; rejectReason.value = ''; rejectModal.value = true }

async function submitReject() {
  if (!rejectReason.value.trim()) return
  saving.value = true
  try {
    await bankAccountService.rejectTransaction(rejectTxId.value, rejectReason.value.trim())
    toast.success('Entry rejected.')
    rejectModal.value = false
    await loadLedger()
  } catch (e) { toast.error(e?.message || 'Reject failed.') }
  finally { saving.value = false }
}

onMounted(() => { loadAccount(); loadLedger() })
</script>

<template>
  <section class="module-page">

    <div class="module-page-intro">
      <div>
        <BaseButton variant="secondary" size="sm" @click="router.push('/bank-accounts')" style="margin-bottom:8px">← Back</BaseButton>
        <h2 v-if="account">{{ account.account_name }}</h2>
        <h2 v-else>Bank Account</h2>
        <p class="ba-subtitle" v-if="account">{{ account.bank?.bank_name ?? '—' }} · {{ account.account_number }}</p>
      </div>
      <div style="display:flex;gap:8px" v-if="account">
        <BaseButton variant="secondary" @click="depositModal = true">+ Deposit</BaseButton>
        <BaseButton variant="secondary" @click="withdrawModal = true">− Withdraw</BaseButton>
      </div>
    </div>

    <p v-if="loading" class="module-empty-state">Loading account…</p>
    <p v-else-if="error" class="ba-error">{{ error }}</p>

    <template v-else-if="account">
      <!-- account meta -->
      <div class="ba-meta-bar">
        <div class="ba-meta-item"><span>Current Balance</span><strong class="ba-balance">{{ fmt(account.current_balance) }} {{ account.currency ?? 'ETB' }}</strong></div>
        <div class="ba-meta-item"><span>Bank</span><strong>{{ account.bank?.bank_name ?? '—' }}</strong></div>
        <div class="ba-meta-item"><span>Account Number</span><strong>{{ account.account_number }}</strong></div>
        <div class="ba-meta-item"><span>Currency</span><strong>{{ account.currency ?? 'ETB' }}</strong></div>
        <div class="ba-meta-item"><span>Status</span><BaseBadge :tone="account.is_active !== false ? 'success' : 'neutral'">{{ account.is_active !== false ? 'Active' : 'Inactive' }}</BaseBadge></div>
      </div>

      <!-- ledger -->
      <BaseCard as="section" class="module-panel">
        <div class="module-panel-header">
          <h3>Transaction Ledger</h3>
          <p>Every deposit and withdrawal with balance before and after.</p>
          <BaseButton variant="secondary" size="sm" :disabled="ledgerLoading" @click="loadLedger">Refresh</BaseButton>
        </div>

        <p v-if="ledgerLoading" class="module-empty-state">Loading ledger…</p>
        <p v-else-if="!ledger.length" class="module-empty-state">No transactions found for this account.</p>

        <div v-else class="module-table-wrap">
          <table class="module-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance before</th>
                <th>Balance after</th>
                <th>Description</th>
                <th>Status</th>
                <th data-no-sort>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in ledger" :key="tx.id">
                <td style="white-space:nowrap;font-size:12px">{{ fmtDate(tx.created_at) }}</td>
                <td><BaseBadge :tone="typeTone(tx.transaction_type)">{{ tx.transaction_type }}</BaseBadge></td>
                <td><strong :style="{ color: tx.transaction_type === 'CREDIT' ? '#168a7b' : '#b26b00' }">{{ fmt(tx.amount) }}</strong></td>
                <td><span class="ba-bal-pill ba-bal-before">{{ fmt(tx.balance_before) }}</span></td>
                <td><span class="ba-bal-pill ba-bal-after">{{ fmt(tx.balance_after) }}</span></td>
                <td style="font-size:12px;color:#718096">{{ tx.description ?? '—' }}</td>
                <td><BaseBadge :tone="statusTone(tx.status ?? 'APPROVED')">{{ tx.status ?? 'APPROVED' }}</BaseBadge></td>
                <td>
                  <div style="display:flex;gap:5px">
                    <button v-if="tx.status === 'PENDING'" class="ba-action ba-action--approve" @click="approveEntry(tx.id)">Approve</button>
                    <button v-if="tx.status === 'PENDING'" class="ba-action ba-action--reject"  @click="openReject(tx.id)">Reject</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="module-table-footer">
          <span>{{ ledger.length }} of {{ ledgerTotal }} entries</span>
          <div style="display:flex;gap:8px;align-items:center">
            <BaseButton variant="secondary" size="sm" :disabled="ledgerPage <= 1" @click="ledgerPage--; loadLedger()">← Prev</BaseButton>
            <span>{{ ledgerPage }} / {{ totalPages }}</span>
            <BaseButton variant="secondary" size="sm" :disabled="ledgerPage >= totalPages" @click="ledgerPage++; loadLedger()">Next →</BaseButton>
          </div>
        </div>
      </BaseCard>
    </template>

    <!-- deposit modal -->
    <Teleport to="body">
      <div v-if="depositModal" class="ba-modal-backdrop" @click.self="depositModal = false">
        <div class="ba-modal">
          <h3>Record Deposit</h3>
          <div class="ba-field"><label>Amount (ETB) *</label><input v-model="depositAmount" class="ba-input" type="number" min="0.01" step="any" placeholder="0.00" /></div>
          <div class="ba-field"><label>Description</label><input v-model="depositDesc" class="ba-input" placeholder="e.g. Opening deposit" /></div>
          <div class="ba-modal-actions">
            <BaseButton variant="secondary" @click="depositModal = false">Cancel</BaseButton>
            <BaseButton :disabled="saving || !depositAmount" @click="submitDeposit">{{ saving ? 'Submitting…' : 'Submit Deposit' }}</BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- withdrawal modal -->
    <Teleport to="body">
      <div v-if="withdrawModal" class="ba-modal-backdrop" @click.self="withdrawModal = false">
        <div class="ba-modal">
          <h3>Record Withdrawal</h3>
          <div class="ba-field"><label>Amount (ETB) *</label><input v-model="withdrawAmount" class="ba-input" type="number" min="0.01" step="any" placeholder="0.00" /></div>
          <div class="ba-field"><label>Description</label><input v-model="withdrawDesc" class="ba-input" placeholder="e.g. Bank charges" /></div>
          <div class="ba-modal-actions">
            <BaseButton variant="secondary" @click="withdrawModal = false">Cancel</BaseButton>
            <BaseButton variant="danger" :disabled="saving || !withdrawAmount" @click="submitWithdraw">{{ saving ? 'Submitting…' : 'Submit Withdrawal' }}</BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- reject modal -->
    <Teleport to="body">
      <div v-if="rejectModal" class="ba-modal-backdrop" @click.self="rejectModal = false">
        <div class="ba-modal">
          <h3>Reject Entry</h3>
          <div class="ba-field"><label>Reason *</label><textarea v-model="rejectReason" class="ba-input" rows="3" placeholder="Provide a clear reason…"></textarea></div>
          <div class="ba-modal-actions">
            <BaseButton variant="secondary" @click="rejectModal = false">Cancel</BaseButton>
            <BaseButton variant="danger" :disabled="saving || !rejectReason.trim()" @click="submitReject">{{ saving ? 'Submitting…' : 'Confirm Reject' }}</BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

  </section>
</template>

<style scoped>
.ba-subtitle { margin: 4px 0 0; color: #77879b; font-size: 12px; }
.ba-error { padding: 10px 16px; background: #fff0ef; color: #a52c28; border-radius: 8px; font-size: 13px; }
.ba-meta-bar { display: flex; gap: 0; border: 1px solid #e1e7ef; border-radius: 10px; overflow: hidden; margin-bottom: 20px; }
.ba-meta-item { flex: 1; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; background: #f8fafc; border-right: 1px solid #e1e7ef; }
.ba-meta-item:last-child { border-right: none; }
.ba-meta-item span { font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: #718096; }
.ba-meta-item strong { font-size: 14px; color: #172536; }
.ba-balance { font-size: 20px !important; color: #168a7b !important; }
.ba-bal-pill { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ba-bal-before { background: #f0f4f8; color: #3a5068; }
.ba-bal-after  { background: #e8f7f0; color: #145c3c; }
.ba-action { border: 0; background: transparent; font-size: 11px; font-weight: 700; padding: 5px 7px; cursor: pointer; }
.ba-action--approve { color: #167d72; }
.ba-action--reject  { color: #b43f4a; }
/* modal */
.ba-modal-backdrop { position: fixed; inset: 0; background: rgba(7,24,39,.55); display: grid; place-items: center; z-index: 50; padding: 20px; }
.ba-modal { background: #fff; border-radius: 14px; padding: 28px; width: min(440px, 100%); display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 50px rgba(0,0,0,.2); }
.ba-modal h3 { font-size: 18px; margin: 0; }
.ba-field { display: flex; flex-direction: column; gap: 6px; }
.ba-field label { font-size: 12px; font-weight: 700; color: #4b5f76; }
.ba-input { padding: 9px 11px; border: 1px solid #dce5ee; border-radius: 8px; font: inherit; font-size: 14px; background: #fff; color: #203750; width: 100%; box-sizing: border-box; }
.ba-input:focus { outline: none; border-color: #168a7b; }
.ba-modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
@media (max-width: 720px) { .ba-meta-bar { flex-direction: column; } .ba-meta-item { border-right: none; border-bottom: 1px solid #e1e7ef; } }
</style>

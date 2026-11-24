<script setup>
/**
 * VaultDashboardView
 *
 * GET /cash-management/vaults?vaultType=BRANCH_VAULT
 *   → Branch Vault card (1 card, the branch-level vault)
 *
 * GET /cash-management/vaults/my
 *   → Returns ALL vaults where assigned_user_id = logged-in user.
 *     A user can hold multiple assignments simultaneously:
 *       custodian_user_id set  → BRANCH_VAULT entry  (shown in "My Branch Vault" card)
 *       owner_user_id set      → TELLER_TILL entries  (shown as individual till cards)
 *
 * Example for user #2 (this session):
 *   - Branch Vault  (custodian_user_id: 2)
 *   - Kality_branch till (owner_user_id: 2)
 *   - tesfay005 till     (owner_user_id: 2)
 */
import { onMounted, ref, computed } from 'vue'
import { vaultDashboardService } from './service'
import VaultLedgerModal from './VaultLedgerModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'

// ─── state ────────────────────────────────────────────────────────────────────
const branchVault      = ref(null)
const branchBalances   = ref([])
const branchLoading    = ref(false)
const branchError      = ref('')

// My vaults — split by type after the single /vaults/my call
const myBranchVault    = ref(null)   // BRANCH_VAULT assigned to me (custodian)
const myTills          = ref([])     // TELLER_TILL(s) assigned to me (owner)
const myLoading        = ref(false)
const myError          = ref('')

const ledgerOpen       = ref(false)
const ledgerVault      = ref(null)

// ─── helpers ──────────────────────────────────────────────────────────────────
function normalizeList(r) {
  if (Array.isArray(r))              return r
  if (Array.isArray(r?.data))        return r.data
  if (Array.isArray(r?.data?.items)) return r.data.items
  if (Array.isArray(r?.items))       return r.items
  return []
}

function firstVault(r) {
  if (r && typeof r === 'object' && !Array.isArray(r) && r.id) return r
  if (r?.data && !Array.isArray(r.data) && r.data?.id)         return r.data
  return normalizeList(r)[0] ?? null
}

function fmt(val) {
  if (val === null || val === undefined || val === '') return '—'
  const n = Number(val)
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(val)
}

function statusTone(s) {
  const v = String(s ?? '').toUpperCase()
  if (v === 'ACTIVE')   return 'success'
  if (v === 'INACTIVE') return 'danger'
  if (v === 'PENDING')  return 'warning'
  return 'neutral'
}

// ─── load branch vault ────────────────────────────────────────────────────────
async function loadBranchVault() {
  branchLoading.value  = true
  branchError.value    = ''
  branchVault.value    = null
  branchBalances.value = []
  try {
    const res = await vaultDashboardService.getBranchVault()
    const v   = firstVault(res)
    branchVault.value    = v
    branchBalances.value = normalizeList(v?.balances)
  } catch (e) {
    branchError.value = e?.message || 'Could not load branch vault.'
  } finally {
    branchLoading.value = false
  }
}

// ─── load my vaults ───────────────────────────────────────────────────────────
// /vaults/my → all vaults where assigned_user_id = me
// Split into: myBranchVault (custodian role) + myTills (teller role)
async function loadMyVaults() {
  myLoading.value     = true
  myError.value       = ''
  myBranchVault.value = null
  myTills.value       = []
  try {
    const res  = await vaultDashboardService.getMyVault()
    const list = normalizeList(res?.data ?? res)
    myBranchVault.value = list.find(v => v.vault_type === 'BRANCH_VAULT') ?? null
    myTills.value       = list.filter(v => v.vault_type === 'TELLER_TILL')
  } catch (e) {
    myError.value = e?.message || 'Could not load your vaults.'
  } finally {
    myLoading.value = false
  }
}

// ─── open ledger ──────────────────────────────────────────────────────────────
function openLedger(vault) {
  ledgerVault.value = vault
  ledgerOpen.value  = true
}

// ─── computed ─────────────────────────────────────────────────────────────────
const branchVaultName = computed(() =>
  branchVault.value?.vault_name?.trim() || branchVault.value?.vault_code || 'Branch Vault'
)
// True when the branch vault card and my-branch-vault card point to the same record
const isSameVault = computed(() =>
  branchVault.value && myBranchVault.value &&
  branchVault.value.id === myBranchVault.value.id
)

// ─── mount ────────────────────────────────────────────────────────────────────
onMounted(() => {
  loadBranchVault()
  loadMyVaults()
})
</script>

<template>
  <section class="module-page vd-page">

    <!-- page header -->
    <div class="module-page-intro vd-intro">
      <div>
        <h2>My Vaults</h2>
        <p class="module-description">
          Live balances for your assigned vaults. Balances update through approved transfers,
          cash operations, and accepted opening balances only.
        </p>
      </div>
      <BaseButton variant="secondary" @click="loadBranchVault(); loadMyVaults()">
        ↺ Refresh
      </BaseButton>
    </div>

    <!-- ── Row 1: Branch Vault + My Branch Vault (if different) ─────────────── -->
    <div class="vd-grid" :class="{ 'vd-grid--single': isSameVault }">

      <!-- Branch Vault (branch-level, always shown) -->
      <div class="vd-card vd-card--branch" :class="{ 'vd-card--loading': branchLoading }">
        <div class="vd-card-header">
          <div class="vd-card-icon vd-card-icon--branch">🏦</div>
          <div class="vd-card-title">
            <span class="vd-label">Branch Vault</span>
            <strong>{{ branchLoading ? 'Loading…' : branchVaultName }}</strong>
          </div>
          <BaseBadge v-if="branchVault && !branchLoading" :tone="statusTone(branchVault.status)">
            {{ branchVault.status ?? 'UNKNOWN' }}
          </BaseBadge>
        </div>

        <div v-if="branchVault && !branchLoading" class="vd-meta">
          <span><em>Code</em> {{ branchVault.vault_code ?? '—' }}</span>
          <span><em>Type</em> BRANCH VAULT</span>
          <span v-if="isSameVault" class="vd-mine-chip">★ You are the custodian</span>
        </div>

        <p v-if="branchError" class="vd-error">{{ branchError }}</p>
        <div v-else-if="branchLoading" class="vd-skeleton-row">
          <div class="vd-skeleton" style="width:55%"></div>
          <div class="vd-skeleton" style="width:40%"></div>
          <div class="vd-skeleton" style="width:48%"></div>
        </div>
        <div v-else-if="!branchVault" class="vd-empty">No branch vault assigned to your branch.</div>

        <template v-else>
          <div v-if="branchBalances.length" class="vd-balances">
            <div v-for="b in branchBalances" :key="b.id ?? b.code" class="vd-balance-row">
              <span class="vd-currency-code">{{ b.code ?? '—' }}</span>
              <span class="vd-currency-name">{{ b.name ?? '' }}</span>
              <span class="vd-balance-amount">{{ fmt(b.current_balance ?? b.balance) }}</span>
            </div>
          </div>
          <p v-else class="vd-no-balances">No currency balances recorded yet.</p>
        </template>

        <div v-if="branchVault && !branchLoading" class="vd-actions">
          <BaseButton size="sm" @click="openLedger(branchVault)">📒 View Ledger</BaseButton>
          <BaseButton variant="secondary" size="sm" @click="loadBranchVault">Refresh</BaseButton>
        </div>
      </div>

      <!-- My Branch Vault (custodian role) — only shown if DIFFERENT from above -->
      <div
        v-if="myBranchVault && !isSameVault"
        class="vd-card vd-card--mine"
        :class="{ 'vd-card--loading': myLoading }"
      >
        <div class="vd-card-header">
          <div class="vd-card-icon vd-card-icon--mine">💼</div>
          <div class="vd-card-title">
            <span class="vd-label">My Branch Vault — Custodian</span>
            <strong>{{ myBranchVault.vault_name?.trim() || myBranchVault.vault_code }}</strong>
          </div>
          <BaseBadge :tone="statusTone(myBranchVault.status)">{{ myBranchVault.status }}</BaseBadge>
        </div>
        <div class="vd-meta">
          <span><em>Code</em> {{ myBranchVault.vault_code }}</span>
          <span><em>Role</em> Branch Custodian</span>
        </div>
        <div v-if="normalizeList(myBranchVault.balances).length" class="vd-balances">
          <div v-for="b in normalizeList(myBranchVault.balances)" :key="b.id ?? b.code" class="vd-balance-row">
            <span class="vd-currency-code">{{ b.code ?? '—' }}</span>
            <span class="vd-currency-name">{{ b.name ?? '' }}</span>
            <span class="vd-balance-amount">{{ fmt(b.current_balance ?? b.balance) }}</span>
          </div>
        </div>
        <p v-else class="vd-no-balances">No currency balances recorded yet.</p>
        <div class="vd-actions">
          <BaseButton size="sm" @click="openLedger(myBranchVault)">📒 View Ledger</BaseButton>
        </div>
      </div>

    </div><!-- /vd-grid -->

    <!-- ── Row 2: My Teller Tills ────────────────────────────────────────────── -->
    <div v-if="myLoading || myTills.length" class="vd-section">
      <div class="vd-section-header">
        <div>
          <h3>🧾 My Teller Tills</h3>
          <p>Teller tills assigned to your account.</p>
        </div>
        <BaseButton variant="secondary" size="sm" :disabled="myLoading" @click="loadMyVaults">
          {{ myLoading ? 'Loading…' : '↺ Refresh' }}
        </BaseButton>
      </div>

      <p v-if="myError" class="vd-error">{{ myError }}</p>

      <!-- skeleton -->
      <div v-else-if="myLoading" class="vd-tills-grid">
        <div v-for="n in 2" :key="n" class="vd-card">
          <div class="vd-skeleton-row">
            <div class="vd-skeleton" style="width:60%"></div>
            <div class="vd-skeleton" style="width:40%"></div>
          </div>
        </div>
      </div>

      <!-- tills -->
      <div v-else class="vd-tills-grid">
        <div v-for="till in myTills" :key="till.id" class="vd-card vd-card--till">
          <div class="vd-card-header">
            <div class="vd-card-icon vd-card-icon--till">🧾</div>
            <div class="vd-card-title">
              <span class="vd-label">My Teller Till</span>
              <strong>{{ till.vault_name?.trim() || till.vault_code }}</strong>
            </div>
            <BaseBadge :tone="statusTone(till.status)">{{ till.status ?? 'UNKNOWN' }}</BaseBadge>
          </div>
          <div class="vd-meta">
            <span><em>Code</em> {{ till.vault_code }}</span>
            <span><em>Role</em> Teller (Owner)</span>
          </div>
          <div v-if="normalizeList(till.balances).length" class="vd-balances">
            <div v-for="b in normalizeList(till.balances)" :key="b.id ?? b.code" class="vd-balance-row">
              <span class="vd-currency-code">{{ b.code ?? '—' }}</span>
              <span class="vd-currency-name">{{ b.name ?? '' }}</span>
              <span class="vd-balance-amount">{{ fmt(b.current_balance ?? b.balance) }}</span>
            </div>
          </div>
          <p v-else class="vd-no-balances">No balances yet.</p>
          <div class="vd-actions">
            <BaseButton size="sm" @click="openLedger(till)">📒 View Ledger</BaseButton>
          </div>
        </div>
      </div>
    </div>

    <!-- ledger info banner -->
    <div class="vd-ledger-info">
      <span>ℹ️</span>
      <div>
        <strong>Ledger verification</strong>
        <p>
          Every ledger entry carries a <code>balance_before</code> and <code>balance_after</code>.
          Use the ledger to confirm that both sides of any transfer were posted exactly once.
          Your transfer response confirms <strong>RECEIVED</strong>; the ledger confirms the accounting entries.
        </p>
      </div>
    </div>

    <VaultLedgerModal v-model="ledgerOpen" :vault="ledgerVault" />

  </section>
</template>

<style scoped>
.vd-page { max-width: 1100px; }
.vd-intro { margin-bottom: 24px; align-items: flex-start; }

/* ── grids ───────────────────────────────────────────────────────────────────── */
.vd-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}
.vd-grid--single { grid-template-columns: 1fr; max-width: 560px; }

.vd-tills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

/* ── card base ───────────────────────────────────────────────────────────────── */
.vd-card {
  background: var(--surface-color, #fff);
  border: 1px solid var(--border-color, #e1e7ef);
  border-radius: 14px;
  padding: 22px;
  display: flex; flex-direction: column; gap: 16px;
  box-shadow: 0 4px 18px rgba(15,32,50,.06);
  transition: box-shadow .15s;
}
.vd-card:hover       { box-shadow: 0 6px 26px rgba(15,32,50,.1); }
.vd-card--loading    { opacity: .75; pointer-events: none; }
.vd-card--branch     { border-top: 3px solid #1769d2; }
.vd-card--mine       { border-top: 3px solid #168a7b; }
.vd-card--till       { border-top: 3px solid #7c3aed; }

/* ── card header ─────────────────────────────────────────────────────────────── */
.vd-card-header { display: flex; align-items: center; gap: 12px; }
.vd-card-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: grid; place-items: center; font-size: 22px; flex: none;
}
.vd-card-icon--branch { background: #eaf2ff; }
.vd-card-icon--mine   { background: #e8f7f0; }
.vd-card-icon--till   { background: #f3eeff; }
.vd-card-title { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.vd-label {
  font-size: 10px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; color: var(--muted, #718096);
}
.vd-card-title strong { font-size: 17px; color: var(--ink, #172536); line-height: 1.2; }

/* ── meta ────────────────────────────────────────────────────────────────────── */
.vd-meta {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px;
  font-size: 12px; color: var(--muted, #718096);
  padding: 10px 12px;
  background: var(--surface-muted, #f5f7fa);
  border-radius: 8px;
}
.vd-meta em { font-style: normal; font-weight: 700; color: var(--ink, #172536); margin-right: 4px; }
.vd-mine-chip {
  display: inline-block; padding: 2px 8px; border-radius: 999px;
  background: #e8f7f0; color: #145c3c; font-size: 11px; font-weight: 700;
}

/* ── balances ────────────────────────────────────────────────────────────────── */
.vd-balances { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.vd-balance-row {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 14px;
  background: var(--surface-muted, #f5f7fa);
  border: 1px solid var(--border-color, #e1e7ef);
  border-radius: 10px;
}
.vd-currency-code  { font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--muted, #718096); }
.vd-currency-name  { font-size: 11px; color: #8a99aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vd-balance-amount { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--ink, #172536); line-height: 1.1; }

/* ── empty / error / skeleton ────────────────────────────────────────────────── */
.vd-empty, .vd-no-balances {
  text-align: center; padding: 24px 10px; margin: 0;
  color: var(--muted, #718096); font-size: 13px;
  background: #f8fafb; border-radius: 10px; border: 1px dashed #dbe2ea;
}
.vd-error { margin: 0; padding: 10px 12px; background: #fff0ef; color: #a52c28; border-radius: 8px; font-size: 13px; }
.vd-skeleton-row { display: flex; flex-direction: column; gap: 10px; }
.vd-skeleton {
  height: 14px; border-radius: 6px;
  background: linear-gradient(90deg, #e8edf2 25%, #f3f6f9 50%, #e8edf2 75%);
  background-size: 200% 100%; animation: vd-shimmer 1.4s infinite;
}
@keyframes vd-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ── actions ─────────────────────────────────────────────────────────────────── */
.vd-actions {
  display: flex; gap: 8px; flex-wrap: wrap;
  padding-top: 4px; border-top: 1px solid var(--border-color, #e1e7ef); margin-top: auto;
}

/* ── tills section header ────────────────────────────────────────────────────── */
.vd-section { display: flex; flex-direction: column; gap: 14px; }
.vd-section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.vd-section-header h3 { font-size: 18px; margin: 0 0 4px; }
.vd-section-header p  { margin: 0; font-size: 13px; color: var(--muted, #718096); }

/* ── ledger info banner ──────────────────────────────────────────────────────── */
.vd-ledger-info {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 14px 16px; margin-top: 4px;
  background: #fffdf0; border: 1px solid #e5d87a; border-radius: 10px;
}
.vd-ledger-info strong { display: block; font-size: 13px; color: #5a4800; margin-bottom: 4px; }
.vd-ledger-info p  { margin: 0; font-size: 12px; color: #6b5700; line-height: 1.6; }
.vd-ledger-info code { background: #f5eebc; padding: 1px 5px; border-radius: 4px; font-size: 11px; font-family: monospace; }

/* ── responsive ──────────────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .vd-grid, .vd-grid--single { grid-template-columns: 1fr; max-width: 100%; }
  .vd-tills-grid { grid-template-columns: 1fr; }
  .vd-balance-amount { font-size: 17px; }
}
</style>

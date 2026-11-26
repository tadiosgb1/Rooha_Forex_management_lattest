<script setup>
/**
 * CashAtBankView
 * Dashboard cards from GET /bank-accounts/summary
 * Plus full account list with live balances.
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { bankAccountService } from '../../services/bankAccountService'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'

const router  = useRouter()
const summary = ref(null)
const accounts= ref([])
const loading = ref(false)
const error   = ref('')

function normalizeList(r) {
  if (Array.isArray(r))             return r
  if (Array.isArray(r?.data))       return r.data
  if (Array.isArray(r?.data?.items))return r.data.items
  return []
}
function fmt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const [sumRes, listRes] = await Promise.allSettled([
      bankAccountService.summary(),
      bankAccountService.list(),
    ])
    if (sumRes.status === 'fulfilled')  summary.value  = sumRes.value?.data ?? sumRes.value
    if (listRes.status === 'fulfilled') accounts.value = normalizeList(listRes.value)
  } catch (e) { error.value = e?.message || 'Could not load cash at bank data.' }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <section class="module-page">

    <div class="module-page-intro">
      <div>
        <h2>Cash at Bank</h2>
        <p class="cab-subtitle">Live balances across all bureau bank accounts. Updated on each approved deposit or withdrawal.</p>
      </div>
      <div style="display:flex;gap:8px">
        <BaseButton variant="secondary" :disabled="loading" @click="load">{{ loading ? 'Loading…' : '↺ Refresh' }}</BaseButton>
        <BaseButton class="module-primary-btn" @click="router.push('/bank-accounts')">Manage Accounts</BaseButton>
      </div>
    </div>

    <p v-if="error" class="cab-error">{{ error }}</p>

    <!-- summary cards from /bank-accounts/summary -->
    <div v-if="summary" class="module-stat-row cab-stat-row">
      <BaseCard
        v-for="(item, idx) in (Array.isArray(summary) ? summary : Object.entries(summary).map(([k,v]) => ({ currency: k, ...v })))"
        :key="idx"
        class="module-stat-card cab-stat-card"
      >
        <span>{{ item.currency ?? item.bank_name ?? `Account ${idx + 1}` }}</span>
        <strong>{{ fmt(item.total_balance ?? item.balance ?? item.current_balance) }}</strong>
        <small>{{ item.account_count ? item.account_count + ' accounts' : 'ETB' }}</small>
      </BaseCard>
    </div>

    <!-- per-account cards -->
    <div class="cab-accounts-grid">
      <div v-if="loading" class="cab-skeleton" v-for="n in 3" :key="n"></div>

      <BaseCard
        v-for="a in accounts" :key="a.id"
        class="cab-account-card"
        :class="{ 'cab-account-card--inactive': a.is_active === false }"
      >
        <div class="cab-account-header">
          <div class="cab-bank-icon">🏦</div>
          <div class="cab-account-title">
            <span class="cab-label">{{ a.bank?.bank_name ?? a.bank_name ?? 'Bank' }}</span>
            <strong>{{ a.account_name }}</strong>
          </div>
          <BaseBadge :tone="a.is_active !== false ? 'success' : 'neutral'" style="flex:none">
            {{ a.is_active !== false ? 'Active' : 'Inactive' }}
          </BaseBadge>
        </div>

        <div class="cab-balance">
          <span>{{ a.currency ?? 'ETB' }}</span>
          <strong>{{ fmt(a.current_balance) }}</strong>
        </div>

        <div class="cab-account-meta">
          <span>Acct: {{ a.account_number }}</span>
        </div>

        <div class="cab-account-actions">
          <BaseButton variant="secondary" size="sm" @click="router.push(`/bank-accounts/${encodeURIComponent(a.id)}`)">
            View Ledger
          </BaseButton>
          <BaseButton variant="secondary" size="sm" @click="router.push(`/bank-accounts/${encodeURIComponent(a.id)}`)">
            + Deposit
          </BaseButton>
        </div>
      </BaseCard>

      <div v-if="!loading && !accounts.length" class="cab-empty">
        No bank accounts found. <a @click.prevent="router.push('/bank-accounts')" href="#">Add one</a>.
      </div>
    </div>

  </section>
</template>

<style scoped>
.cab-subtitle { margin: 6px 0 0; color: #77879b; font-size: 12px; }
.cab-error { padding: 10px 16px; background: #fff0ef; color: #a52c28; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }

/* summary stat row */
.cab-stat-row { margin-bottom: 20px; }
.cab-stat-card { border-top: 3px solid #1769d2; }

/* accounts grid */
.cab-accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.cab-account-card {
  display: flex; flex-direction: column; gap: 14px;
  padding: 18px;
  border: 1px solid #e1e7ef; border-radius: 12px;
  background: #fff;
  box-shadow: 0 3px 12px rgba(15,32,50,.05);
  transition: box-shadow .15s;
}
.cab-account-card:hover { box-shadow: 0 6px 20px rgba(15,32,50,.09); }
.cab-account-card--inactive { opacity: .65; }

.cab-account-header { display: flex; align-items: center; gap: 10px; }
.cab-bank-icon { width: 38px; height: 38px; border-radius: 10px; background: #eaf2ff; display: grid; place-items: center; font-size: 20px; flex: none; }
.cab-account-title { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cab-label { font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: #718096; }
.cab-account-title strong { font-size: 14px; color: #172536; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cab-balance { display: flex; flex-direction: column; gap: 2px; }
.cab-balance span { font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: #718096; }
.cab-balance strong { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; color: #168a7b; line-height: 1.1; }

.cab-account-meta { font-size: 11px; color: #718096; }

.cab-account-actions { display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid #e1e7ef; }

/* skeleton */
.cab-skeleton {
  height: 160px; border-radius: 12px;
  background: linear-gradient(90deg, #e8edf2 25%, #f3f6f9 50%, #e8edf2 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.cab-empty {
  grid-column: 1 / -1; padding: 40px; text-align: center;
  color: #718096; font-size: 13px;
  background: #f8fafc; border-radius: 10px; border: 1px dashed #dbe2ea;
}
.cab-empty a { color: #168a7b; cursor: pointer; font-weight: 700; }

@media (max-width: 720px) { .cab-accounts-grid { grid-template-columns: 1fr; } }
</style>

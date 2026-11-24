<script setup>
/**
 * VaultLedgerModal
 * Shows the ledger entries for a single vault, including balance_before and balance_after
 * on every row so the user can verify double-entry accounting is correct.
 */
import { ref, watch, computed } from 'vue'
import { apiRequest } from '../../services/apiClient'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseButton from '../../components/ui/BaseButton.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  vault: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])
const close = () => emit('update:modelValue', false)

const entries   = ref([])
const loading   = ref(false)
const error     = ref('')
const page      = ref(1)
const pageSize  = ref(20)
const total     = ref(0)
const currency  = ref('')

function normalizeList(r) {
  if (Array.isArray(r)) return r
  if (Array.isArray(r?.data)) return r.data
  if (Array.isArray(r?.data?.items)) return r.data.items
  if (Array.isArray(r?.items)) return r.items
  return []
}
function normalizeTotal(r) {
  return r?.total ?? r?.data?.total ?? r?.meta?.total ?? normalizeList(r).length
}

async function load() {
  if (!props.vault?.id) return
  loading.value = true
  error.value   = ''
  try {
    const params = new URLSearchParams({
      page: page.value,
      page_size: pageSize.value,
      vaultId: props.vault.id,
    })
    if (currency.value) params.set('currency_code', currency.value)
    const res = await apiRequest(`cash-management/ledger?${params}`)
    entries.value = normalizeList(res)
    total.value   = normalizeTotal(res)
  } catch (e) {
    error.value = e?.message || 'Could not load ledger entries.'
    entries.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) { page.value = 1; currency.value = ''; load() }
})
watch([page, currency], () => { if (props.modelValue) load() })

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function entryTone(type) {
  if (!type) return 'neutral'
  const t = String(type).toUpperCase()
  if (t.includes('CREDIT') || t === 'IN') return 'success'
  if (t.includes('DEBIT') || t === 'OUT') return 'warning'
  return 'neutral'
}

function fmt(val) {
  if (val === null || val === undefined || val === '') return '—'
  const n = Number(val)
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(val)
}

function fmtDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString()
}

const vaultTitle = computed(() =>
  props.vault?.vault_name || props.vault?.vault_code || `Vault ${props.vault?.id ?? ''}`
)
</script>

<template>
  <BaseModal :model-value="modelValue" :title="`Ledger — ${vaultTitle}`" size="xl" @update:model-value="close">
    <div class="vl-root">

      <!-- toolbar -->
      <div class="vl-toolbar">
        <div class="vl-vault-info">
          <span class="vl-vault-type">{{ vault?.vault_type?.replace('_', ' ') ?? '—' }}</span>
          <strong>{{ vaultTitle }}</strong>
        </div>
        <div class="vl-toolbar-right">
          <input
            v-model="currency"
            class="vl-currency-filter"
            placeholder="Filter by currency (e.g. USD)"
            @keydown.enter="page = 1; load()"
          />
          <BaseButton variant="secondary" size="sm" :disabled="loading" @click="page = 1; load()">
            {{ loading ? 'Loading…' : 'Refresh' }}
          </BaseButton>
        </div>
      </div>

      <!-- accounting note -->
      <div class="vl-accounting-note">
        <span class="vl-note-icon">📒</span>
        <div>
          <strong>Double-entry verification</strong>
          <p>
            Each row shows the balance <em>before</em> and <em>after</em> the entry was posted.
            Use this to confirm that every transfer was booked exactly once on both sides.
          </p>
        </div>
      </div>

      <!-- error -->
      <p v-if="error" class="vl-error">{{ error }}</p>

      <!-- table -->
      <div class="vl-table-wrap">
        <table class="module-table vl-table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Currency</th>
              <th>Type</th>
              <th class="vl-num">Amount</th>
              <th class="vl-num vl-before">Balance before</th>
              <th class="vl-num vl-after">Balance after</th>
              <th>Reference</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="vl-center">Loading ledger entries…</td>
            </tr>
            <tr v-else-if="!entries.length">
              <td colspan="8" class="vl-center">No ledger entries found for this vault.</td>
            </tr>
            <tr v-for="(e, idx) in entries" :key="e.id ?? e.ledger_id ?? idx" class="vl-row">
              <td class="vl-date">{{ fmtDate(e.created_at ?? e.entry_date ?? e.posted_at) }}</td>
              <td><span class="vl-currency-chip">{{ e.currency_code ?? e.currency ?? '—' }}</span></td>
              <td>
                <BaseBadge :tone="entryTone(e.entry_type ?? e.type)">
                  {{ e.entry_type ?? e.type ?? '—' }}
                </BaseBadge>
              </td>
              <td class="vl-num" :class="{'vl-credit': entryTone(e.entry_type??e.type)==='success', 'vl-debit': entryTone(e.entry_type??e.type)==='warning'}">
                {{ fmt(e.amount ?? e.entry_amount) }}
              </td>
              <!-- balance_before -->
              <td class="vl-num vl-before">
                <span class="vl-balance-pill vl-balance-before">
                  {{ fmt(e.balance_before) }}
                </span>
              </td>
              <!-- balance_after -->
              <td class="vl-num vl-after">
                <span class="vl-balance-pill vl-balance-after">
                  {{ fmt(e.balance_after) }}
                </span>
              </td>
              <td class="vl-ref">{{ e.reference ?? e.transfer_ref ?? e.transaction_ref ?? '—' }}</td>
              <td class="vl-notes">{{ e.notes ?? e.description ?? e.remarks ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- pagination -->
      <div class="vl-pagination">
        <span class="vl-count">{{ total }} entr{{ total === 1 ? 'y' : 'ies' }}</span>
        <div class="vl-pager">
          <BaseButton variant="secondary" size="sm" :disabled="page <= 1 || loading" @click="page--">← Prev</BaseButton>
          <span>Page {{ page }} of {{ totalPages }}</span>
          <BaseButton variant="secondary" size="sm" :disabled="page >= totalPages || loading" @click="page++">Next →</BaseButton>
        </div>
      </div>

    </div>
  </BaseModal>
</template>

<style scoped>
.vl-root { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }

/* toolbar */
.vl-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.vl-vault-info { display: flex; flex-direction: column; gap: 2px; }
.vl-vault-type { font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--muted, #718096); text-transform: uppercase; }
.vl-vault-info strong { font-size: 15px; color: var(--ink, #172536); }
.vl-toolbar-right { display: flex; align-items: center; gap: 8px; }
.vl-currency-filter {
  padding: 8px 10px; border: 1px solid var(--border-color, #dbe2ea);
  border-radius: 7px; font: inherit; font-size: 13px; width: 190px;
  background: white;
}
.vl-currency-filter:focus { outline: none; border-color: #6ca6ef; box-shadow: 0 0 0 3px #eaf2ff; }

/* accounting note */
.vl-accounting-note {
  display: flex; gap: 11px; align-items: flex-start;
  background: #f0f7ff; border: 1px solid #c8dff8; border-radius: 10px; padding: 12px 14px;
}
.vl-note-icon { font-size: 20px; flex: none; margin-top: 1px; }
.vl-accounting-note strong { font-size: 13px; color: #1a3a5c; display: block; margin-bottom: 3px; }
.vl-accounting-note p { margin: 0; font-size: 12px; color: #3a5878; line-height: 1.55; }
.vl-accounting-note em { font-style: normal; font-weight: 700; }

/* error */
.vl-error { margin: 0; padding: 10px 12px; background: #fff0ef; color: #a52c28; border-radius: 8px; font-size: 13px; }

/* table */
.vl-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border-color, #e1e7ef); }
.vl-table { width: 100%; min-width: 820px; border-collapse: collapse; }
.vl-table th, .vl-table td { vertical-align: middle; white-space: nowrap; }
.vl-center { text-align: center; padding: 32px 16px; color: var(--muted, #718096); font-size: 13px; }
.vl-num { text-align: right; font-variant-numeric: tabular-nums; }
.vl-date { font-size: 12px; color: #546070; }
.vl-ref { font-size: 12px; color: #3a4f63; font-weight: 600; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.vl-notes { font-size: 12px; color: #64758a; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vl-currency-chip {
  display: inline-block; padding: 2px 7px; border-radius: 999px;
  background: #eaf2ff; color: #1a4d9a; font-size: 11px; font-weight: 700;
}

/* credit / debit coloring */
.vl-credit { color: #16855b; font-weight: 700; }
.vl-debit  { color: #9a4a00; font-weight: 700; }

/* balance before / after pills */
.vl-before, .vl-after { min-width: 110px; }
.vl-balance-pill {
  display: inline-block; padding: 3px 9px; border-radius: 6px;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.vl-balance-before { background: #f0f4f8; color: #3a5068; }
.vl-balance-after  { background: #e8f7f0; color: #145c3c; }

/* row hover */
.vl-row:hover { background: #f6fbff; }

/* pagination */
.vl-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 2px; flex-wrap: wrap; }
.vl-count { font-size: 12px; color: var(--muted, #718096); }
.vl-pager { display: flex; align-items: center; gap: 10px; font-size: 13px; }
</style>

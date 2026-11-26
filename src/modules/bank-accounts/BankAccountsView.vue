<script setup>
/**
 * BankAccountsView
 * List + create + edit the bureau's own bank accounts.
 * GET  /bank-accounts
 * POST /bank-accounts
 * PATCH /bank-accounts/:id
 */
import { onMounted, ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { bankAccountService } from '../../services/bankAccountService'
import { apiRequest } from '../../services/apiClient'
import { useToast } from '../../composables/toast'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseInput from '../../components/ui/BaseInput.vue'

const router = useRouter()
const toast  = useToast()

const accounts  = ref([])
const banks     = ref([])
const currencies= ref([])
const loading   = ref(false)
const error     = ref('')
const search    = ref('')

const modalOpen = ref(false)
const saving    = ref(false)
const editId    = ref(null)
const form      = reactive({ bank_id: '', currency_id: '', account_number: '', account_name: '', notes: '' })

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

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return accounts.value
  return accounts.value.filter(a =>
    [a.account_name, a.account_number, a.bank?.bank_name, a.currency].some(v => String(v ?? '').toLowerCase().includes(q))
  )
})

async function load() {
  loading.value = true; error.value = ''
  try { accounts.value = normalizeList(await bankAccountService.list()) }
  catch (e) { error.value = e?.message || 'Could not load bank accounts.' }
  finally { loading.value = false }
}

async function loadRef() {
  const [bRes, cRes] = await Promise.allSettled([apiRequest('banks?status=Active'), apiRequest('reference-currencies')])
  if (bRes.status === 'fulfilled') banks.value = normalizeList(bRes.value).filter(b => b?.status === 'Active')
  if (cRes.status === 'fulfilled') currencies.value = normalizeList(cRes.value).filter(c => c?.is_active !== false)
}

function openCreate() {
  editId.value = null
  Object.assign(form, { bank_id: '', currency_id: '', account_number: '', account_name: '', notes: '' })
  modalOpen.value = true
}
function openEdit(a) {
  editId.value = a.id
  Object.assign(form, {
    bank_id:        a.bank_id ?? a.bank?.id ?? '',
    currency_id:    a.currency_id ?? '',
    account_number: a.account_number ?? '',
    account_name:   a.account_name ?? '',
    notes:          a.notes ?? '',
  })
  modalOpen.value = true
}

async function save() {
  if (!form.bank_id || !form.account_number.trim() || !form.account_name.trim()) {
    toast.error('Bank, account number, and account name are required.')
    return
  }
  saving.value = true
  try {
    const payload = { bank_id: form.bank_id, currency_id: form.currency_id || undefined, account_number: form.account_number.trim(), account_name: form.account_name.trim(), notes: form.notes.trim() || undefined }
    if (editId.value) await bankAccountService.update(editId.value, payload)
    else await bankAccountService.create(payload)
    toast.success(editId.value ? 'Account updated.' : 'Account created.')
    modalOpen.value = false
    await load()
  } catch (e) { toast.error(e?.message || 'Save failed.') }
  finally { saving.value = false }
}

onMounted(() => { load(); loadRef() })
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Bank Accounts</h2>
        <p class="ba-subtitle">The bureau's own accounts at external banks. Used for BANK payment settlements.</p>
      </div>
      <BaseButton class="module-primary-btn" @click="openCreate">＋ Add Account</BaseButton>
    </div>

    <!-- stat row -->
    <div class="module-stat-row">
      <BaseCard class="module-stat-card">
        <span>Total accounts</span>
        <strong>{{ accounts.length }}</strong>
        <small>registered</small>
      </BaseCard>
      <BaseCard class="module-stat-card" style="border-top:3px solid #168a7b">
        <span>Active accounts</span>
        <strong>{{ accounts.filter(a => a.is_active !== false).length }}</strong>
        <small>in use</small>
      </BaseCard>
      <BaseCard class="module-stat-card" style="border-top:3px solid #1769d2">
        <span>Total balance</span>
        <strong style="font-size:16px">{{ accounts.reduce((s,a) => s + Number(a.current_balance ?? 0), 0).toLocaleString('en-ET', {minimumFractionDigits:2, maximumFractionDigits:2}) }} ETB</strong>
        <small>across all accounts</small>
      </BaseCard>
    </div>

    <BaseCard as="section" class="module-panel">
      <div class="module-panel-header">
        <h3>Account register</h3>
        <label class="module-search">
          <BaseInput v-model="search" placeholder="Search accounts…" size="sm" />
        </label>
        <BaseButton variant="secondary" size="sm" @click="load">Refresh</BaseButton>
      </div>

      <p v-if="error" class="ba-error">{{ error }}</p>
      <p v-else-if="loading" class="module-empty-state">Loading bank accounts…</p>
      <p v-else-if="!filtered.length" class="module-empty-state">No bank accounts found.</p>

      <div v-else class="module-table-wrap">
        <table class="module-table">
          <thead>
            <tr>
              <th>Bank</th>
              <th>Account name</th>
              <th>Account number</th>
              <th>Currency</th>
              <th>Current balance</th>
              <th>Status</th>
              <th data-no-sort>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in filtered" :key="a.id">
              <td><strong>{{ a.bank?.bank_name ?? a.bank_name ?? '—' }}</strong></td>
              <td>{{ a.account_name }}</td>
              <td><code style="font-size:12px">{{ a.account_number }}</code></td>
              <td>{{ a.currency ?? 'ETB' }}</td>
              <td><strong>{{ fmt(a.current_balance) }}</strong></td>
              <td>
                <BaseBadge :tone="a.is_active !== false ? 'success' : 'neutral'">
                  {{ a.is_active !== false ? 'Active' : 'Inactive' }}
                </BaseBadge>
              </td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="ba-action" @click="router.push(`/bank-accounts/${encodeURIComponent(a.id)}`)">View</button>
                  <button class="ba-action" @click="openEdit(a)">Edit</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="module-table-footer">Showing {{ filtered.length }} of {{ accounts.length }} accounts</div>
    </BaseCard>

    <!-- create / edit modal -->
    <BaseModal v-model="modalOpen" :title="editId ? 'Edit Bank Account' : 'Add Bank Account'" size="lg">
      <form class="ba-form" @submit.prevent="save">
        <div class="ba-field">
          <label>Bank *</label>
          <select v-model="form.bank_id" class="ba-input" required>
            <option value="">Select bank</option>
            <option v-for="b in banks" :key="b.id" :value="b.id">{{ b.bank_name }}</option>
          </select>
        </div>
        <div class="ba-field">
          <label>Currency</label>
          <select v-model="form.currency_id" class="ba-input">
            <option value="">ETB (default)</option>
            <option v-for="c in currencies" :key="c.id" :value="c.id">{{ c.code }} — {{ c.name }}</option>
          </select>
        </div>
        <div class="ba-field">
          <label>Account number *</label>
          <input v-model="form.account_number" class="ba-input" placeholder="e.g. 1000347815" required />
        </div>
        <div class="ba-field">
          <label>Account name *</label>
          <input v-model="form.account_name" class="ba-input" placeholder="e.g. Wegagen Forex Main Account" required />
        </div>
        <div class="ba-field ba-field--full">
          <label>Notes</label>
          <textarea v-model="form.notes" class="ba-input" rows="2" placeholder="Optional notes"></textarea>
        </div>
        <div class="ba-actions">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancel</BaseButton>
          <BaseButton class="module-primary-btn" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </section>
</template>

<style scoped>
.ba-subtitle { margin: 6px 0 0; color: #77879b; font-size: 12px; }
.ba-error { padding: 10px 16px; background: #fff0ef; color: #a52c28; border-radius: 8px; margin: 12px 16px; font-size: 13px; }
.ba-action { border: 0; background: transparent; color: #167d72; font-size: 11px; font-weight: 700; padding: 5px 7px; cursor: pointer; }
.ba-action:hover { color: #0f5a52; }
.ba-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 4px; }
.ba-field { display: flex; flex-direction: column; gap: 6px; }
.ba-field--full { grid-column: 1 / -1; }
.ba-field label { font-size: 12px; font-weight: 700; color: #4b5f76; }
.ba-input { padding: 9px 11px; border: 1px solid #dce5ee; border-radius: 8px; font: inherit; font-size: 14px; background: #fff; color: #203750; width: 100%; box-sizing: border-box; }
.ba-input:focus { outline: none; border-color: #168a7b; }
.ba-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
</style>

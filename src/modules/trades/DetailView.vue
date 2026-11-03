<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { forexTransactionService } from '../../services/forexTransactionService'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseCard from '../../components/ui/BaseCard.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const transaction = ref(null)
const id = computed(() => String(route.params.id || ''))

function unwrap(response) {
  let value = response
  for (let i = 0; i < 4; i += 1) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    const next = value.data ?? value.transaction ?? value.forex_transaction ?? value.record
    if (next === undefined || next === value) return value
    value = next
  }
  return value
}
function first(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') ?? '—'
}
function personName(person) {
  if (!person || typeof person !== 'object') return person
  return first(person.full_name, person.customer_name, person.name, [person.first_name, person.last_name].filter(Boolean).join(' '), person.display_name)
}
const fields = computed(() => {
  const row = transaction.value || {}
  const currency = row.currency && typeof row.currency === 'object' ? row.currency : {}
  const customer = row.customer_profile ?? row.customer
  const amount = Number(first(row.foreign_amount, row.amount, row.transaction_amount))
  const rate = Number(first(row.applied_rate, row.exchange_rate, row.rate))
  const equivalent = Number(first(row.etb_amount, row.local_amount, row.total_etb, Number.isFinite(amount) && Number.isFinite(rate) ? amount * rate : NaN))
  return [
    ['Transaction reference', first(row.reference, row.reference_number, row.transaction_reference, row.transaction_code, row.receipt_number, row.code)],
    ['Customer', first(personName(customer), row.customer_name, row.customer_full_name, row.customer_profile_name)],
    ['Transaction type', first(row.transaction_type, row.direction, row.type)],
    ['Currency', first(currency.code, currency.currency_code, row.currency_code, row.currency_name, row.currency_id)],
    ['Foreign amount', Number.isFinite(amount) ? amount.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : first(row.foreign_amount, row.amount)],
    ['Applied rate', Number.isFinite(rate) ? rate.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : first(row.applied_rate, row.exchange_rate)],
    ['ETB equivalent', Number.isFinite(equivalent) ? equivalent.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ETB' : '—'],
    ['Status', first(row.status, row.transaction_status)],
    ['Created at', first(row.created_at, row.createdAt, row.transaction_date, row.created_date, row.date)],
    ['Till session', first(row.till_session?.name, row.till_session?.session_name, row.till_session_id)],
    ['Created by', first(personName(row.maker), personName(row.created_by), row.maker_name)],
  ]
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await forexTransactionService.get(id.value)
    const record = unwrap(response)
    transaction.value = record && typeof record === 'object' && !Array.isArray(record) ? record : null
    if (!transaction.value) error.value = 'The API did not return this transaction.'
  } catch (err) {
    transaction.value = null
    error.value = err?.message || 'Unable to load this forex transaction.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Forex transaction details</h2><p class="trade-detail-subtitle">Record returned by the live API.</p></div>
      <BaseButton variant="secondary" @click="router.push('/trades')">← Back to Trading Desk</BaseButton>
    </div>
    <BaseCard class="module-panel trade-detail-panel">
      <p v-if="loading" class="trade-detail-state">Loading transaction…</p>
      <div v-else-if="error" class="trade-detail-error" role="alert"><p>{{ error }}</p><BaseButton variant="secondary" @click="load">Try again</BaseButton></div>
      <dl v-else-if="transaction" class="trade-detail-grid">
        <div v-for="[label, value] in fields" :key="label" class="trade-detail-field"><dt>{{ label }}</dt><dd>{{ value }}</dd></div>
      </dl>
      <p v-else class="trade-detail-state">Transaction not found.</p>
    </BaseCard>
  </section>
</template>

<style scoped>
.trade-detail-subtitle { margin:6px 0 0;color:var(--text-muted,#778196);font-size:.9rem; }
.trade-detail-panel { padding:24px; }
.trade-detail-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:0; }
.trade-detail-field { min-width:0;padding-bottom:14px;border-bottom:1px solid var(--border-color,#e3e8f0); }
.trade-detail-field dt { margin-bottom:6px;color:var(--text-muted,#778196);font-size:.8rem; }
.trade-detail-field dd { margin:0;color:var(--text-primary,#263449);font-weight:600;overflow-wrap:anywhere; }
.trade-detail-state { padding:20px;text-align:center;color:var(--text-muted,#778196); }
.trade-detail-error { display:flex;align-items:center;justify-content:space-between;gap:16px;color:#a52c28; }
@media(max-width:640px) { .trade-detail-grid { grid-template-columns:1fr; } }
</style>

<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import { rateService } from '../../services/rateService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'

const route = useRoute()
const router = useRouter()
const record = ref(null)
const currencies = ref([])
const loading = ref(false)
const errorMessage = ref('')

function unwrap(response) {
  let value = response?.data ?? response
  if (value?.data !== undefined && !Array.isArray(value.data)) value = value.data
  if (value?.item) value = value.item
  return Array.isArray(value) ? value[0] || null : value
}
function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
const currency = computed(() => record.value?.currency || currencies.value.find(item => String(item.id) === String(record.value?.currency_id ?? record.value?.currencyId)) || null)
const flagUrl = computed(() => {
  const path = currency.value?.flag_url ?? currency.value?.flagUrl ?? ''
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base = (import.meta.env.VITE_API_BASE_URL || 'https://10.195.49.18:3001').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
})
function display(value) { return value === null || value === undefined || String(value).trim() === '' ? '—' : value }
function personName(person, fallbackId) {
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ')
  return name || person?.email || (fallbackId != null ? `User ${fallbackId}` : '—')
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
}
function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}
function formatRate(value) {
  if (value == null || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 8 }) : value
}
const fields = computed(() => [
  { label: 'Currency code', value: currency.value?.code ?? record.value?.currency_code },
  { label: 'Currency name', value: currency.value?.name },
  { label: 'Currency symbol', value: currency.value?.symbol },
  { label: 'Currency ID', value: record.value?.currency_id ?? currency.value?.id },
  { label: 'Rate date', value: formatDate(record.value?.rate_date ?? record.value?.rateDate) },
  { label: 'Buy rate', value: formatRate(record.value?.buy_rate ?? record.value?.buyRate) },
  { label: 'Sell rate', value: formatRate(record.value?.sell_rate ?? record.value?.sellRate) },
  { label: 'Status', value: record.value?.status },
  { label: 'Active', value: record.value?.is_active === true ? 'Active' : record.value?.is_active === false ? 'Inactive' : '—' },
  { label: 'Maker', value: personName(record.value?.maker, record.value?.maker_id) },
  { label: 'Maker ID', value: record.value?.maker_id },
  { label: 'Maker email', value: record.value?.maker?.email },
  { label: 'Created / made at', value: formatDateTime(record.value?.made_at ?? record.value?.created_at) },
  { label: 'Checker', value: personName(record.value?.checker, record.value?.checker_id) },
  { label: 'Checker ID', value: record.value?.checker_id },
  { label: 'Checker email', value: record.value?.checker?.email },
  { label: 'Checked at', value: formatDateTime(record.value?.checked_at) },
  { label: 'Last updated', value: formatDateTime(record.value?.updated_at) },
])
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const results = await Promise.allSettled([
      rateService.get(route.params.id),
      referenceCurrencyService.list({ page: 1, page_size: 100 }),
    ])
    if (results[0].status === 'rejected') throw results[0].reason
    record.value = unwrap(results[0].value)
    if (!record.value) throw new Error('Exchange rate record was not found.')
    if (results[1].status === 'fulfilled') currencies.value = normalize(results[1].value)
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load exchange rate details.'
  } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="module-page rate-detail-page">
    <div class="module-page-intro">
      <div><h2>Exchange rate details</h2><p class="module-description">Rate information, currency, and review history.</p></div>
      <div class="rate-detail-actions">
        <BaseButton variant="secondary" @click="router.push('/rates')">← Back to rates</BaseButton>
        <BaseButton v-if="record && hasPermission('exchange-rates:update')" @click="router.push('/rates/' + encodeURIComponent(route.params.id) + '/edit')">Edit rate</BaseButton>
      </div>
    </div>
    <p v-if="loading" class="module-description">Loading exchange rate…</p>
    <section v-else-if="errorMessage" class="module-panel rate-detail-state" role="alert">
      <p>{{ errorMessage }}</p><BaseButton variant="secondary" @click="load">Try again</BaseButton>
    </section>
    <template v-else-if="record">
      <section class="rate-detail-hero">
        <img v-if="flagUrl" :src="flagUrl" :alt="`${currency?.code || 'Currency'} flag`" class="rate-detail-flag" />
        <div v-else class="rate-detail-flag-placeholder">{{ (currency?.code || 'FX').slice(0, 2) }}</div>
        <div class="rate-detail-hero-copy">
          <p class="rate-detail-eyebrow">CURRENCY RATE</p>
          <h3>{{ currency?.code || record.currency_code || 'Exchange rate' }}<span v-if="currency?.name"> · {{ currency.name }}</span></h3>
          <p>{{ formatDate(record.rate_date ?? record.rateDate) }} <span v-if="currency?.symbol">· {{ currency.symbol }}</span></p>
        </div>
        <span class="rate-detail-status" :class="String(record.status || '').toLowerCase()">{{ record.status || 'Unknown' }}</span>
      </section>
      <section class="rate-detail-rate-grid">
        <article class="rate-value-card"><span>Buy rate</span><strong>{{ formatRate(record.buy_rate ?? record.buyRate) }}</strong></article>
        <article class="rate-value-card"><span>Sell rate</span><strong>{{ formatRate(record.sell_rate ?? record.sellRate) }}</strong></article>
        <article class="rate-value-card"><span>Currency status</span><strong>{{ currency?.is_active === true ? 'Active' : currency?.is_active === false ? 'Inactive' : '—' }}</strong></article>
      </section>
      <section class="module-panel rate-detail-card">
        <div class="module-panel-header"><h3>Rate and currency information</h3></div>
        <dl class="rate-detail-grid">
          <div v-for="field in fields" :key="field.label"><dt>{{ field.label }}</dt><dd>{{ display(field.value) }}</dd></div>
          <div><dt>Exchange rate ID</dt><dd>{{ record.id || record.exchange_rate_id || route.params.id }}</dd></div>
          <div><dt>Currency base flag</dt><dd>{{ currency?.is_base_currency === true ? 'Base currency' : currency?.is_base_currency === false ? 'Not a base currency' : '—' }}</dd></div>
          <div><dt>Currency created at</dt><dd>{{ formatDateTime(currency?.created_at) }}</dd></div>
        </dl>
      </section>
    </template>
  </section>
</template>

<style scoped>
.rate-detail-page { gap:20px; }
.rate-detail-actions { display:flex;gap:9px;flex-wrap:wrap; }
.rate-detail-state { padding:22px; }
.rate-detail-hero { display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:24px;border:1px solid #dfe7f5;border-radius:17px;background:linear-gradient(115deg,#f2f6ff 0%,#f8faff 55%,#f1f8f7 100%); }
.rate-detail-flag,.rate-detail-flag-placeholder { width:68px;height:48px;flex:0 0 68px;border-radius:8px;object-fit:cover;border:1px solid #dce3ef;background:#f1f4f8; }
.rate-detail-flag-placeholder { display:flex;align-items:center;justify-content:center;color:#59677c;font-weight:800; }
.rate-detail-hero-copy { min-width:0;flex:1; }
.rate-detail-eyebrow { margin:0 0 5px;color:#526eb1;font-size:.68rem;font-weight:800;letter-spacing:.13em; }
.rate-detail-hero h3 { margin:0;color:#202d43;font-size:clamp(1.15rem,2vw,1.5rem);overflow-wrap:anywhere; }
.rate-detail-hero h3 span { color:#657188;font-weight:500; }
.rate-detail-hero-copy > p:last-child { margin:7px 0 0;color:#657188;font-size:.86rem; }
.rate-detail-status { display:inline-flex;padding:6px 11px;border-radius:999px;background:#edf0f5;color:#586579;font-size:.75rem;font-weight:750; }
.rate-detail-status.approved { background:#e6f6ed;color:#23764b; }
.rate-detail-status.pending { background:#fff4dc;color:#8c6217; }
.rate-detail-status.rejected { background:#fff0f0;color:#a63e43; }
.rate-detail-rate-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px; }
.rate-value-card { display:flex;flex-direction:column;gap:9px;padding:20px;border:1px solid #e4e9f1;border-radius:14px;background:#fff; }
.rate-value-card span { color:#7b8494;font-size:.78rem; }
.rate-value-card strong { color:#263449;font-size:1.35rem;overflow-wrap:anywhere; }
.rate-detail-card { padding:0 22px 22px; }
.rate-detail-card .module-panel-header { margin:0 -22px 4px; }
.rate-detail-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 18px;margin:0;padding-top:18px; }
.rate-detail-grid > div { min-width:0; }
.rate-detail-grid dt { margin-bottom:6px;color:#7b8494;font-size:.76rem; }
.rate-detail-grid dd { margin:0;color:#273449;font-size:.88rem;font-weight:600;overflow-wrap:anywhere; }
@media(max-width:760px) { .rate-detail-rate-grid { grid-template-columns:1fr; }.rate-detail-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.rate-detail-hero { padding:18px; } }
@media(max-width:480px) { .rate-detail-grid { grid-template-columns:1fr; }.rate-detail-card { padding:0 16px 18px; }.rate-detail-card .module-panel-header { margin:0 -16px 4px; } }
</style>

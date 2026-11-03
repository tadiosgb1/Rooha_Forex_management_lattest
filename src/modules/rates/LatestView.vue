<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { rateService } from '../../services/rateService'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'

const rates = ref([])
const currencies = ref([])
const currencyIdFilter = ref('')
const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://10.195.49.18:3001').replace(/\/$/, '')

function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
function currencyId(currency) {
  return currency?.id ?? currency?.currency_id ?? currency?.uuid ?? ''
}
function currencyForRate(row) {
  const id = row?.currency_id ?? row?.currencyId ?? row?.currency?.id ?? row?.currency?.currency_id
  return row?.currency ?? currencies.value.find(currency => String(currencyId(currency)) === String(id)) ?? null
}
function currencyLabel(currency) {
  return [currency?.code ?? currency?.currency_code, currency?.name ?? currency?.currency_name].filter(Boolean).join(' — ') || 'Unknown currency'
}
function currencyLabelForRate(row) {
  const currency = currencyForRate(row)
  return currency ? currencyLabel(currency) : row?.currency_code ?? row?.currencyCode ?? 'Unknown currency'
}
function currencyFlagUrl(currency) {
  const path = currency?.flag_url ?? currency?.flagUrl ?? ''
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path) || /^(data|blob):/i.test(path)) return path
  return `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString()
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
const rows = computed(() => {
  const query = search.value.trim().toLowerCase()
  return rates.value.filter(row => !query || [
    currencyLabelForRate(row), row?.rate_date, row?.rateDate,
    row?.buy_rate, row?.buyRate, row?.sell_rate, row?.sellRate, row?.status,
  ].some(value => String(value ?? '').toLowerCase().includes(query)))
})
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = currencyIdFilter.value ? { currency_id: currencyIdFilter.value } : {}
    // Keep the rates board usable even when the user cannot list currencies.
    const rateResponse = await rateService.latest(params)
    rates.value = normalize(rateResponse)
    try {
      const currencyResponse = await referenceCurrencyService.list({ page: 1, page_size: 100 })
      currencies.value = normalize(currencyResponse)
    } catch {
      currencies.value = []
    }
  } catch (error) {
    rates.value = []
    errorMessage.value = error?.message || 'Unable to load daily exchange rates.'
  } finally {
    loading.value = false
  }
}
watch(currencyIdFilter, () => load())
onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Board Daily Exchange Rates</h2>
        <p class="module-description">View the latest approved buy and sell rates by currency, including each currency’s flag.</p>
      </div>
      <BaseButton variant="secondary" @click="load" :disabled="loading">↻ Refresh</BaseButton>
    </div>
    <section class="module-panel">
      <div class="module-panel-header latest-rates-filters">
        <h3>Daily exchange rates</h3>
        <div class="latest-rates-filter-controls">
          <label>
            <span>Currency</span>
            <select v-model="currencyIdFilter" class="ui-input" aria-label="Filter latest rates by currency">
              <option value="">All currencies</option>
              <option v-for="currency in currencies" :key="currencyId(currency)" :value="String(currencyId(currency))">{{ currencyLabel(currency) }}</option>
            </select>
          </label>
          <input v-model="search" class="ui-input" placeholder="Search rates…" aria-label="Search daily rates" />
        </div>
      </div>
      <div v-if="errorMessage" class="module-alert" role="alert">
        <div class="module-alert__content"><strong>Unable to load rates.</strong><span>{{ errorMessage }}</span></div>
        <button type="button" class="module-alert__close" aria-label="Close error alert" @click="errorMessage = ''">×</button>
      </div>
      <p v-if="loading" class="module-description latest-rates-state">Loading latest exchange rates…</p>
      <div v-else class="module-table-wrap">
        <table class="module-table latest-rates-table">
          <thead><tr><th>Currency</th><th>Rate date</th><th>Buy rate (ETB)</th><th>Sell rate (ETB)</th><th>Status</th><th>Last updated</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="row.id ?? row.exchange_rate_id ?? row.rate_id ?? index">
              <td>
                <div class="latest-rate-currency">
                  <img v-if="currencyFlagUrl(currencyForRate(row))" :src="currencyFlagUrl(currencyForRate(row))" :alt="`${currencyForRate(row)?.code || 'Currency'} flag`" class="latest-rate-flag" loading="lazy" @error="$event.target.style.display='none'" />
                  <span v-else class="latest-rate-flag-placeholder" aria-hidden="true">{{ (currencyForRate(row)?.code || '?').slice(0, 2) }}</span>
                  <div class="latest-rate-currency-copy"><strong>{{ currencyForRate(row)?.code || row?.currency_code || '—' }}</strong><small>{{ currencyForRate(row)?.name || 'Currency' }}</small></div>
                </div>
              </td>
              <td>{{ formatDate(row.rate_date ?? row.rateDate) }}</td>
              <td>{{ formatRate(row.buy_rate ?? row.buyRate) }}</td>
              <td>{{ formatRate(row.sell_rate ?? row.sellRate) }}</td>
              <td><span class="rate-status-chip" :class="String(row.status || '').toLowerCase()">{{ row.status || (row.is_active === true ? 'Active' : row.is_active === false ? 'Inactive' : '—') }}</span></td>
              <td>{{ formatDateTime(row.updated_at ?? row.checked_at ?? row.made_at ?? row.effective_at ?? row.created_at) }}</td>
            </tr>
            <tr v-if="!rows.length"><td colspan="6" class="latest-rates-state">No latest exchange rates found.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">Showing {{ rows.length }} latest exchange rate{{ rows.length === 1 ? '' : 's' }}</div>
    </section>
  </section>
</template>

<style scoped>
.latest-rates-filters { align-items:end; gap:16px; flex-wrap:wrap; }
.latest-rates-filter-controls { display:flex; align-items:end; justify-content:flex-end; gap:12px; flex:1; flex-wrap:wrap; }
.latest-rates-filter-controls label { display:flex; flex-direction:column; gap:5px; min-width:210px; color:var(--text-muted,#778196); font-size:.78rem; }
.latest-rates-filter-controls select,.latest-rates-filter-controls input { max-width:280px; min-width:210px; }
.latest-rates-table { min-width:760px; }
.latest-rate-currency { display:flex;align-items:center;gap:10px;min-width:150px; }
.latest-rate-flag,.latest-rate-flag-placeholder { width:38px;height:27px;flex:0 0 38px;border-radius:5px;object-fit:cover;border:1px solid #e3e8f0;background:#f1f4f8; }
.latest-rate-flag-placeholder { display:flex;align-items:center;justify-content:center;color:#59677c;font-size:.65rem;font-weight:800; }
.latest-rate-currency-copy { display:flex;flex-direction:column;gap:3px;min-width:0; }
.latest-rate-currency-copy strong { color:var(--text-primary,#263449);font-size:.88rem; }
.latest-rate-currency-copy small { color:var(--text-muted,#778196);font-size:.75rem; }
.rate-status-chip { display:inline-flex;padding:5px 9px;border-radius:999px;background:#edf0f5;color:#586579;font-size:.73rem;font-weight:750;white-space:nowrap; }
.rate-status-chip.approved { background:#e6f6ed;color:#23764b; }
.rate-status-chip.pending { background:#fff4dc;color:#8c6217; }
.rate-status-chip.rejected { background:#fff0f0;color:#a63e43; }
.latest-rates-state { padding:24px; text-align:center; }
@media (max-width:640px) { .latest-rates-filter-controls,.latest-rates-filter-controls label { width:100%; } .latest-rates-filter-controls select,.latest-rates-filter-controls input { max-width:none;width:100%; } }
</style>

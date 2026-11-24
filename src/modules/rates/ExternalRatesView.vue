<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { rateService } from '../../services/rateService'

const rates = ref([])
const loading = ref(false)
const syncing = ref(false)
const importing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const lastFetchedAt = ref(null)
const search = ref('')

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://10.195.49.18:3001').replace(/\/$/, '')

function normalize(response) {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

function currencyFlagUrl(currency) {
  const path = currency?.flag_url ?? currency?.flagUrl ?? ''
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path) || /^(data|blob):/i.test(path)) return path
  return `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

function formatRate(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : value
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString()
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rates.value
  return rates.value.filter(row =>
    [row?.currency?.code, row?.currency?.name, row?.effective_date, row?.buy_rate, row?.sell_rate]
      .some(v => String(v ?? '').toLowerCase().includes(q))
  )
})

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await rateService.externalLatest()
    const list = normalize(res)
    rates.value = list
    lastFetchedAt.value = list[0]?.fetched_at ?? null
  } catch (err) {
    errorMessage.value = err?.message || 'Unable to load external rates.'
  } finally {
    loading.value = false
  }
}

async function syncAndRefresh() {
  syncing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const res = await rateService.external()
    rates.value = normalize(res)
    lastFetchedAt.value = res?.fetched_at ?? null
  } catch (err) {
    errorMessage.value = err?.message || 'Unable to fetch external rates.'
  } finally {
    syncing.value = false
  }
}

async function syncToModel() {
  importing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const res = await rateService.externalImport()
    const synced = res?.imported_count ?? 0
    const skipped = res?.skipped_count ?? 0
    const skippedList = res?.skipped ?? []
    let msg = `Activated ${synced} rate${synced === 1 ? '' : 's'} from Roohaforex.`
    if (skipped > 0) {
      msg += ` Skipped ${skipped}: ${skippedList.map(s => s.currencyCode).join(', ')}.`
    }
    successMessage.value = msg
    await load()
  } catch (err) {
    errorMessage.value = err?.message || 'Unable to import rates into exchange rate model.'
  } finally {
    importing.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>External Reference Rates</h2>
        <p class="module-description">
          Live buy and sell rates from Roohaforex. Use <strong>Sync to Exchange Rates</strong> to
          push these rates into your exchange rate model.
        </p>
      </div>
      <div class="ext-rates-actions">
        <BaseButton variant="secondary" @click="load" :disabled="loading || syncing || importing">
          ↻ Reload stored
        </BaseButton>
        <BaseButton variant="secondary" @click="syncAndRefresh" :disabled="loading || syncing || importing">
          {{ syncing ? 'Fetching…' : '⟳ Fetch from Roohaforex' }}
        </BaseButton>
        <BaseButton @click="syncToModel" :disabled="loading || syncing || importing || !rates.length">
          {{ importing ? 'Syncing…' : '⇄ Sync to Exchange Rates' }}
        </BaseButton>
      </div>
    </div>

    <section class="module-panel">
      <div class="module-panel-header ext-rates-header">
        <div class="ext-rates-meta">
          <h3>Roohaforex Rates</h3>
          <span v-if="lastFetchedAt" class="ext-rates-fetched-at">
            Last fetched: {{ formatDateTime(lastFetchedAt) }}
          </span>
        </div>
        <input
          v-model="search"
          class="ui-input ext-rates-search"
          placeholder="Search currency…"
          aria-label="Search external rates"
        />
      </div>

      <!-- Success banner -->
      <div v-if="successMessage" class="module-alert module-alert--success" role="status">
        <div class="module-alert__content">
          <strong>Done.</strong>
          <span>{{ successMessage }}</span>
        </div>
        <button type="button" class="module-alert__close" aria-label="Close" @click="successMessage = ''">×</button>
      </div>

      <!-- Error banner -->
      <div v-if="errorMessage" class="module-alert" role="alert">
        <div class="module-alert__content">
          <strong>Error.</strong>
          <span>{{ errorMessage }}</span>
        </div>
        <button type="button" class="module-alert__close" aria-label="Close" @click="errorMessage = ''">×</button>
      </div>

      <p v-if="loading || syncing || importing" class="module-description ext-rates-state">
        {{ importing ? 'Syncing rates to exchange rate model…' : syncing ? 'Fetching latest rates from Roohaforex…' : 'Loading…' }}
      </p>

      <div v-else class="module-table-wrap">
        <table class="module-table ext-rates-table">
          <thead>
            <tr>
              <th>Currency</th>
              <th>Effective date</th>
              <th>Buy (ETB)</th>
              <th>Sell (ETB)</th>
              <th>Service charge</th>
              <th>Fetched at</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rows" :key="row.id ?? i">
              <td>
                <div class="ext-rate-currency">
                  <img
                    v-if="currencyFlagUrl(row.currency)"
                    :src="currencyFlagUrl(row.currency)"
                    :alt="`${row.currency?.code ?? 'Currency'} flag`"
                    class="ext-rate-flag"
                    loading="lazy"
                    @error="$event.target.style.display='none'"
                  />
                  <span v-else class="ext-rate-flag-placeholder" aria-hidden="true">
                    {{ (row.currency?.code ?? '?').slice(0, 2) }}
                  </span>
                  <div class="ext-rate-currency-copy">
                    <strong>{{ row.currency?.code ?? '—' }}</strong>
                    <small>{{ row.currency?.name ?? '' }}</small>
                  </div>
                </div>
              </td>
              <td>{{ formatDate(row.effective_date) }}</td>
              <td class="ext-rate-num">{{ formatRate(row.buy_rate) }}</td>
              <td class="ext-rate-num">{{ formatRate(row.sell_rate) }}</td>
              <td class="ext-rate-num">
                {{ row.service_charge_value != null ? formatRate(row.service_charge_value) + '%' : '—' }}
              </td>
              <td>{{ formatDateTime(row.fetched_at) }}</td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="6" class="ext-rates-state">No external rates found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="module-table-footer">
        Showing {{ rows.length }} currency{{ rows.length === 1 ? '' : 'ies' }} · Source: Roohaforex
      </div>
    </section>
  </section>
</template>

<style scoped>
.ext-rates-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.ext-rates-header { align-items:center; gap:16px; flex-wrap:wrap; }
.ext-rates-meta { display:flex; flex-direction:column; gap:4px; }
.ext-rates-fetched-at { font-size:.75rem; color:var(--text-muted,#778196); }
.ext-rates-search { max-width:260px; min-width:180px; }
.ext-rates-table { min-width:780px; }
.ext-rate-currency { display:flex; align-items:center; gap:10px; min-width:150px; }
.ext-rate-flag,
.ext-rate-flag-placeholder { width:38px; height:27px; flex:0 0 38px; border-radius:5px; object-fit:cover; border:1px solid #e3e8f0; background:#f1f4f8; }
.ext-rate-flag-placeholder { display:flex; align-items:center; justify-content:center; color:#59677c; font-size:.65rem; font-weight:800; }
.ext-rate-currency-copy { display:flex; flex-direction:column; gap:3px; min-width:0; }
.ext-rate-currency-copy strong { color:var(--text-primary,#263449); font-size:.88rem; }
.ext-rate-currency-copy small { color:var(--text-muted,#778196); font-size:.75rem; }
.ext-rate-num { font-variant-numeric:tabular-nums; }
.ext-rates-state { padding:24px; text-align:center; color:var(--text-muted,#778196); }
.module-alert--success { background:#e6f6ed; border-color:#a3d9b8; color:#1a5c38; }
.module-alert--success .module-alert__content strong { color:#1a5c38; }
</style>

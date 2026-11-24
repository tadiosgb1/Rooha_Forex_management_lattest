<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { rateService } from '../../services/rateService'

const amount = ref(100)
const fromCurrency = ref('USD')
const toCurrency = ref('ETB')
const transactionType = ref('sell')
const rates = ref([])
const loading = ref(false)
const errorMessage = ref('')

const ETB = 'ETB'

async function loadRates() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await rateService.latest()
    const value = res?.data ?? res
    rates.value = Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : []
  } catch (err) {
    errorMessage.value = err?.message || 'Unable to load exchange rates.'
  } finally {
    loading.value = false
  }
}

const foreignCurrencies = computed(() =>
  rates.value
    .map(r => ({ code: r.currency?.code ?? '', name: r.currency?.name ?? '', flag_url: r.currency?.flag_url ?? '' }))
    .filter(c => c.code && c.code !== ETB)
)

// Keep from/to in sync — if both are foreign or both ETB, auto-correct
watch(fromCurrency, (val) => { if (val !== ETB && toCurrency.value !== ETB) toCurrency.value = ETB })
watch(toCurrency, (val) => { if (val !== ETB && fromCurrency.value !== ETB) fromCurrency.value = ETB })

const foreignCode = computed(() => fromCurrency.value !== ETB ? fromCurrency.value : toCurrency.value)

const activeRate = computed(() =>
  rates.value.find(r => r.currency?.code === foreignCode.value) ?? null
)

const calc = computed(() => {
  const amt = Number(amount.value)
  if (!amt || amt <= 0 || !activeRate.value) return null

  const buyRate = Number(activeRate.value.buy_rate)
  const sellRate = Number(activeRate.value.sell_rate)

  // transactionType = 'sell' → customer sells foreign → bureau buys → use buy_rate
  // transactionType = 'buy'  → customer buys foreign → bureau sells → use sell_rate
  const isFromForeign = fromCurrency.value !== ETB
  const rate = transactionType.value === 'sell'
    ? (isFromForeign ? buyRate : sellRate)
    : (isFromForeign ? sellRate : buyRate)

  const converted = isFromForeign ? amt * rate : amt / rate
  const toCode = isFromForeign ? ETB : foreignCode.value

  return {
    fromCode: fromCurrency.value,
    toCode,
    rate,
    buyRate,
    sellRate,
    amount: amt,
    converted,
    currencyName: activeRate.value.currency?.name ?? foreignCode.value,
  }
})

function fmt(v, d = 2) {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
}

function swap() {
  const tmp = fromCurrency.value
  fromCurrency.value = toCurrency.value
  toCurrency.value = tmp
}

function reset() {
  amount.value = 100
  fromCurrency.value = 'USD'
  toCurrency.value = 'ETB'
  transactionType.value = 'sell'
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
function flagUrl(path) {
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path)) return path
  return `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

onMounted(loadRates)
</script>

<template>
  <section class="module-page calc-page">
    <!-- Page header -->
    <div class="module-page-intro">
      <div>
        <h2>Currency Calculator</h2>
        <p class="module-description">Calculate exchange rates instantly. Get transparent pricing for your currency transactions based on today's live rates.</p>
      </div>
      <button class="calc-refresh-btn" @click="loadRates" :disabled="loading">
        {{ loading ? 'Loading…' : '↻ Refresh rates' }}
      </button>
    </div>

    <div v-if="errorMessage" class="module-alert" role="alert">
      <div class="module-alert__content"><strong>Error.</strong><span>{{ errorMessage }}</span></div>
      <button class="module-alert__close" @click="errorMessage = ''">×</button>
    </div>

    <div class="calc-layout">
      <!-- ── INPUT CARD ───────────────────────────────────────── -->
      <div class="calc-card calc-inputs-card">
        <div class="calc-card-title">Exchange Calculator</div>

        <!-- Amount -->
        <div class="calc-field-group">
          <label class="calc-label" for="calc-amount">Amount</label>
          <div class="calc-amount-wrap">
            <span class="calc-amount-prefix">{{ fromCurrency }}</span>
            <input
              id="calc-amount"
              v-model.number="amount"
              type="number"
              min="0"
              step="any"
              class="calc-amount-input"
              placeholder="0.00"
            />
          </div>
        </div>

        <!-- From / Swap / To -->
        <div class="calc-currency-row">
          <div class="calc-field-group calc-currency-field">
            <label class="calc-label">From Currency</label>
            <select v-model="fromCurrency" class="calc-select">
              <option value="ETB">ETB — Ethiopian Birr</option>
              <option v-for="c in foreignCurrencies" :key="c.code" :value="c.code">
                {{ c.code }} — {{ c.name }}
              </option>
            </select>
          </div>

          <button class="calc-swap-btn" type="button" @click="swap" title="Swap currencies">
            ⇄
          </button>

          <div class="calc-field-group calc-currency-field">
            <label class="calc-label">To Currency</label>
            <select v-model="toCurrency" class="calc-select">
              <option value="ETB">ETB — Ethiopian Birr</option>
              <option v-for="c in foreignCurrencies" :key="c.code" :value="c.code">
                {{ c.code }} — {{ c.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Transaction type -->
        <div class="calc-field-group">
          <label class="calc-label">Transaction Type</label>
          <div class="calc-type-toggle">
            <button
              type="button"
              :class="['calc-type-btn', { active: transactionType === 'sell' }]"
              @click="transactionType = 'sell'"
            >
              <span class="calc-type-icon">↑</span>
              <span>I want to sell</span>
            </button>
            <button
              type="button"
              :class="['calc-type-btn', { active: transactionType === 'buy' }]"
              @click="transactionType = 'buy'"
            >
              <span class="calc-type-icon">↓</span>
              <span>I want to buy</span>
            </button>
          </div>
        </div>

        <button class="calc-reset-btn" type="button" @click="reset">Reset</button>
      </div>

      <!-- ── RESULT CARD ──────────────────────────────────────── -->
      <div class="calc-card calc-result-card">
        <div class="calc-card-title">Conversion Result</div>

        <div v-if="loading" class="calc-state">Loading live rates…</div>
        <div v-else-if="!activeRate" class="calc-state">No active rate found for this currency pair.</div>

        <template v-else-if="calc">
          <!-- Big result -->
          <div class="calc-result-hero">
            <div class="calc-result-from">{{ fmt(calc.amount) }} {{ calc.fromCode }}</div>
            <div class="calc-result-equals">=</div>
            <div class="calc-result-to">{{ fmt(calc.converted) }} {{ calc.toCode }}</div>
            <div class="calc-result-rate">
              1 {{ calc.fromCode !== ETB ? calc.fromCode : calc.toCode }} =
              {{ fmt(calc.rate, 4) }} {{ calc.fromCode !== ETB ? ETB : calc.fromCode }}
            </div>
          </div>

          <!-- Details table -->
          <div class="calc-details">
            <div class="calc-details-heading">Transaction Details</div>
            <div class="calc-detail-row">
              <span>Amount</span>
              <strong>{{ fmt(calc.amount) }} {{ calc.fromCode }}</strong>
            </div>
            <div class="calc-detail-row">
              <span>From</span>
              <strong>{{ calc.fromCode }}</strong>
            </div>
            <div class="calc-detail-row">
              <span>To</span>
              <strong>{{ calc.toCode }}</strong>
            </div>
            <div class="calc-detail-row">
              <span>Exchange Rate</span>
              <strong>
                1 {{ calc.fromCode !== ETB ? calc.fromCode : calc.toCode }} =
                {{ fmt(calc.rate, 4) }} {{ calc.fromCode !== ETB ? ETB : calc.fromCode }}
              </strong>
            </div>
            <div class="calc-detail-row">
              <span>Base Amount</span>
              <strong>{{ fmt(calc.converted) }} {{ calc.toCode }}</strong>
            </div>
            <div class="calc-detail-row calc-detail-total">
              <span>Total you receive</span>
              <strong>{{ fmt(calc.converted) }} {{ calc.toCode }}</strong>
            </div>
          </div>
        </template>

        <div v-else class="calc-state">Enter an amount to see the conversion.</div>
      </div>

      <!-- ── RATES REFERENCE TABLE ───────────────────────────── -->
      <div class="calc-card calc-rates-ref-card">
        <div class="calc-card-title">Today's Live Rates</div>
        <div v-if="loading" class="calc-state">Loading…</div>
        <div v-else-if="!rates.length" class="calc-state">No rates available.</div>
        <table v-else class="calc-rates-table">
          <thead>
            <tr>
              <th>Currency</th>
              <th>Buy (ETB)</th>
              <th>Sell (ETB)</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rates"
              :key="r.id"
              :class="{ 'calc-rates-row-active': r.currency?.code === foreignCode }"
              @click="fromCurrency = r.currency?.code !== ETB ? r.currency?.code : fromCurrency; toCurrency = ETB"
              style="cursor:pointer"
            >
              <td>
                <div class="calc-rate-currency">
                  <img
                    v-if="flagUrl(r.currency?.flag_url)"
                    :src="flagUrl(r.currency?.flag_url)"
                    :alt="r.currency?.code"
                    class="calc-flag"
                    @error="$event.target.style.display='none'"
                  />
                  <span v-else class="calc-flag-placeholder">{{ (r.currency?.code ?? '?').slice(0,2) }}</span>
                  <div>
                    <strong>{{ r.currency?.code }}</strong>
                    <small>{{ r.currency?.name }}</small>
                  </div>
                </div>
              </td>
              <td class="calc-num">{{ fmt(r.buy_rate, 4) }}</td>
              <td class="calc-num">{{ fmt(r.sell_rate, 4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.calc-page { max-width: 1100px; }

.calc-refresh-btn {
  padding: 8px 18px;
  border: 1px solid var(--border, #d1d9e6);
  border-radius: 8px;
  background: var(--surface-primary, #fff);
  color: var(--text-muted, #778196);
  font-size: .84rem;
  cursor: pointer;
  white-space: nowrap;
}
.calc-refresh-btn:hover:not(:disabled) { background: var(--surface-secondary, #f4f6fb); }

/* Layout */
.calc-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  grid-template-rows: auto auto;
  gap: 20px;
  align-items: start;
}
.calc-inputs-card  { grid-column: 1; grid-row: 1; }
.calc-result-card  { grid-column: 2; grid-row: 1; }
.calc-rates-ref-card { grid-column: 1 / -1; grid-row: 2; }

/* Card base */
.calc-card {
  background: var(--surface-primary, #fff);
  border: 1px solid var(--border, #e3e8f0);
  border-radius: 12px;
  padding: 24px;
}
.calc-card-title {
  font-size: .78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted, #778196);
  margin-bottom: 20px;
}

/* Fields */
.calc-field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.calc-label { font-size: .78rem; font-weight: 600; color: var(--text-muted, #778196); }

.calc-amount-wrap {
  display: flex;
  align-items: center;
  border: 1.5px solid var(--border, #d1d9e6);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-primary, #fff);
}
.calc-amount-prefix {
  padding: 0 14px;
  font-size: .88rem;
  font-weight: 700;
  color: var(--text-primary, #263449);
  background: var(--surface-secondary, #f4f6fb);
  border-right: 1px solid var(--border, #d1d9e6);
  height: 44px;
  display: flex;
  align-items: center;
  min-width: 56px;
}
.calc-amount-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 0 14px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary, #263449);
  background: transparent;
  height: 44px;
}

/* Currency row */
.calc-currency-row { display: flex; align-items: flex-end; gap: 10px; margin-bottom: 18px; }
.calc-currency-field { flex: 1; margin-bottom: 0; }
.calc-select {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--border, #d1d9e6);
  border-radius: 8px;
  font-size: .84rem;
  color: var(--text-primary, #263449);
  background: var(--surface-primary, #fff);
}
.calc-swap-btn {
  width: 38px;
  height: 42px;
  border: 1.5px solid var(--border, #d1d9e6);
  border-radius: 8px;
  background: var(--surface-secondary, #f4f6fb);
  font-size: 1.1rem;
  cursor: pointer;
  flex-shrink: 0;
  color: var(--text-primary, #263449);
}
.calc-swap-btn:hover { background: var(--primary, #3b6fe0); color: #fff; border-color: var(--primary, #3b6fe0); }

/* Transaction type */
.calc-type-toggle { display: flex; gap: 10px; }
.calc-type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1.5px solid var(--border, #d1d9e6);
  border-radius: 8px;
  background: var(--surface-secondary, #f4f6fb);
  color: var(--text-muted, #778196);
  font-size: .84rem;
  cursor: pointer;
  transition: all .15s;
}
.calc-type-btn.active {
  background: var(--primary, #3b6fe0);
  border-color: var(--primary, #3b6fe0);
  color: #fff;
  font-weight: 600;
}
.calc-type-icon { font-size: 1rem; }

.calc-reset-btn {
  margin-top: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border, #d1d9e6);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #778196);
  font-size: .84rem;
  cursor: pointer;
}
.calc-reset-btn:hover { background: var(--surface-secondary, #f4f6fb); }

/* Result hero */
.calc-result-hero {
  text-align: center;
  padding: 28px 20px;
  background: linear-gradient(135deg, #f0f5ff 0%, #e8f2ff 100%);
  border-radius: 10px;
  margin-bottom: 24px;
}
.calc-result-from { font-size: 1rem; color: var(--text-muted, #778196); margin-bottom: 4px; }
.calc-result-equals { font-size: 1.4rem; color: var(--text-muted, #778196); margin: 4px 0; }
.calc-result-to { font-size: 2rem; font-weight: 800; color: var(--primary, #3b6fe0); line-height: 1.1; }
.calc-result-rate { margin-top: 10px; font-size: .82rem; color: var(--text-muted, #778196); }

/* Details */
.calc-details { border: 1px solid var(--border, #e3e8f0); border-radius: 10px; overflow: hidden; }
.calc-details-heading {
  padding: 10px 16px;
  font-weight: 700;
  font-size: .82rem;
  color: var(--text-primary, #263449);
  background: var(--surface-secondary, #f4f6fb);
  border-bottom: 1px solid var(--border, #e3e8f0);
}
.calc-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border, #edf0f5);
  font-size: .84rem;
}
.calc-detail-row span { color: var(--text-muted, #778196); }
.calc-detail-row strong { color: var(--text-primary, #263449); font-weight: 600; }
.calc-detail-total {
  background: var(--surface-secondary, #f4f6fb);
  border-bottom: none;
}
.calc-detail-total span { font-weight: 700; color: var(--text-primary, #263449); }
.calc-detail-total strong { color: var(--primary, #3b6fe0); font-size: .95rem; }

/* Rates reference table */
.calc-rates-table { width: 100%; border-collapse: collapse; }
.calc-rates-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: .75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--text-muted, #778196);
  border-bottom: 2px solid var(--border, #e3e8f0);
}
.calc-rates-table td { padding: 10px 14px; border-bottom: 1px solid var(--border, #edf0f5); font-size: .84rem; }
.calc-rates-row-active td { background: #eef3ff; }
.calc-rate-currency { display: flex; align-items: center; gap: 10px; }
.calc-flag { width: 32px; height: 22px; border-radius: 4px; object-fit: cover; border: 1px solid #e3e8f0; }
.calc-flag-placeholder { width: 32px; height: 22px; border-radius: 4px; background: #e3e8f0; display: flex; align-items: center; justify-content: center; font-size: .65rem; font-weight: 800; color: #778196; }
.calc-rate-currency div { display: flex; flex-direction: column; gap: 2px; }
.calc-rate-currency strong { font-size: .84rem; color: var(--text-primary, #263449); }
.calc-rate-currency small { font-size: .73rem; color: var(--text-muted, #778196); }
.calc-num { font-variant-numeric: tabular-nums; color: var(--text-primary, #263449); font-weight: 500; }

.calc-state { padding: 32px; text-align: center; color: var(--text-muted, #778196); font-size: .84rem; }

@media (max-width: 860px) {
  .calc-layout { grid-template-columns: 1fr; }
  .calc-inputs-card  { grid-column: 1; grid-row: 1; }
  .calc-result-card  { grid-column: 1; grid-row: 2; }
  .calc-rates-ref-card { grid-column: 1; grid-row: 3; }
}
</style>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { rateService } from '../services/rateService'

const amount = ref(100)
const fromCurrency = ref('USD')
const toCurrency = ref('ETB')
const transactionType = ref('sell') // 'sell' = customer sells foreign, 'buy' = customer buys foreign
const rates = ref([])
const loading = ref(false)

const ETB_CODE = 'ETB'

async function loadRates() {
  loading.value = true
  try {
    const res = await rateService.latest()
    const value = res?.data ?? res
    rates.value = Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : []
  } catch {
    rates.value = []
  } finally {
    loading.value = false
  }
}

// All foreign currency codes from loaded rates
const foreignCurrencies = computed(() =>
  rates.value.map(r => ({
    code: r.currency?.code ?? '',
    name: r.currency?.name ?? '',
  })).filter(c => c.code && c.code !== ETB_CODE)
)

// The active rate for the selected foreign currency
const activeRate = computed(() => {
  const foreignCode = fromCurrency.value === ETB_CODE ? toCurrency.value : fromCurrency.value
  return rates.value.find(r => r.currency?.code === foreignCode) ?? null
})

const result = computed(() => {
  const amt = Number(amount.value)
  if (!amt || !activeRate.value) return null

  const buy = Number(activeRate.value.buy_rate)
  const sell = Number(activeRate.value.sell_rate)

  // "I want to sell" = customer sells foreign currency → bureau buys at buy_rate
  // "I want to buy"  = customer buys foreign currency → bureau sells at sell_rate
  let rate, baseAmount, description

  if (fromCurrency.value !== ETB_CODE) {
    // Foreign → ETB
    rate = transactionType.value === 'sell' ? buy : sell
    baseAmount = amt * rate
    description = transactionType.value === 'sell'
      ? `You sell ${amt} ${fromCurrency.value}, receive ETB`
      : `You buy ${amt} ${fromCurrency.value}, pay ETB`
  } else {
    // ETB → Foreign
    rate = transactionType.value === 'sell' ? sell : buy
    baseAmount = amt / rate
    description = transactionType.value === 'sell'
      ? `You sell ${amt} ETB, receive ${toCurrency.value}`
      : `You buy ETB with ${toCurrency.value}`
  }

  return {
    rate,
    baseAmount,
    description,
    fromCode: fromCurrency.value,
    toCode: fromCurrency.value !== ETB_CODE ? ETB_CODE : toCurrency.value,
  }
})

function formatNum(v, decimals = 2) {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function reset() {
  amount.value = 100
  fromCurrency.value = 'USD'
  toCurrency.value = 'ETB'
  transactionType.value = 'sell'
}

onMounted(loadRates)
</script>

<template>
  <aside class="calc-panel">
    <div class="calc-header">
      <span class="calc-icon">⇄</span>
      <div>
        <strong class="calc-title">Currency Calculator</strong>
        <p class="calc-subtitle">Calculate exchange rates and fees instantly.</p>
      </div>
    </div>

    <div class="calc-body">
      <!-- Amount -->
      <label class="calc-field">
        <span class="calc-label">Amount</span>
        <input
          v-model.number="amount"
          type="number"
          min="0"
          step="any"
          class="calc-input"
          placeholder="Enter amount"
        />
      </label>

      <!-- From Currency -->
      <label class="calc-field">
        <span class="calc-label">From Currency</span>
        <select v-model="fromCurrency" class="calc-input">
          <option value="ETB">ETB — Ethiopian Birr</option>
          <option v-for="c in foreignCurrencies" :key="c.code" :value="c.code">
            {{ c.code }} — {{ c.name }}
          </option>
        </select>
      </label>

      <!-- To Currency -->
      <label class="calc-field">
        <span class="calc-label">To Currency</span>
        <select v-model="toCurrency" class="calc-input">
          <option value="ETB">ETB — Ethiopian Birr</option>
          <option v-for="c in foreignCurrencies" :key="c.code" :value="c.code">
            {{ c.code }} — {{ c.name }}
          </option>
        </select>
      </label>

      <!-- Transaction Type -->
      <div class="calc-field">
        <span class="calc-label">Transaction Type</span>
        <div class="calc-toggle">
          <button
            type="button"
            class="calc-toggle-btn"
            :class="{ active: transactionType === 'sell' }"
            @click="transactionType = 'sell'"
          >I want to sell</button>
          <button
            type="button"
            class="calc-toggle-btn"
            :class="{ active: transactionType === 'buy' }"
            @click="transactionType = 'buy'"
          >I want to buy</button>
        </div>
      </div>

      <button type="button" class="calc-reset" @click="reset">Reset</button>

      <!-- Result -->
      <div v-if="loading" class="calc-result-box calc-loading">Loading rates…</div>

      <div v-else-if="result" class="calc-result-box">
        <div class="calc-result-main">
          <span class="calc-result-from">{{ formatNum(amount) }} {{ result.fromCode }}</span>
          <span class="calc-result-eq">=</span>
          <span class="calc-result-to">{{ formatNum(result.baseAmount) }} {{ result.toCode }}</span>
        </div>

        <div class="calc-details">
          <div class="calc-details-title">Transaction Details</div>
          <div class="calc-detail-row"><span>Amount</span><span>{{ formatNum(amount) }} {{ result.fromCode }}</span></div>
          <div class="calc-detail-row"><span>From</span><span>{{ result.fromCode }}</span></div>
          <div class="calc-detail-row"><span>To</span><span>{{ result.toCode }}</span></div>
          <div class="calc-detail-row">
            <span>Exchange Rate</span>
            <span>
              1 {{ result.fromCode !== 'ETB' ? result.fromCode : result.toCode }} =
              {{ formatNum(result.rate, 4) }} {{ result.fromCode !== 'ETB' ? 'ETB' : result.fromCode }}
            </span>
          </div>
          <div class="calc-detail-row"><span>Base Amount</span><span>{{ formatNum(result.baseAmount) }} {{ result.toCode }}</span></div>
          <div class="calc-detail-row calc-total"><span>Total you receive</span><span>{{ formatNum(result.baseAmount) }} {{ result.toCode }}</span></div>
        </div>
      </div>

      <div v-else-if="!loading && !activeRate" class="calc-result-box calc-no-rate">
        No active rate found for selected currency.
      </div>
    </div>
  </aside>
</template>

<style scoped>
.calc-panel {
  margin: 12px 8px 0;
  background: var(--surface-secondary, #f4f6fb);
  border: 1px solid var(--border, #e3e8f0);
  border-radius: 10px;
  overflow: hidden;
  font-size: .82rem;
}
.calc-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px 10px;
  background: var(--surface-primary, #fff);
  border-bottom: 1px solid var(--border, #e3e8f0);
}
.calc-icon { font-size: 1.1rem; margin-top: 2px; }
.calc-title { display: block; font-size: .84rem; font-weight: 700; color: var(--text-primary, #263449); }
.calc-subtitle { margin: 2px 0 0; font-size: .73rem; color: var(--text-muted, #778196); line-height: 1.3; }
.calc-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.calc-field { display: flex; flex-direction: column; gap: 4px; }
.calc-label { font-size: .73rem; font-weight: 600; color: var(--text-muted, #778196); text-transform: uppercase; letter-spacing: .03em; }
.calc-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border, #d1d9e6);
  border-radius: 6px;
  font-size: .82rem;
  background: var(--surface-primary, #fff);
  color: var(--text-primary, #263449);
  box-sizing: border-box;
}
.calc-input:focus { outline: none; border-color: var(--primary, #3b6fe0); }
.calc-toggle { display: flex; gap: 6px; }
.calc-toggle-btn {
  flex: 1;
  padding: 6px 4px;
  border: 1px solid var(--border, #d1d9e6);
  border-radius: 6px;
  background: var(--surface-primary, #fff);
  color: var(--text-muted, #778196);
  font-size: .78rem;
  cursor: pointer;
  transition: all .15s;
}
.calc-toggle-btn.active {
  background: var(--primary, #3b6fe0);
  border-color: var(--primary, #3b6fe0);
  color: #fff;
  font-weight: 600;
}
.calc-reset {
  align-self: flex-end;
  padding: 4px 12px;
  border: 1px solid var(--border, #d1d9e6);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #778196);
  font-size: .78rem;
  cursor: pointer;
}
.calc-reset:hover { background: var(--surface-secondary, #f4f6fb); }
.calc-result-box {
  background: var(--surface-primary, #fff);
  border: 1px solid var(--border, #e3e8f0);
  border-radius: 8px;
  padding: 12px;
}
.calc-loading, .calc-no-rate { color: var(--text-muted, #778196); text-align: center; padding: 16px; }
.calc-result-main {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border, #e3e8f0);
}
.calc-result-from { font-size: .88rem; color: var(--text-muted, #778196); }
.calc-result-eq { font-size: .88rem; color: var(--text-muted, #778196); }
.calc-result-to { font-size: 1.1rem; font-weight: 700; color: var(--text-primary, #263449); }
.calc-details-title { font-weight: 700; color: var(--text-primary, #263449); margin-bottom: 6px; font-size: .8rem; }
.calc-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  color: var(--text-muted, #778196);
  font-size: .78rem;
  border-bottom: 1px dashed var(--border, #edf0f5);
}
.calc-detail-row span:last-child { font-weight: 600; color: var(--text-primary, #263449); text-align: right; }
.calc-total { margin-top: 4px; border-bottom: none; }
.calc-total span { font-weight: 700 !important; color: var(--primary, #3b6fe0) !important; font-size: .82rem !important; }
</style>

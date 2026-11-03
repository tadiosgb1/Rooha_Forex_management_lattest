<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasPermission } from '../../utils/permissions'
import { getBranch } from '../../services/branchService'
import BaseButton from '../../components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const branch = ref(null)
const loading = ref(false)
const errorMessage = ref('')

const branchTitle = computed(() =>
  branch.value?.branch_name || branch.value?.branch_code || 'Branch details'
)

const statusClass = computed(() => {
  const status = String(branch.value?.status || '').toLowerCase()
  if (['approved', 'active'].includes(status)) return 'status-positive'
  if (['rejected', 'inactive', 'suspended'].includes(status)) return 'status-negative'
  return 'status-neutral'
})

const sections = computed(() => [
  {
    title: 'Branch information',
    description: 'Identification and location',
    fields: [
      { label: 'Branch name', value: branch.value?.branch_name },
      { label: 'Branch code', value: branch.value?.branch_code },
      { label: 'Location', value: branch.value?.location || branch.value?.address, wide: true },
    ],
  },
  {
    title: 'Contact details',
    description: 'How to reach this branch',
    fields: [
      { label: 'Primary phone', value: branch.value?.phone_primary || branch.value?.phone },
      { label: 'Secondary phone', value: branch.value?.phone_secondary },
      { label: 'Email address', value: branch.value?.email },
    ],
  },
  {
    title: 'Operating hours',
    description: 'Branch business schedule',
    fields: [
      { label: 'Working hours', value: branch.value?.working_hours, wide: true },
    ],
  },
])

function displayValue(value) {
  return value === null || value === undefined || String(value).trim() === '' ? 'Not provided' : value
}

async function loadBranch() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await getBranch(route.params.id)
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('The server returned an unexpected branch response.')
    }
    branch.value = result
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load branch details.'
  } finally {
    loading.value = false
  }
}

onMounted(loadBranch)
</script>

<template>
  <section class="module-page branch-detail-page">
    <header class="page-heading">
      <div class="heading-copy">
        <p class="eyebrow">BRANCH MANAGEMENT</p>
        <h2>Branch details</h2>
        <p class="module-description">View branch information, contact details and operating hours.</p>
      </div>
      <div class="heading-actions">
        <BaseButton variant="secondary" @click="router.push('/branches')">Back to branches</BaseButton>
        <BaseButton
          v-if="branch && hasPermission('branches:update')"
          @click="router.push('/branches/' + encodeURIComponent(route.params.id) + '/edit')"
        >
          Edit branch
        </BaseButton>
      </div>
    </header>

    <div v-if="loading" class="loading-card" aria-live="polite">
      <span class="loading-spinner" />
      <span>Loading branch information…</span>
    </div>

    <section v-else-if="errorMessage" class="feedback-card error-card" role="alert">
      <div>
        <h3>Unable to load branch</h3>
        <p>{{ errorMessage }}</p>
      </div>
      <BaseButton variant="secondary" @click="loadBranch">Try again</BaseButton>
    </section>

    <template v-else-if="branch">
      <section class="branch-summary">
        <div class="summary-main">
          <div class="branch-avatar" aria-hidden="true">{{ (branch.branch_name || branch.branch_code || 'B').slice(0, 1).toUpperCase() }}</div>
          <div class="summary-copy">
            <p class="summary-label">BRANCH PROFILE</p>
            <h3>{{ branchTitle }}</h3>
            <p class="branch-code">{{ displayValue(branch.branch_code) }}</p>
          </div>
        </div>
        <span class="status-pill" :class="statusClass">
          <span class="status-dot" />
          {{ displayValue(branch.status) }}
        </span>
      </section>

      <section v-for="section in sections" :key="section.title" class="details-card">
        <div class="details-card-heading">
          <div>
            <h3>{{ section.title }}</h3>
            <p>{{ section.description }}</p>
          </div>
        </div>
        <dl class="details-grid">
          <div
            v-for="field in section.fields"
            :key="field.label"
            class="detail-item"
            :class="{ 'detail-item-wide': field.wide }"
          >
            <dt>{{ field.label }}</dt>
            <dd>{{ displayValue(field.value) }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </section>
</template>

<style scoped>
.branch-detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.heading-copy h2 {
  margin: 0 0 6px;
}

.eyebrow,
.summary-label {
  margin: 0 0 7px;
  color: var(--text-muted, #778196);
  font-size: .7rem;
  font-weight: 750;
  letter-spacing: .09em;
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
}

.branch-summary,
.details-card,
.loading-card,
.feedback-card {
  border: 1px solid var(--border-color, #e5e9f0);
  border-radius: 14px;
  background: var(--surface, #fff);
}

.branch-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
}

.summary-main {
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 0;
}

.branch-avatar {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  flex: 0 0 50px;
  border-radius: 13px;
  background: var(--primary-soft, #edf3ff);
  color: var(--primary, #315fbd);
  font-size: 1.2rem;
  font-weight: 750;
}

.summary-copy {
  min-width: 0;
}

.summary-copy h3 {
  margin: 0 0 4px;
  font-size: 1.15rem;
  overflow-wrap: anywhere;
}

.branch-code {
  margin: 0;
  color: var(--text-muted, #778196);
  font-size: .86rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  padding: 7px 11px;
  border-radius: 999px;
  font-size: .78rem;
  font-weight: 700;
  text-transform: capitalize;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.status-positive {
  color: #18794e;
  background: #eaf7ef;
}

.status-negative {
  color: #b42318;
  background: #fff0ee;
}

.status-neutral {
  color: var(--text-muted, #667085);
  background: var(--surface-muted, #f1f3f6);
}

.details-card {
  overflow: hidden;
}

.details-card-heading {
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--border-color, #e5e9f0);
}

.details-card-heading h3 {
  margin: 0 0 4px;
  font-size: .98rem;
}

.details-card-heading p {
  margin: 0;
  color: var(--text-muted, #778196);
  font-size: .82rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  padding: 4px 22px;
}

.detail-item {
  min-width: 0;
  padding: 15px 12px 15px 0;
  border-bottom: 1px solid var(--border-color, #edf0f4);
}

.detail-item:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.detail-item-wide {
  grid-column: 1 / -1;
}

.detail-item dt {
  margin-bottom: 6px;
  color: var(--text-muted, #778196);
  font-size: .78rem;
}

.detail-item dd {
  margin: 0;
  color: var(--text-primary, #202939);
  font-size: .92rem;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.loading-card,
.feedback-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px;
}

.loading-card {
  justify-content: flex-start;
  color: var(--text-muted, #778196);
}

.loading-spinner {
  width: 17px;
  height: 17px;
  border: 2px solid var(--border-color, #dce2ea);
  border-top-color: var(--primary, #315fbd);
  border-radius: 50%;
  animation: branch-spin .8s linear infinite;
}

.error-card h3 {
  margin: 0 0 5px;
  font-size: .95rem;
}

.error-card p {
  margin: 0;
  color: var(--text-muted, #778196);
  font-size: .86rem;
}

@keyframes branch-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .branch-summary {
    align-items: flex-start;
    flex-direction: column;
    padding: 18px;
  }

  .details-grid {
    grid-template-columns: minmax(0, 1fr);
    padding: 4px 18px;
  }

  .detail-item,
  .detail-item:nth-last-child(-n + 2) {
    border-bottom: 1px solid var(--border-color, #edf0f4);
  }

  .detail-item:last-child {
    border-bottom: 0;
  }

  .loading-card,
  .feedback-card {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

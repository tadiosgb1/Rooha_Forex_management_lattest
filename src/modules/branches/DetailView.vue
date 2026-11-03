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
const fields = computed(() => [
  ['branch_code', 'Branch code'],
  ['branch_name', 'Branch name'],
  ['location', 'Location'],
  ['phone_primary', 'Primary phone'],
  ['phone_secondary', 'Secondary phone'],
  ['email', 'Email'],
  ['working_hours', 'Working hours'],
  ['status', 'Status'],
])
onMounted(async () => {
  loading.value = true
  try {
    branch.value = await getBranch(route.params.id)
    if (!branch.value || typeof branch.value !== 'object' || Array.isArray(branch.value)) throw new Error('The server returned an unexpected branch response.')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load branch details.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Branch details</h2><p class="module-description">Branch contact information, operating hours, and approval status.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <BaseButton variant="secondary" @click="router.push('/branches')">← Back to branches</BaseButton>
        <BaseButton v-if="branch && hasPermission('branches:update')" @click="router.push('/branches/' + encodeURIComponent(route.params.id) + '/edit')">Edit Branch</BaseButton>
      </div>
    </div>
    <p v-if="loading" class="module-description">Loading branch…</p>
    <section v-else-if="errorMessage" class="module-panel" style="padding:24px" role="alert">{{ errorMessage }}</section>
    <section v-else-if="branch" class="module-panel">
      <div class="module-panel-header"><h3>{{ branch.branch_name || branch.branch_code }}</h3><strong>{{ branch.status || '—' }}</strong></div>
      <dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:20px;padding:8px 24px 24px;margin:0">
        <div v-for="field in fields" :key="field[0]"><dt style="color:var(--text-muted,#778196);font-size:.78rem;margin-bottom:6px">{{ field[1] }}</dt><dd style="margin:0;font-weight:650;overflow-wrap:anywhere">{{ branch[field[0]] ?? (field[0] === 'location' ? branch.address : field[0] === 'phone_primary' ? branch.phone : null) ?? '—' }}</dd></div>
      </dl>
    </section>
  </section>
</template>

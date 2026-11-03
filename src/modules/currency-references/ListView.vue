<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref } from 'vue'
import { confirmAction } from '../../composables/confirmAction'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'
const router = useRouter(), rows = ref([]), loading = ref(false), errorMessage = ref(''), successMessage = ref(''), search = ref('')
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
function resolveFlagUrl(url) { if (!url) return ''; if (/^(https?:)?\/\//i.test(url) || /^(data|blob):/i.test(url)) return url; return `${apiBaseUrl}/${String(url).replace(/^\/+/, '')}` }
const currentPage = ref(1), totalPages = ref(1), totalCount = ref(0), pageSize = ref(10), nextPageUrl = ref(null), previousPageUrl = ref(null)
const filteredRows = computed(() => { const q = search.value.trim().toLowerCase(); return q ? rows.value.filter(r => [r.code, r.name, r.symbol].some(v => String(v ?? '').toLowerCase().includes(q))) : rows.value })
async function loadRows(page = currentPage.value) {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await referenceCurrencyService.list({ page, page_size: pageSize.value })
    rows.value = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
    currentPage.value = Number(res?.current_page || page)
    totalPages.value = Math.max(1, Number(res?.total_pages || 1))
    totalCount.value = Number(res?.count ?? rows.value.length)
    pageSize.value = Number(res?.page_size || pageSize.value)
    nextPageUrl.value = res?.next || null
    previousPageUrl.value = res?.previous || null
  } catch (e) { errorMessage.value = e?.message || 'Unable to load reference currencies.' }
  finally { loading.value = false }
}
function dismissError() { errorMessage.value = '' }
function dismissSuccess() { successMessage.value = '' }
function goToPage(page) {
  if (loading.value || page < 1 || page > totalPages.value || page === currentPage.value) return
  loadRows(page)
}
async function removeRow(row) {
  errorMessage.value = ''
  successMessage.value = ''
  const confirmed = await confirmAction({ title: 'Delete currency', message: `Delete currency "${row.code}"? This action cannot be undone.` })
  if (!confirmed) return
  try {
    await referenceCurrencyService.remove(row.id)
    successMessage.value = 'Currency deleted.'
    await loadRows(rows.value.length === 1 && currentPage.value > 1 ? currentPage.value - 1 : currentPage.value)
  } catch (e) { errorMessage.value = e?.message || 'Unable to delete currency.' }
}
onMounted(() => loadRows(1))
</script>
<template><section class="module-page"><div class="module-page-intro"><div><h2>Reference Currencies</h2><p class="module-description">Manage supported currencies, symbols, flags, and base-currency settings.</p></div><BaseButton v-if="hasPermission('reference-currencies:create')" @click="router.push('/reference-currencies/new')">＋ Add Currency</BaseButton></div>
<div v-if="successMessage" class="module-alert module-alert--success" role="status" aria-live="polite"><div class="module-alert__content"><span>{{ successMessage }}</span></div><button type="button" class="module-alert__close" aria-label="Close success alert" @click="dismissSuccess">×</button></div><div v-if="errorMessage" class="module-alert" role="alert" aria-live="assertive"><div class="module-alert__content"><strong>Unable to complete action.</strong><span>{{ errorMessage }}</span></div><button type="button" class="module-alert__close" aria-label="Close error alert" @click="dismissError">×</button></div>
<section class="module-panel"><div class="module-panel-header"><h3>Currency register</h3><label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search currencies…" size="sm" /></label></div><div class="module-table-wrap"><table class="module-table"><thead><tr><th>Currency</th><th>Code</th><th>Symbol</th><th>Base currency</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr v-if="loading"><td colspan="6" class="module-empty-state">Loading currencies…</td></tr><tr v-else-if="!filteredRows.length"><td colspan="6" class="module-empty-state">No currencies found.</td></tr><tr v-for="row in filteredRows" :key="row.id"><td><div style="display:flex;align-items:center;gap:10px"><img v-if="row.flag_url" :src="resolveFlagUrl(row.flag_url)" :alt="`${row.name} flag`" style="width:32px;height:22px;object-fit:cover;border-radius:3px;border:1px solid var(--border-color,#e5e7eb)" @error="$event.target.style.display='none'"><div><strong>{{ row.name }}</strong><div class="module-description">{{ row.code }}</div></div></div></td><td><strong>{{ row.code }}</strong></td><td>{{ row.symbol || '—' }}</td><td><span class="module-status-chip" :class="row.is_base_currency ? 'active' : 'blocked'">{{ row.is_base_currency ? 'Yes' : 'No' }}</span></td><td><span class="module-status-chip" :class="row.is_active ? 'active' : 'blocked'">{{ row.is_active ? 'Active' : 'Inactive' }}</span></td><td class="module-row-actions"><button v-if="hasPermission('reference-currencies:update')" @click="router.push(`/reference-currencies/${encodeURIComponent(row.id)}/edit`)">Edit</button><button v-if="hasPermission('reference-currencies:delete')" class="module-delete-action" @click="removeRow(row)">Delete</button></td></tr></tbody></table></div><div class="module-table-footer" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><span>Showing {{ filteredRows.length }} of {{ totalCount }} currencies · Page {{ currentPage }} of {{ totalPages }}</span><div style="display:flex;align-items:center;gap:8px"><BaseButton variant="secondary" :disabled="loading || !previousPageUrl || currentPage <= 1" @click="goToPage(currentPage - 1)">← Previous</BaseButton><BaseButton variant="secondary" :disabled="loading || !nextPageUrl || currentPage >= totalPages" @click="goToPage(currentPage + 1)">Next →</BaseButton></div></div></section></section></template>

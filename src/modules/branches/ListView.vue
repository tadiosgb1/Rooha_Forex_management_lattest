<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref, watch } from 'vue'
import { confirmAction } from '../../composables/confirmAction'
import { useRouter } from 'vue-router'
import { listBranches, deleteBranch } from '../../services/branchService'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'

const router = useRouter()
const branches = ref([])
const search = ref('')
const loading = ref(false)
const deletingId = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const currentPage = ref(1)
const pageSize = 10
const totalCount = ref(0)
const totalPages = ref(1)

const visibleBranches = computed(() => branches.value)

async function loadBranches() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await listBranches({
      page: currentPage.value,
      pageSize,
      search: search.value,
      sortBy: 'created_at',
    })
    branches.value = response.data
    totalCount.value = Number(response.count ?? response.data.length)
    totalPages.value = Math.max(1, Number(response.total_pages ?? 1))
    currentPage.value = Number(response.current_page ?? currentPage.value)
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load branches.'
    branches.value = []
  } finally {
    loading.value = false
  }
}

function changePage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === currentPage.value) return
  currentPage.value = nextPage
}

async function removeBranch(branch) {
  const id = branch.id
  if (id === undefined || id === null || deletingId.value !== null) return
  const name = branch.branch_name || branch.branch_code || `branch #${id}`
  const confirmed = await confirmAction({ title: 'Delete branch', message: `Delete ${name}? This action cannot be undone.` })
 if (!confirmed) return

  deletingId.value = id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await deleteBranch(id)
    successMessage.value = `${name} was deleted.`
    await loadBranches()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to delete this branch.'
  } finally {
    deletingId.value = null
  }
}

watch(currentPage, loadBranches)
watch(search, () => {
  if (currentPage.value === 1) loadBranches()
  else currentPage.value = 1
})
onMounted(loadBranches)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Branches</h2><p class="module-description">Manage branches using the branch service.</p></div>
      <BaseButton v-if="hasPermission('branches:create')" class="module-primary-btn" @click="router.push('/branches/new')">＋ Add Branch</BaseButton>
    </div>
    <div class="module-stat-row">
      <div class="module-stat-card"><span>Total branches</span><strong>{{ totalCount }}</strong></div>
      <div class="module-stat-card"><span>Branches on this page</span><strong>{{ branches.length }}</strong></div>
      <div class="module-stat-card"><span>Page</span><strong>{{ currentPage }} / {{ totalPages }}</strong></div>
    </div>
    <section class="module-panel">
      <div class="module-panel-header">
        <h3>Branch register</h3>
        <label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search code or branch name..." aria-label="Search branches" size="sm" /></label>
      </div>
      <p v-if="errorMessage" class="module-description" role="alert" style="padding: 12px 20px; color: #b43f4a;">{{ errorMessage }}</p>
      <p v-if="successMessage" class="module-description" role="status" style="padding: 12px 20px; color: #167344;">{{ successMessage }}</p>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead><tr><th>Branch code</th><th>Branch name</th><th>Location</th><th>Phone numbers</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="6" class="module-empty-state">Loading branches…</td></tr>
            <tr v-else-if="visibleBranches.length === 0"><td colspan="6" class="module-empty-state">{{ search ? 'No branches match your search.' : 'No branches found.' }}</td></tr>
            <tr v-for="branch in visibleBranches" :key="branch.id">
              <td>{{ branch.branch_code || '—' }}</td>
              <td>{{ branch.branch_name || '—' }}</td>
              <td>{{ branch.location || branch.address || '—' }}</td>
              <td>
                <div style="display:flex;flex-direction:column;gap:4px;">
                  <span>{{ branch.phone_primary || branch.phone || '—' }}</span>
                  <span v-if="branch.phone_secondary" class="module-description">{{ branch.phone_secondary }}</span>
                </div>
              </td>
              <td><span class="module-status-chip" :class="String(branch.status || (branch.is_active ? 'APPROVED' : 'INACTIVE')).toLowerCase()">{{ branch.status || (branch.is_active ? 'APPROVED' : 'INACTIVE') }}</span></td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;white-space:nowrap;">
                  <BaseButton variant="secondary" size="sm" @click="router.push(`/branches/${branch.id}`)">View</BaseButton>
                  <BaseButton v-if="hasPermission('branches:update')" variant="secondary" size="sm" :disabled="deletingId !== null" @click="router.push(`/branches/${branch.id}/edit`)">Edit</BaseButton>
                  <BaseButton v-if="hasPermission('branches:delete')" variant="danger" size="sm" :disabled="deletingId !== null" @click="removeBranch(branch)">{{ deletingId === branch.id ? 'Deleting…' : 'Delete' }}</BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer">
        <span>Showing {{ branches.length }} of {{ totalCount }} branches</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <BaseButton variant="secondary" size="sm" :disabled="loading || currentPage <= 1" @click="changePage(currentPage - 1)">Previous</BaseButton>
          <span>Page {{ currentPage }} of {{ totalPages }}</span>
          <BaseButton variant="secondary" size="sm" :disabled="loading || currentPage >= totalPages" @click="changePage(currentPage + 1)">Next</BaseButton>
        </div>
      </div>
    </section>
  </section>
</template>

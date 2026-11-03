<script setup>
import { hasPermission } from '../../utils/permissions'
import { computed, onMounted, ref, watch } from 'vue'
import { confirmAction } from '../../composables/confirmAction'
import { useRouter } from 'vue-router'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import { permissionService } from '../../services/permissionService'

const router = useRouter()
const rows = ref([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const currentPage = ref(1)
const pageSize = ref(5)
const totalCount = ref(0)
const totalPages = ref(1)
const hasNextPage = ref(false)
const pageSizes = [5, 10, 20, 50, 100, 1000]

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q
    ? rows.value.filter(row =>
        [row.name, row.codename, row.content_type, row.id]
          .some(value => String(value ?? '').toLowerCase().includes(q)),
      )
    : rows.value
})

async function loadRows() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await permissionService.list({
      page: currentPage.value,
      page_size: pageSize.value,
    })
    const data = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response?.results)
          ? response.results
          : Array.isArray(response)
            ? response
            : []
    rows.value = data

    const count = Number(response?.count ?? response?.total ?? response?.pagination?.total)
    totalCount.value = Number.isFinite(count) && count >= 0 ? count : data.length
    const pages = Number(response?.total_pages ?? response?.pagination?.total_pages)
    totalPages.value = Number.isFinite(pages) && pages > 0
      ? pages
      : Math.max(1, Math.ceil(totalCount.value / pageSize.value))
    currentPage.value = Number(response?.current_page ?? response?.pagination?.current_page ?? currentPage.value)
    hasNextPage.value = response?.next != null
      ? Boolean(response.next)
      : currentPage.value < totalPages.value
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load permissions.'
    rows.value = []
    totalCount.value = 0
    totalPages.value = 1
    hasNextPage.value = false
  } finally {
    loading.value = false
  }
}

function changePage(nextPage) {
  if (nextPage < 1 || nextPage === currentPage.value || (nextPage > currentPage.value && !hasNextPage.value)) return
  if (nextPage > totalPages.value && !hasNextPage.value) return
  currentPage.value = nextPage
}

function changePageSize(value) {
  const nextSize = Number(value)
  if (!pageSizes.includes(nextSize) || nextSize === pageSize.value) return
  pageSize.value = nextSize
  currentPage.value = 1
}

async function removeRow(row) {
  const confirmed = await confirmAction({
    title: 'Delete permission',
    message: `Delete permission "${row.name}"? This action cannot be undone.`,
  })
  if (!confirmed) return

  errorMessage.value = ''
  successMessage.value = ''
  try {
    await permissionService.remove(row.id)
    successMessage.value = 'Permission deleted successfully.'
    if (rows.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
    else await loadRows()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to delete permission.'
  }
}

watch([currentPage, pageSize], loadRows)
onMounted(loadRows)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div>
        <h2>Permissions</h2>
        <p class="module-description">View and manage permission records.</p>
      </div>
      <BaseButton v-if="hasPermission('permissions:create')" @click="router.push('/permissions/new')">＋ Add Permission</BaseButton>
    </div>

    <p v-if="errorMessage" role="alert" style="color:#b43f4a;margin-bottom:12px">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status" style="color:var(--brand-base-color);margin-bottom:12px">{{ successMessage }}</p>

    <section class="module-panel">
      <div class="module-panel-header">
        <h3>Permission register</h3>
        <label class="module-search">
          <span>⌕</span>
          <BaseInput v-model="search" placeholder="Search permissions…" size="sm" />
        </label>
      </div>
      <div class="module-table-wrap">
        <table class="module-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Codename</th><th>Content type</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="5" class="module-empty-state">Loading…</td></tr>
            <tr v-else-if="!filteredRows.length"><td colspan="5" class="module-empty-state">No permissions found.</td></tr>
            <tr v-for="row in filteredRows" :key="row.id">
              <td>{{ row.id }}</td>
              <td><strong>{{ row.name }}</strong></td>
              <td><code>{{ row.codename }}</code></td>
              <td>{{ row.content_type }}</td>
              <td class="module-row-actions">
                </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="module-table-footer permissions-table-footer">
        <span>Showing {{ filteredRows.length }} of {{ totalCount }} permissions</span>
        <div class="permissions-pagination">
          <label class="permissions-page-size">
            <span>Rows per page</span>
            <select :value="pageSize" :disabled="loading" @change="changePageSize($event.target.value)">
              <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}</option>
            </select>
          </label>
          <BaseButton variant="secondary" size="sm" :disabled="loading || currentPage <= 1" @click="changePage(currentPage - 1)">Previous</BaseButton>
          <span class="permissions-page-number">Page {{ currentPage }} of {{ totalPages }}</span>
          <BaseButton variant="secondary" size="sm" :disabled="loading || !hasNextPage" @click="changePage(currentPage + 1)">Next</BaseButton>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.permissions-table-footer { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap; }
.permissions-pagination { display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap; }
.permissions-page-size { display:flex;align-items:center;gap:8px;color:var(--text-muted,#667085);font-size:.82rem; }
.permissions-page-size select { min-height:34px;padding:5px 9px;border:1px solid var(--border-color,#d0d5dd);border-radius:7px;background:var(--surface,#fff);color:inherit; }
.permissions-page-number { white-space:nowrap;color:var(--text-muted,#667085);font-size:.84rem; }
@media (max-width: 680px) {
  .permissions-table-footer,.permissions-pagination { align-items:stretch;justify-content:flex-start; }
  .permissions-pagination { width:100%; }
}
</style>

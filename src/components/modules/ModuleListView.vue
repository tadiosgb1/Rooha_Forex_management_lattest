<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useModulesStore } from '../../stores/modules'
import BaseButton from '../ui/BaseButton.vue'
import BaseBadge from '../ui/BaseBadge.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseStatCard from '../ui/BaseStatCard.vue'
import BaseCard from '../ui/BaseCard.vue'
import BaseTable from '../ui/BaseTable.vue'
import { hasModulePermission } from '../../utils/permissions'
import BaseModal from '../ui/BaseModal.vue'
const props = defineProps({ moduleKey: { type: String, required: true }, title: { type: String, required: true }, singular: { type: String, required: true }, fields: { type: Array, required: true }, description: { type: String, default: '' } })
const store = useModulesStore()
const router = useRouter()
const canCreate = computed(() => hasModulePermission(props.moduleKey, 'create'))
const canUpdate = computed(() => hasModulePermission(props.moduleKey, 'update'))
const canDelete = computed(() => hasModulePermission(props.moduleKey, 'delete'))
const search = ref('')
const deleteDialogOpen = ref(false)
const rowToDelete = ref(null)
const tableColumns = computed(() => props.fields.map(([key, label]) => ({ key, label })))
const rows = computed(() => { const q = search.value.trim().toLowerCase(); return store.list(props.moduleKey).filter((row) => !q || Object.values(row).some((value) => String(value).toLowerCase().includes(q))) })
function openRecord(row) { router.push(`/${props.moduleKey}/${encodeURIComponent(row.id)}`) }
function removeRecord(row) { rowToDelete.value = row; deleteDialogOpen.value = true }
function confirmDelete() { if (rowToDelete.value) store.remove(props.moduleKey, rowToDelete.value.id); deleteDialogOpen.value = false; rowToDelete.value = null }
function cancelDelete() { deleteDialogOpen.value = false; rowToDelete.value = null }
</script>
<template>
  <section class="module-page">
    <div class="module-page-intro"><h2>{{ title }}</h2><BaseButton v-if="canCreate" class="module-primary-btn" @click="router.push('/' + moduleKey + '/new')"><span>＋</span> Add {{ singular }}</BaseButton></div>
    <div class="module-stat-row"><BaseStatCard class="module-stat-card" label="Total records" :value="store.list(moduleKey).length" /><BaseStatCard class="module-stat-card" label="Matching records" :value="rows.length" /><BaseStatCard class="module-stat-card" label="Environment" value="Demo" value-class="module-stat-status" /></div>
    <BaseCard as="section" class="module-panel"><div class="module-panel-header"><h3>{{ singular }} register</h3><label class="module-search"><span>⌕</span><BaseInput v-model="search" placeholder="Search records..." aria-label="Search records" size="sm" /></label></div>
      <BaseTable :columns="tableColumns" :rows="rows" row-key="id" wrapper-class="module-table-wrap" table-class="module-table" actions-header-class="module-actions-head" actions-cell-class="module-row-actions" empty-title="No records found" empty-message="">
        <template #cell="{ row, column, value }">
          <BaseBadge v-if="column.key === 'status' || column.key === 'kycStatus'" tone="neutral" class="module-status-chip" :class="String(value).toLowerCase().replaceAll(' ', '-')">{{ value ?? '—' }}</BaseBadge>
          <span v-else>{{ value ?? '—' }}</span>
        </template>
        <template #actions="{ row }">
          <BaseButton variant="ghost" size="sm" @click="openRecord(row)">View</BaseButton>
          <BaseButton v-if="canUpdate" variant="ghost" size="sm" @click="router.push('/' + moduleKey + '/' + encodeURIComponent(row.id) + '/edit')">Edit</BaseButton>
          <BaseButton v-if="canDelete" variant="danger" size="sm" class="module-delete-action" @click="removeRecord(row)">Delete</BaseButton>
        </template>
      </BaseTable>
      <div class="module-table-footer">Showing {{ rows.length }} of {{ store.list(moduleKey).length }} records</div>
    </BaseCard>
    <BaseModal v-model="deleteDialogOpen" title="Delete record" size="sm" @close="cancelDelete">
      <p v-if="rowToDelete">Delete {{ singular.toLowerCase() }} {{ rowToDelete.id }}? This action cannot be undone.</p>
      <template #footer>
        <BaseButton variant="secondary" @click="cancelDelete">Cancel</BaseButton>
        <BaseButton variant="danger" @click="confirmDelete">Delete</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>
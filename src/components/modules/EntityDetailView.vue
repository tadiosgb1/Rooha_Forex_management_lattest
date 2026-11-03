<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useModulesStore } from '../../stores/modules'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import BaseEmptyState from '../ui/BaseEmptyState.vue'
import { hasModulePermission } from '../../utils/permissions'
const props = defineProps({ moduleKey: String, title: String, singular: String, fields: Array })
const store = useModulesStore()
const route = useRoute()
const router = useRouter()
const record = computed(() => store.get(props.moduleKey, route.params.id))
const canUpdate = computed(() => hasModulePermission(props.moduleKey, 'update'))
function edit() { router.push('/' + props.moduleKey + '/' + encodeURIComponent(route.params.id) + '/edit') }
</script>
<template>
  <section class="module-page"><div class="module-page-intro"><h2>{{ singular }} details</h2><div class="module-inline-actions"><BaseButton variant="secondary" class="module-secondary-btn" @click="router.push('/' + moduleKey)">← Back</BaseButton><BaseButton v-if="record && canUpdate" class="module-primary-btn" @click="edit">Edit</BaseButton></div></div>
    <BaseCard v-if="record" as="section" class="module-panel module-detail-panel"><div class="module-panel-header"><h3>{{ record.name || record.customer || record.reference || record.caseId || record.id }}</h3><span class="module-record-id">ID: {{ record.id }}</span></div><dl class="module-detail-grid"><div v-for="field in fields" :key="field[0]" class="module-detail-item"><dt>{{ field[1] }}</dt><dd>{{ record[field[0]] ?? '—' }}</dd></div></dl></BaseCard>
    <BaseCard v-else as="section" class="module-panel module-not-found"><BaseEmptyState title="Record not found" description="This record may have been removed or the link may be incorrect." icon="!"><BaseButton class="module-primary-btn" @click="router.push('/' + moduleKey)">Return to list</BaseButton></BaseEmptyState></BaseCard>
  </section>
</template>
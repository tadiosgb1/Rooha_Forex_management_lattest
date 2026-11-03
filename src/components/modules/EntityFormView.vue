<script setup>
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useModulesStore } from '../../stores/modules'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseTextarea from '../ui/BaseTextarea.vue'
import BaseCard from '../ui/BaseCard.vue'
import { hasModulePermission } from '../../utils/permissions'
const props = defineProps({ moduleKey: String, title: String, singular: String, fields: Array, mode: { type: String, default: 'create' } })
const store = useModulesStore()
const route = useRoute()
const router = useRouter()
const form = reactive({})
const isEdit = computed(() => props.mode === 'edit')
const recordId = computed(() => String(route.params.id || ''))
const canSave = computed(() => hasModulePermission(props.moduleKey, isEdit.value ? 'update' : 'create'))
function fillForm() {
  Object.keys(form).forEach((key) => delete form[key])
  const existing = isEdit.value ? store.get(props.moduleKey, recordId.value) : null
  for (const [key] of props.fields) form[key] = existing?.[key] ?? ''
}
watch(() => [props.moduleKey, props.mode, route.params.id], fillForm, { immediate: true })
function save() {
  if (!canSave.value) return
  const payload = { ...form }
  if (isEdit.value) store.update(props.moduleKey, recordId.value, payload)
  else store.create(props.moduleKey, payload)
  router.push('/' + props.moduleKey)
}
function cancel() { router.push(isEdit.value ? '/' + props.moduleKey + '/' + encodeURIComponent(recordId.value) : '/' + props.moduleKey) }
</script>
<template>
  <section class="module-page"><div class="module-page-intro"><h2>{{ isEdit ? 'Edit ' + singular : 'Create ' + singular }}</h2><BaseButton variant="secondary" class="module-secondary-btn" @click="cancel">← Cancel</BaseButton></div>
    <BaseCard as="form" class="module-panel module-form-panel" @submit.prevent="save"><div class="module-panel-header"><h3>{{ singular }} information</h3><span v-if="isEdit" class="module-record-id">ID: {{ recordId }}</span></div>
      <div class="module-form-grid">
        <div v-for="field in fields" :key="field[0]" class="module-form-field">
          <BaseTextarea v-if="['condition', 'reason', 'alert'].includes(field[0])" v-model="form[field[0]]" :label="field[1]" :id="'field-' + field[0]" rows="3" required />
          <BaseInput v-else v-model="form[field[0]]" :label="field[1]" :id="'field-' + field[0]" :type="/(amount|rate|debit|credit|expected|counted|variance|cost|priority|remaining|acquired)/i.test(field[0]) ? 'number' : 'text'" required />
        </div>
      </div>
      <div class="module-form-footer"><span v-if="!canSave" role="alert">You do not have permission to save this record.</span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" @click="cancel">Cancel</BaseButton><BaseButton v-if="canSave" type="submit" class="module-primary-btn">{{ isEdit ? 'Save changes' : 'Create ' + singular }}</BaseButton></div></div>
    </BaseCard>
  </section>
</template>
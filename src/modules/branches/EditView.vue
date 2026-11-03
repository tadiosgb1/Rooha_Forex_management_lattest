<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../../composables/toast'
import { getBranch, updateBranch } from '../../services/branchService'
import BaseButton from '../../components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const form = reactive({
  branch_code: '',
  branch_name: '',
  location: '',
  phone_primary: '',
  phone_secondary: '',
  email: '',
  working_hours: '',
  status: 'APPROVED',
})

async function loadBranch() {
  loading.value = true
  errorMessage.value = ''
  try {
    const branch = await getBranch(route.params.id)
    if (!branch || typeof branch !== 'object' || Array.isArray(branch)) throw new Error('The server returned an unexpected branch response.')
    form.branch_code = branch.branch_code ?? ''
    form.branch_name = branch.branch_name ?? ''
    form.location = branch.location ?? branch.address ?? ''
    form.phone_primary = branch.phone_primary ?? branch.phone ?? ''
    form.phone_secondary = branch.phone_secondary ?? ''
    form.email = branch.email ?? ''
    form.working_hours = branch.working_hours ?? ''
    form.status = branch.status ?? (branch.is_active === false ? 'INACTIVE' : 'APPROVED')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load this branch.'
  } finally {
    loading.value = false
  }
}

async function saveBranch() {
  if (saving.value || loading.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await updateBranch(route.params.id, {
      branch_code: form.branch_code.trim(),
      branch_name: form.branch_name.trim(),
      location: form.location.trim(),
      phone_primary: form.phone_primary.trim(),
      phone_secondary: form.phone_secondary.trim() || null,
      email: form.email.trim(),
      working_hours: form.working_hours.trim(),
      status: form.status,
    })
    toast.success('Branch updated successfully.')
    router.push('/branches')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to update this branch. Please try again.'
  } finally {
    saving.value = false
  }
}
onMounted(loadBranch)
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Edit Branch</h2><p class="module-description">Update branch contact details, working hours, and approval status.</p></div>
      <BaseButton variant="secondary" class="module-secondary-btn" :disabled="saving" @click="router.push('/branches')">← Back to branches</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Branch information</h3></div>
      <p v-if="loading" class="module-description" style="padding:16px 24px">Loading branch…</p>
      <form v-else @submit.prevent="saveBranch">
        <div class="module-form-grid">
          <label class="module-form-field"><span>Branch code *</span><input v-model="form.branch_code" class="ui-input" required /></label>
          <label class="module-form-field"><span>Branch name *</span><input v-model="form.branch_name" class="ui-input" required /></label>
          <label class="module-form-field"><span>Location *</span><input v-model="form.location" class="ui-input" required /></label>
          <label class="module-form-field"><span>Primary phone *</span><input v-model="form.phone_primary" class="ui-input" type="tel" required /></label>
          <label class="module-form-field"><span>Secondary phone</span><input v-model="form.phone_secondary" class="ui-input" type="tel" /></label>
          <label class="module-form-field"><span>Email *</span><input v-model="form.email" class="ui-input" type="email" required /></label>
          <label class="module-form-field"><span>Working hours *</span><input v-model="form.working_hours" class="ui-input" required /></label>
          <label class="module-form-field"><span>Status *</span><select v-model="form.status" class="ui-input" required><option value="APPROVED">Approved</option><option value="PENDING">Pending</option><option value="REJECTED">Rejected</option><option value="INACTIVE">Inactive</option></select></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer"><span>Fields marked * are required.</span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" :disabled="saving" @click="router.push('/branches')">Cancel</BaseButton><BaseButton type="submit" class="module-primary-btn" :disabled="saving">{{ saving ? 'Saving…' : 'Save Changes' }}</BaseButton></div></div>
      </form>
    </section>
  </section>
</template>

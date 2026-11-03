<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '../../composables/toast'
import { createBranch } from '../../services/branchService'
import BaseButton from '../../components/ui/BaseButton.vue'

const router = useRouter()
const toast = useToast()
const loading = ref(false)
const errorMessage = ref('')
const form = reactive({
  branch_code: 'BR001',
  branch_name: 'Head Office - Addis Ababa',
  location: 'Bole Road, Addis Ababa, Ethiopia',
  phone_primary: '+251115517847',
  phone_secondary: '+251911223344',
  email: 'headoffice@example.com',
  working_hours: 'Monday-Friday: 08:00-17:00',
  status: 'APPROVED',
})

async function submitBranch() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    await createBranch({
      branch_code: form.branch_code.trim(),
      branch_name: form.branch_name.trim(),
      location: form.location.trim(),
      phone_primary: form.phone_primary.trim(),
      phone_secondary: form.phone_secondary.trim() || null,
      email: form.email.trim(),
      working_hours: form.working_hours.trim(),
      status: form.status,
    })
    toast.success('Branch created successfully.')
    router.push('/branches')
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to create branch. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="module-page">
    <div class="module-page-intro">
      <div><h2>Create Branch</h2><p class="module-description">Add a branch and configure its contact details, working hours, and approval status.</p></div>
      <BaseButton variant="secondary" class="module-secondary-btn" @click="router.push('/branches')">← Back to branches</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Branch information</h3></div>
      <form @submit.prevent="submitBranch">
        <div class="module-form-grid">
          <label class="module-form-field"><span>Branch code *</span><input v-model="form.branch_code" class="ui-input" placeholder="BR001" required /></label>
          <label class="module-form-field"><span>Branch name *</span><input v-model="form.branch_name" class="ui-input" placeholder="Head Office - Addis Ababa" required /></label>
          <label class="module-form-field"><span>Location *</span><input v-model="form.location" class="ui-input" placeholder="Bole Road, Addis Ababa, Ethiopia" required /></label>
          <label class="module-form-field"><span>Primary phone *</span><input v-model="form.phone_primary" class="ui-input" type="tel" placeholder="+251115517847" required /></label>
          <label class="module-form-field"><span>Secondary phone</span><input v-model="form.phone_secondary" class="ui-input" type="tel" placeholder="+251911223344" /></label>
          <label class="module-form-field"><span>Email *</span><input v-model="form.email" class="ui-input" type="email" placeholder="headoffice@example.com" required /></label>
          <label class="module-form-field"><span>Working hours *</span><input v-model="form.working_hours" class="ui-input" placeholder="Monday-Friday: 08:00-17:00" required /></label>
          <label class="module-form-field"><span>Status *</span><select v-model="form.status" class="ui-input" required><option value="APPROVED">Approved</option><option value="PENDING">Pending</option><option value="REJECTED">Rejected</option><option value="INACTIVE">Inactive</option></select></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin:0 24px 16px;color:#b43f4a">{{ errorMessage }}</p>
        <div class="module-form-footer"><span>Fields marked * are required.</span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" :disabled="loading" @click="router.push('/branches')">Cancel</BaseButton><BaseButton type="submit" class="module-primary-btn" :disabled="loading">{{ loading ? 'Creating…' : 'Create Branch' }}</BaseButton></div></div>
      </form>
    </section>
  </section>
</template>

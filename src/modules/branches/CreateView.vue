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
  branch_code: '',
  branch_name: '',
  address: '',
  phone: '',
})

async function submitBranch() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    await createBranch({
      branch_code: form.branch_code.trim(),
      branch_name: form.branch_name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
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
      <div><h2>Create Branch</h2><p class="module-description">Add a branch using the branch service fields.</p></div>
      <BaseButton variant="secondary" class="module-secondary-btn" @click="router.push('/branches')">← Back to branches</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Branch information</h3></div>
      <form @submit.prevent="submitBranch">
        <div class="module-form-grid">
          <label class="module-form-field"><span>Branch code <b>*</b></span><input v-model="form.branch_code" class="ui-input" placeholder="BR001" required /></label>
          <label class="module-form-field"><span>Branch name <b>*</b></span><input v-model="form.branch_name" class="ui-input" placeholder="Head Office - Addis Ababa" required /></label>
          <label class="module-form-field"><span>Address <b>*</b></span><input v-model="form.address" class="ui-input" placeholder="Plot No. 123, Bole Road, Addis Ababa, Ethiopia" required /></label>
          <label class="module-form-field"><span>Phone <b>*</b></span><input v-model="form.phone" class="ui-input" type="tel" placeholder="+251115517847" required /></label>
        </div>
        <p v-if="errorMessage" role="alert" style="margin: 0 24px 16px; color: #b43f4a; font-size: 12px;">{{ errorMessage }}</p>
        <div class="module-form-footer">
          <span></span>
          <div>
            <BaseButton type="button" variant="secondary" class="module-secondary-btn" :disabled="loading" @click="router.push('/branches')">Cancel</BaseButton>
            <BaseButton type="submit" class="module-primary-btn" :disabled="loading">{{ loading ? 'Creating…' : 'Create Branch' }}</BaseButton>
          </div>
        </div>
      </form>
    </section>
  </section>
</template>

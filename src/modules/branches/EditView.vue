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
  address: '',
  phone: '',
})

async function loadBranch() {
  loading.value = true
  errorMessage.value = ''
  try {
    const branch = await getBranch(route.params.id)
    if (!branch || typeof branch !== 'object' || Array.isArray(branch)) {
      throw new Error('The server returned an unexpected branch response.')
    }
    form.branch_code = branch.branch_code ?? ''
    form.branch_name = branch.branch_name ?? ''
    form.address = branch.address ?? ''
    form.phone = branch.phone ?? ''
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
      address: form.address.trim(),
      phone: form.phone.trim(),
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
      <div><h2>Edit Branch</h2><p class="module-description">Update branch information.</p></div>
      <BaseButton variant="secondary" class="module-secondary-btn" :disabled="saving" @click="router.push('/branches')">← Back to branches</BaseButton>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Branch information</h3></div>
      <p v-if="loading" class="module-description" style="padding: 16px 24px;">Loading branch…</p>
      <form v-else @submit.prevent="saveBranch">
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
            <BaseButton type="button" variant="secondary" class="module-secondary-btn" :disabled="saving" @click="router.push('/branches')">Cancel</BaseButton>
            <BaseButton type="submit" class="module-primary-btn" :disabled="saving">{{ saving ? 'Saving…' : 'Save Changes' }}</BaseButton>
          </div>
        </div>
      </form>
    </section>
  </section>
</template>

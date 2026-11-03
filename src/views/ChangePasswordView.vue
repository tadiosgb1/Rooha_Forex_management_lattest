<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseAlert from '../components/ui/BaseAlert.vue'
import BaseInput from '../components/ui/BaseInput.vue'
const appStore = useAppStore()
const router = useRouter()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const message = ref('')
function savePassword() {
  message.value = ''
  if (currentPassword.value !== appStore.loginPassword) { message.value = 'Current password is incorrect.'; return }
  if (newPassword.value.length < 6) { message.value = 'Use at least 6 characters.'; return }
  if (newPassword.value !== confirmPassword.value) { message.value = 'Passwords do not match.'; return }
  appStore.loginPassword = newPassword.value
  message.value = 'Password updated for this demo session.'
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}
</script>
<template>
  <section class="module-page">
    <div class="module-page-intro"><h2>Change password</h2></div>
    <form class="module-panel account-password-form" @submit.prevent="savePassword">
      <div class="module-form-field"><BaseInput v-model="currentPassword" label="Current password" type="password" required /></div>
      <div class="module-form-field"><BaseInput v-model="newPassword" label="New password" type="password" minlength="6" required /></div>
      <div class="module-form-field"><BaseInput v-model="confirmPassword" label="Confirm new password" type="password" minlength="6" required /></div>
      <BaseAlert v-if="message" :tone="message.startsWith('Password updated') ? 'success' : 'danger'">{{ message }}</BaseAlert>
      <div class="module-form-footer"><span></span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" @click="router.push('/')">Cancel</BaseButton><BaseButton type="submit" class="module-primary-btn">Update password</BaseButton></div></div>
    </form>
  </section>
</template>
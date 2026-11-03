<script setup>
import BaseButton from './ui/BaseButton.vue'
import BaseModal from './ui/BaseModal.vue'
import { confirmDialogState, settleConfirmAction } from '../composables/confirmAction'
</script>

<template>
  <BaseModal v-model="confirmDialogState.open" :title="confirmDialogState.title" size="sm" @close="settleConfirmAction(false)">
    <div class="confirm-dialog-content">
      <span class="confirm-dialog-icon" :class="`confirm-dialog-icon--${confirmDialogState.confirmVariant}`" aria-hidden="true">!</span>
      <p>{{ confirmDialogState.message }}</p>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="settleConfirmAction(false)">{{ confirmDialogState.cancelText }}</BaseButton>
      <BaseButton :variant="confirmDialogState.confirmVariant" @click="settleConfirmAction(true)">{{ confirmDialogState.confirmText }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm-dialog-content { display: flex; align-items: flex-start; gap: 13px; color: var(--text-color, #374151); line-height: 1.6; }
.confirm-dialog-content p { margin: 2px 0 0; }
.confirm-dialog-icon { display: grid; place-items: center; flex: 0 0 34px; width: 34px; height: 34px; border-radius: 50%; font-size: 20px; font-weight: 800; }
.confirm-dialog-icon--danger { background: #fff0f0; color: #c83b48; }
.confirm-dialog-icon--primary { background: #eaf2ff; color: #245ec7; }
.confirm-dialog-icon--secondary { background: #f3f4f6; color: #4b5563; }
</style>

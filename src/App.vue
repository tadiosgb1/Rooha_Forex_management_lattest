<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import router from './router'
import { latestToastId, useToast } from './composables/toast'
import AppLayout from './components/AppLayout.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import ToastHost from './components/ui/ToastHost.vue'
import './modular.css'
import './dark-mode.css'
import { useSystemConfigStore } from './stores/systemConfig'
const systemConfig = useSystemConfigStore()
const toast = useToast()
let pendingFormSubmit = null
let removeToastRouteHook = null
function trackModuleFormSubmit(event) {
  const form = event.target
  if (!(form instanceof HTMLFormElement) || !form.closest('.module-page')) return
  pendingFormSubmit = { path: route.fullPath, lastToastId: latestToastId.value, expires: Date.now() + 10000 }
}
onMounted(() => {
  systemConfig.loadConfig()
  document.addEventListener('submit', trackModuleFormSubmit, true)
  removeToastRouteHook = router.afterEach((to, from) => {
    const pending = pendingFormSubmit
    if (!pending) return
    pendingFormSubmit = null
    if (Date.now() > pending.expires || from.fullPath !== pending.path || to.fullPath === from.fullPath) return
    // Forms that already raised a specific success/error toast do not need a duplicate.
    if (latestToastId.value <= pending.lastToastId) toast.success('Changes saved successfully.')
  })
})
onBeforeUnmount(() => {
  document.removeEventListener('submit', trackModuleFormSubmit, true)
  removeToastRouteHook?.()
})
const route = useRoute()
const isPublic = computed(() => route.meta.public)
</script>
<template><RouterView v-if="isPublic" /><AppLayout v-else /><ConfirmDialog /><ToastHost /></template>

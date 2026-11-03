import { reactive, ref, watch } from 'vue'

let nextId = 1
const toasts = reactive([])
export const latestToastId = ref(0)
const timers = new Map()

function dismissToast(id) {
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
  const index = toasts.findIndex(toast => toast.id === id)
  if (index !== -1) toasts.splice(index, 1)
}

function showToast(type, message, duration = 2600) {
  const text = String(message ?? '').trim()
  if (!text) return null
  const id = nextId++
  latestToastId.value = id
  toasts.push({ id, type, message: text })
  timers.set(id, setTimeout(() => dismissToast(id), duration))
  return id
}

export function useToast() {
  return {
    toasts,
    success: (message, duration) => showToast('success', message, duration),
    error: (message, duration) => showToast('error', message, duration),
    info: (message, duration) => showToast('info', message, duration),
    warning: (message, duration) => showToast('warning', message, duration),
    dismiss: dismissToast,
  }
}

/**
 * Converts legacy per-page message refs into global auto-dismissing toasts.
 * Existing CRUD handlers can keep setting errorMessage/successMessage while
 * every module uses the same toast UI and timing.
 */
export function useToastMessages(errorMessage, successMessage) {
  const toast = useToast()
  if (errorMessage) {
    watch(errorMessage, message => {
      if (!message) return
      toast.error(message)
      errorMessage.value = ''
    })
  }
  if (successMessage) {
    watch(successMessage, message => {
      if (!message) return
      toast.success(message)
      successMessage.value = ''
    })
  }
  return toast
}

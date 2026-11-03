import { reactive } from 'vue'

export const confirmDialogState = reactive({
  open: false,
  title: 'Confirm deletion',
  message: 'Are you sure you want to delete this record? This action cannot be undone.',
  confirmText: 'Delete',
  confirmVariant: 'danger',
  cancelText: 'Cancel',
  pending: false,
})

let settleCurrent = null

export function confirmAction(options = {}) {
  if (settleCurrent) settleCurrent(false)
  confirmDialogState.title = options.title || 'Confirm deletion'
  confirmDialogState.message = options.message || 'Are you sure you want to delete this record? This action cannot be undone.'
  confirmDialogState.confirmText = options.confirmText || 'Delete'
  confirmDialogState.confirmVariant = options.confirmVariant || 'danger'
  confirmDialogState.cancelText = options.cancelText || 'Cancel'
  confirmDialogState.pending = false
  confirmDialogState.open = true
  return new Promise((resolve) => { settleCurrent = resolve })
}

export function settleConfirmAction(confirmed) {
  if (!settleCurrent) return
  const resolve = settleCurrent
  settleCurrent = null
  confirmDialogState.open = false
  confirmDialogState.pending = false
  resolve(Boolean(confirmed))
}

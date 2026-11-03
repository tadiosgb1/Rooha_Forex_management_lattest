<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useToast } from '../../composables/toast'

const { toasts, dismiss, error, success, info, warning } = useToast()
let observer
const seenMessages = new WeakMap()
const alertSelector = '.module-page [role="alert"]:not(small), .module-page [role="status"]:not(small), .module-page .alert, .module-page [class*="inline-alert"], .module-page [class*="form-message"]'

function convertInlineMessage(element) {
  if (!(element instanceof HTMLElement) || element.closest('.toast-host')) return
  const message = (element.innerText || element.textContent || '').replace(/×/g, '').trim()
  if (!message || /^loading\b/i.test(message)) return
  if (seenMessages.get(element) === message) return
  seenMessages.set(element, message)
  const classes = String(element.className || '')
  const role = element.getAttribute('role')
  if (/success/i.test(classes) || role === 'status' && !/error|danger/i.test(classes)) success(message)
  else if (/warning/i.test(classes)) warning(message)
  else if (/info/i.test(classes)) info(message)
  else error(message)
  element.style.setProperty('display', 'none', 'important')
}

function scanForInlineMessages(root = document) {
  if (root instanceof HTMLElement && root.matches(alertSelector)) convertInlineMessage(root)
  root.querySelectorAll?.(alertSelector).forEach(convertInlineMessage)
}

onMounted(() => {
  scanForInlineMessages()
  observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) scanForInlineMessages(node)
      })
      else {
        const target = record.target instanceof HTMLElement ? record.target : record.target.parentElement
        const candidate = target?.closest(alertSelector)
        if (candidate) convertInlineMessage(candidate)
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="toast-host" aria-label="Notifications">
    <TransitionGroup name="toast" tag="div" class="toast-stack">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="app-toast"
        :class="`app-toast--${toast.type}`"
        :role="toast.type === 'error' ? 'alert' : 'status'"
        :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
      >
        <span class="app-toast__icon" aria-hidden="true">{{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : toast.type === 'warning' ? '⚠' : 'i' }}</span>
        <span class="app-toast__message">{{ toast.message }}</span>
        <button type="button" class="app-toast__close" aria-label="Dismiss notification" @click="dismiss(toast.id)">×</button>
        <span class="app-toast__progress" aria-hidden="true"></span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style>
.toast-host {
  position: fixed;
  z-index: 20000;
  top: 20px;
  right: 20px;
  width: min(420px, calc(100vw - 32px));
  pointer-events: none;
}
.toast-stack { display: flex; flex-direction: column; gap: 10px; }
.app-toast {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 11px;
  overflow: hidden;
  padding: 14px 14px 16px;
  border: 1px solid #a3cfbb;
  border-radius: 10px;
  background: #fff;
  color: #243449;
  box-shadow: 0 12px 32px rgba(20, 34, 58, .16);
  font: 500 14px/1.45 'DM Sans', sans-serif;
  pointer-events: auto;
}
.app-toast--success { border-color: #a3cfbb; }
.app-toast--error { border-color: #f1aeb5; }
.app-toast--info { border-color: #b6d4fe; }
.app-toast--warning { border-color: #ffda6a; }
.app-toast__icon {
  display: inline-flex;
  flex: 0 0 23px;
  width: 23px;
  height: 23px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #d1e7dd;
  color: #0f5132;
  font-weight: 800;
}
.app-toast--error .app-toast__icon { background: #f8d7da; color: #842029; }
.app-toast--info .app-toast__icon { background: #cfe2ff; color: #084298; }
.app-toast--warning .app-toast__icon { background: #fff3cd; color: #664d03; }
.app-toast__message { flex: 1; padding-top: 2px; overflow-wrap: anywhere; }
.app-toast__close {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: #667085;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.app-toast__close:hover { color: #1f2937; }
.app-toast__progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  transform-origin: left;
  background: #198754;
  animation: toast-progress 2.6s linear forwards;
}
.app-toast--error .app-toast__progress { background: #dc3545; }
.app-toast--info .app-toast__progress { background: #0d6efd; }
.app-toast--warning .app-toast__progress { background: #ffc107; }
.toast-enter-active, .toast-leave-active { transition: opacity .18s ease, transform .18s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(16px); }
.toast-leave-active { position: absolute; right: 0; left: 0; }
@keyframes toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@media (max-width: 600px) { .toast-host { top: 12px; right: 12px; width: calc(100vw - 24px); } }
@media (prefers-reduced-motion: reduce) { .toast-enter-active, .toast-leave-active { transition: none; } .app-toast__progress { animation-duration: 2.6s; } }
</style>

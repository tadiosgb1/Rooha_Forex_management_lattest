<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue'
const props = defineProps({ modelValue: { type: Boolean, default: false }, title: { type: String, default: '' }, size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg', 'xl'].includes(v) }, closeOnBackdrop: { type: Boolean, default: true }, closeOnEscape: { type: Boolean, default: true } })
const emit = defineEmits(['update:modelValue', 'close', 'confirm'])
function close() { emit('update:modelValue', false); emit('close') }
function onKeydown(event) { if (props.modelValue && props.closeOnEscape && event.key === 'Escape') close() }
watch(() => props.modelValue, (open) => { if (typeof document !== 'undefined') document.body.style.overflow = open ? 'hidden' : '' })
onMounted(() => { if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown); if (typeof document !== 'undefined') document.body.style.overflow = '' })
</script>
<template>
  <Teleport to="body">
    <Transition name="ui-modal">
      <div v-if="modelValue" class="ui-modal-backdrop" @click.self="closeOnBackdrop && close()">
        <section class="ui-modal" :class="`ui-modal--${size}`" role="dialog" aria-modal="true" :aria-label="title || 'Dialog'">
          <header class="ui-modal-header"><div><h2 v-if="title">{{ title }}</h2><slot name="header" /></div><button type="button" class="ui-modal-close" aria-label="Close dialog" @click="close">×</button></header>
          <div class="ui-modal-body"><slot /></div>
          <footer v-if="$slots.footer" class="ui-modal-footer"><slot name="footer" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

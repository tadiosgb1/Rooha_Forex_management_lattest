<script setup>
defineOptions({ inheritAttrs: false })
defineProps({ variant: { type: String, default: 'ghost', validator: (v) => ['primary', 'secondary', 'ghost', 'danger'].includes(v) }, size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) }, label: { type: String, required: true }, disabled: { type: Boolean, default: false } })
</script>
<template><button v-bind="$attrs" type="button" class="ui-icon-button" :class="[`ui-icon-button--${variant}`, `ui-icon-button--${size}`]" :aria-label="label" :title="label" :disabled="disabled"><slot /></button></template>

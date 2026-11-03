<script setup>
defineOptions({ inheritAttrs: false })
defineProps({
  variant: { type: String, default: 'primary', validator: (value) => ['primary', 'secondary', 'danger', 'ghost'].includes(value) },
  size: { type: String, default: 'md', validator: (value) => ['sm', 'md', 'lg'].includes(value) },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  pill: { type: Boolean, default: false },
})
</script>

<template>
  <button
    v-bind="$attrs"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="['ui-button', `ui-button--${variant}`, `ui-button--${size}`, { 'ui-button--block': block, 'ui-button--pill': pill, 'is-loading': loading }]"
  >
    <span v-if="loading" class="ui-button-spinner" aria-hidden="true"></span>
    <slot />
  </button>
</template>

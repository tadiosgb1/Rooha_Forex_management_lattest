<script setup>
defineOptions({ inheritAttrs: false })
defineProps({
  as: { type: String, default: 'div' },
  padded: { type: Boolean, default: false },
})
</script>

<template>
  <component :is="as" v-bind="$attrs" :class="['ui-card', { 'ui-card--padded': padded }]">
    <slot />
  </component>
</template>

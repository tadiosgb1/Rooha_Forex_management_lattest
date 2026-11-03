<script setup>
defineProps({
  tone: { type: String, default: 'neutral', validator: (value) => ['neutral', 'success', 'warning', 'danger', 'info'].includes(value) },
})
</script>

<template>
  <span :class="['ui-badge', `ui-badge--${tone}`]"><slot /></span>
</template>
